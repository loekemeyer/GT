-- gt_v166 · 1.57 (Elías, 06/10/2026: «d89 sí»). Lo que le faltaba a la cola de GT frente a Gestión Virgilio y Registro-Produccion-2.0.
--
-- 1) gt_registrar aísla la fila que falla (lección v25.20 de Virgilio, ahora del lado de la base). Antes, una fila que rompía
--    el insert (una fecha mal escrita, un número fuera de rango, un trigger) tiraba el lote ENTERO: el celular lo tomaba por
--    «sin red» y reintentaba para siempre el mismo lote, y todo lo que venía detrás quedaba trabado en esa cola.
--    Ahora cada fila va en su propio bloque (subtransacción):
--      · error DE DATO (clase 22 y 23 de Postgres: fecha, número, restricción) o un RAISE del propio trigger (P0001):
--        la fila se RECHAZA (sale de la cola del celular y queda en su lista de rechazados, como las otras) y se guarda
--        completa en gt.envio_errores, así no se pierde ·
--      · cualquier otro error (bloqueo, timeout, recursos, una conexión que se cae): la fila NO se confirma ni se rechaza:
--        el celular la conserva y la reintenta (`reintentar` en la respuesta), y las demás filas del lote entran igual.
--    La respuesta sigue siendo { ok, rechazados } (los celulares viejos no se enteran) + `reintentar`.
-- 2) gt.envio_errores: el equivalente de ERROR_ENVIO de Registro-Produccion-2.0 (tabla Auditoria_Produccion). Cada fila
--    rechazada o con error queda con su motivo, el SQLSTATE y la fila entera · y el celular avisa por gt_log_envio los
--    errores de envío que él ve (primer fallo y cada tanto) y cuando se recupera («envio_recuperado», con cuánto estuvo caído).
--    Consulta: select * from gt.envio_errores order by ts desc ·
--
-- Rollback: sql/gt_v166_rollback.sql (la gt_registrar de la 1.56 y gt_log_envio sin permiso para el celular).
-- La tabla puede quedar: nadie más la lee.

create table if not exists gt.envio_errores (
  id          bigserial primary key,
  ts          timestamptz not null default now(),
  primera     timestamptz not null default now(),
  tipo        text not null check (tipo in ('rechazo', 'error_fila', 'error_envio', 'envio_recuperado')),
  definitivo  boolean,                     -- rechazo / error_fila: true = la fila salió de la cola del celular
  client_id   text,
  empleado_id bigint,
  dispositivo text,
  motivo      text,
  sqlstate    text,
  intentos    int not null default 1,
  pendientes  int,                         -- error_envio / envio_recuperado: cuántos eventos tenía el celular sin enviar
  desde       timestamptz,                 -- error_envio / envio_recuperado: desde cuándo no podía enviar
  fila        jsonb                        -- rechazo / error_fila: la fila completa, para recuperarla
);
alter table gt.envio_errores enable row level security;      -- sin políticas = deny-all para anon (como todo el schema gt)
revoke all on gt.envio_errores from anon, authenticated;
revoke all on sequence gt.envio_errores_id_seq from anon, authenticated;
create unique index if not exists envio_errores_fila_uq on gt.envio_errores (tipo, client_id) where client_id is not null;
create index if not exists envio_errores_ts_idx on gt.envio_errores (ts desc);

-- el aviso de una fila: la primera vez la crea, las siguientes sólo cuentan el intento. Nunca rompe el envío.
create or replace function gt.envio_error_fila(p_tipo text, p_definitivo boolean, p_cid text, p_emp bigint, p_motivo text, p_state text, p_fila jsonb)
returns void language plpgsql security definer set search_path to '' as $f$
begin
  insert into gt.envio_errores (tipo, definitivo, client_id, empleado_id, dispositivo, motivo, sqlstate, fila)
  values (p_tipo, p_definitivo, p_cid, p_emp, left(p_fila->>'dispositivo', 60), left(p_motivo, 300), p_state, p_fila)
  on conflict (tipo, client_id) where client_id is not null
  do update set intentos = gt.envio_errores.intentos + 1, ts = now(), motivo = excluded.motivo, sqlstate = excluded.sqlstate, definitivo = excluded.definitivo;
exception when others then
  null;   -- registrar el error no puede ser otro error
end $f$;
revoke all on function gt.envio_error_fila(text, boolean, text, bigint, text, text, jsonb) from public, anon, authenticated;

create or replace function public.gt_registrar(p_filas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  f jsonb; ok jsonb := '[]'::jsonb; rech jsonb := '[]'::jsonb; reint jsonb := '[]'::jsonb;
  v_cid text; v_emp bigint; v_motivo text; v_state text; v_msg text;
begin
  for f in select * from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb)) loop
    v_cid := f->>'client_id';
    v_emp := case when (f->>'empleado_id') ~ '^\d+$' then (f->>'empleado_id')::bigint end;
    v_motivo := case
      when v_cid is null or v_cid = '' then 'sin client_id'
      when v_emp is null or not exists (select 1 from gt.empleados e where e.activo and e.id = v_emp) then 'empleado inexistente o inactivo'
      when f->>'opcion' = 'AREA' and not exists (select 1 from gt.rubros r where r.codigo = f->>'rubro') then 'área inexistente'
      when f->>'opcion' <> 'AREA' and not exists (select 1 from gt.tareas t where t.codigo = f->>'opcion') then 'tarea inexistente'
      when (f->>'cantidad') is not null and (f->>'cantidad') !~ '^\d+(\.\d+)?$' then 'cantidad inválida'
    end;
    if v_motivo is not null then
      rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', v_motivo);
      perform gt.envio_error_fila('rechazo', true, v_cid, v_emp, v_motivo, null, f);
      continue;
    end if;
    -- 1.57: cada fila en su propio bloque. Si el insert (o un trigger) falla, se deshace SOLO esa fila
    begin
      insert into gt.registros (client_id, empleado_id, opcion, rubro, cantidad, descripcion, texto, ts_cliente, ts_inicio, dispositivo, medida, planta, detalle)
      values (v_cid, v_emp, f->>'opcion', nullif(f->>'rubro',''), (f->>'cantidad')::numeric, f->>'descripcion', nullif(f->>'texto',''),
              (f->>'ts_cliente')::timestamptz, nullif(f->>'ts_inicio','')::timestamptz, f->>'dispositivo', nullif(btrim(f->>'medida'), ''),
              (select p.codigo from gt.plantas p where p.codigo = nullif(btrim(f->>'planta'), '')),
              case when jsonb_typeof(f->'detalle') = 'object' and f->'detalle' <> '{}'::jsonb then f->'detalle' end)
      on conflict (client_id) do nothing;
      ok := ok || to_jsonb(v_cid);
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      if v_state like '22%' or v_state like '23%' or v_state = 'P0001' then
        rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', 'error de dato: ' || left(v_msg, 200));
        perform gt.envio_error_fila('error_fila', true, v_cid, v_emp, v_msg, v_state, f);
      else
        reint := reint || to_jsonb(v_cid);
        perform gt.envio_error_fila('error_fila', false, v_cid, v_emp, v_msg, v_state, f);
      end if;
    end;
  end loop;
  return jsonb_build_object('ok', ok, 'rechazados', rech, 'reintentar', reint);
end $function$;

-- lo que ve el celular cuando no puede enviar (primer fallo, cada tanto) y cuando se recupera. Sin clave de nadie: sólo texto.
create or replace function public.gt_log_envio(p_tipo text, p_dispositivo text, p_empleado bigint, p_motivo text, p_intentos int, p_pendientes int, p_desde timestamptz)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if p_tipo not in ('error_envio', 'envio_recuperado') then return; end if;
  -- un celular con un bug no puede llenar la tabla: tope de 500 avisos por hora entre todos
  if (select count(*) from gt.envio_errores where ts > now() - interval '1 hour' and tipo in ('error_envio', 'envio_recuperado')) >= 500 then return; end if;
  insert into gt.envio_errores (tipo, empleado_id, dispositivo, motivo, intentos, pendientes, desde)
  values (p_tipo, (select e.id from gt.empleados e where e.id = p_empleado), left(p_dispositivo, 60), left(p_motivo, 300),
          greatest(coalesce(p_intentos, 1), 0), p_pendientes, p_desde);
end $function$;
revoke all on function public.gt_log_envio(text, text, bigint, text, int, int, timestamptz) from public;
grant execute on function public.gt_log_envio(text, text, bigint, text, int, int, timestamptz) to anon, authenticated;

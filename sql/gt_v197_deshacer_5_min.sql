-- gt_v197 — «↩ Me equivoqué»: el operario deshace lo último que cargó, hasta 5 minutos después (24/11/2026)
-- Caso: Ximena Ortiz, 24/11 09:47, cargó en Encolado el 3079 (código de Deco, «Armado Bandeja 535/549/452») y para salir
-- tuvo que cerrarlo con 0 y abrir Deco. Pedido: «permitir ir para atrás cuando se equivocan, hasta 5 minutos después».
--
-- Cómo anda:
--   · El celular manda una fila más, opcion = 'DESHACER', por la misma cola (sale en orden, también sin red), con
--     detalle = { anula: [client_id…], filas: [lo que se deshace, para auditoría] }.
--   · gt_registrar NO cambia: acepta 'DESHACER' porque es una tarea de gt.tareas (tipo evento, como FIN e INGRESO).
--   · El trigger BEFORE INSERT gt_deshacer pasa esas filas a opcion = 'AREAX' (la misma marca que «🗑️ eliminar» del admin:
--     dejan de contar en Producción, Ritmo, Rendimiento, Asistencia y stock), anota cada una en gt.registro_correcciones
--     (accion = 'eliminar' —el check sólo deja editar / eliminar y el conector no corre el DROP CONSTRAINT—, con
--     despues.deshacer = client_id del deshacer y la nota «Celular · deshacer…») y rechaza (sin tocarlas) las que no son del mismo operario, no son 'AREA' o tienen más de
--     5 min 30 s (30 s de tolerancia para el reloj del celular). Lo que hizo queda en detalle._deshechas / _no.
--   · Si la apertura deshecha invitó a un compañero y él todavía no aceptó, la invitación pasa a 'rechazada'.
--   · Ningún delete. Volver atrás un «deshacer»: update gt.registros set opcion = 'AREA' where id in (ids de
--     gt.registro_correcciones con despues ? 'deshacer').
-- No toca nada de lo que usan hoy los celulares: el trigger sólo corre para opcion = 'DESHACER', que ninguna versión
-- anterior a la 1.74 manda.

insert into gt.tareas (codigo, descripcion, tipo, rubro, pide_texto, etiqueta_texto, fila, orden, activo)
values ('DESHACER', 'Deshizo lo último (hasta 5 min)', 'evento', null, false, null, 1, 0, true)
on conflict (codigo) do nothing;

create or replace function gt.trg_deshacer()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_ids text[] := array(select jsonb_array_elements_text(coalesce(new.detalle->'anula', '[]'::jsonb)));
  r gt.registros;
  v_hechas jsonb := '[]'::jsonb;
  v_no jsonb := '[]'::jsonb;
  v_motivo text;
begin
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'DESHACER sin filas para deshacer';
  end if;
  for r in select * from gt.registros where client_id = any(v_ids) order by ts_cliente for update loop
    v_motivo := case
      when r.empleado_id <> new.empleado_id then 'es de otro operario'
      when r.opcion = 'AREAX' then 'ya estaba anulada'
      when r.opcion <> 'AREA' then 'no es un área'
      when new.ts_cliente - r.ts_cliente > interval '5 minutes 30 seconds' then 'pasaron más de 5 minutos'
      when r.ts_cliente - new.ts_cliente > interval '1 minute' then 'es posterior al deshacer'
    end;
    if v_motivo is not null then
      v_no := v_no || jsonb_build_object('client_id', r.client_id, 'motivo', v_motivo);
      continue;
    end if;
    update gt.registros set opcion = 'AREAX' where id = r.id;
    update gt.parejas set estado = 'rechazada', respondida = now() where client_id = r.client_id and estado = 'pendiente';
    insert into gt.registro_correcciones (accion, empleado_id, rubro, texto, id_apertura, id_cierre, antes, despues, nota)
    values ('eliminar', r.empleado_id, r.rubro, r.texto,
            case when r.ts_inicio is null then r.id end, case when r.ts_inicio is not null then r.id end,
            jsonb_build_object('client_id', r.client_id, 'ts', r.ts_cliente, 'ts_inicio', r.ts_inicio, 'cantidad', r.cantidad),
            jsonb_build_object('deshacer', new.client_id, 'ts', new.ts_cliente),
            'Celular · deshacer: el operario deshizo lo último (hasta 5 min) · opcion AREAX');
    v_hechas := v_hechas || to_jsonb(r.client_id);
  end loop;
  -- las que no están en la base: el celular las sacó de su cola antes de mandarlas (quedan descriptas en detalle.filas)
  v_no := v_no || coalesce((select jsonb_agg(jsonb_build_object('client_id', x, 'motivo', 'no llegó a la base'))
                              from unnest(v_ids) x where not exists (select 1 from gt.registros g where g.client_id = x)), '[]'::jsonb);
  new.detalle := new.detalle || jsonb_build_object('_deshechas', v_hechas, '_no', v_no);
  return new;
end $function$;

create trigger gt_deshacer before insert on gt.registros
  for each row when (new.opcion = 'DESHACER') execute function gt.trg_deshacer();

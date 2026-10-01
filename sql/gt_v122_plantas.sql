-- GT v1.22 — PLANTAS: Pellegrini y Aula (Thomas, 01/10/2026).
-- «Cuando pongan el código, lo primero que les pregunte es en qué planta van a trabajar, Pellegrini o Aula.
--  Solamente para Darío Méndez y Luis Luna. El resto siempre trabajan en Pellegrini.»
-- En Aula: primero se moldura, después se lija y después se pinta (las molduras que después se cortan en Pellegrini).
--
-- PARTE 1 (estructura) — APLICADA el 2026-10-01. No cambia nada para nadie mientras gt.plantas y
-- gt.empleado_planta estén vacías: la app no pregunta y la botonera es la de siempre.
-- PARTE 2 (datos) — al final, APLICADA el 2026-10-01 (Thomas: «D5 es un sí»).
--
-- Cómo funciona:
--   · gt.plantas: la de menor `orden` es la PRINCIPAL. Un área (gt.rubros) sin `planta` es de la principal.
--   · gt.empleado_planta: sólo los que trabajan en más de una planta. Sin filas = sólo la principal.
--   · public.gt_clave_validar devuelve, por empleado, `plantas` (las suyas) y `principal`. La app pregunta
--     la planta si el empleado tiene 2 o más.
--   · public.gt_botones2 = gt_botones + la planta de cada área (gt_botones no se puede cambiar: cambia lo que
--     devuelve y el conector no deja correr un DROP).
--   · gt.registros.planta: en qué planta se hizo cada evento (gt_registrar lo graba si la planta existe).
--
-- Rollback (lo corre el dueño en el SQL Editor; el conector no deja DROP):
--   alter table gt.registros drop column planta; alter table gt.rubros drop column planta;
--   drop function public.gt_botones2(); drop table gt.empleado_planta; drop table gt.plantas;
--   y volver gt_clave_validar / gt_registrar a la definición de gt_v17_orden_por_legajo.sql / gt_v117_sets_medida.sql.

create table if not exists gt.plantas (
  codigo text primary key,
  nombre text not null unique,
  orden  integer not null default 1,
  activo boolean not null default true
);
create table if not exists gt.empleado_planta (
  empleado_id bigint not null references gt.empleados(id),
  planta      text   not null references gt.plantas(codigo),
  primary key (empleado_id, planta)
);
alter table gt.plantas         enable row level security;
alter table gt.empleado_planta enable row level security;
revoke all on gt.plantas, gt.empleado_planta from anon, authenticated;

alter table gt.rubros    add column if not exists planta text references gt.plantas(codigo);
alter table gt.registros add column if not exists planta text;

-- la planta principal (menor orden activa); null si no hay plantas cargadas
create or replace function gt.planta_principal()
returns text language sql stable set search_path to '' as $$
  select p.codigo from gt.plantas p where p.activo order by p.orden, p.codigo limit 1
$$;
revoke all on function gt.planta_principal() from public, anon, authenticated;

-- sobre la definición viva del 01/10 (v1.7): + `plantas` y `principal` por empleado
create or replace function public.gt_clave_validar(p_clave text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  v_t bigint := floor(extract(epoch from now()) / 60)::bigint;
  v_c text := regexp_replace(coalesce(p_clave, ''), '\D', '', 'g');
  v_pr text := gt.planta_principal();
begin
  if v_c = '' or (v_c <> gt.clave_de(v_t) and v_c <> gt.clave_de(v_t - 1)) then
    return jsonb_build_object('ok', false);
  end if;
  -- v1.7: ordenados por número de legajo (Thomas); sin legajo, al final por nombre
  -- v1.22: cada empleado trae sus plantas (gt.empleado_planta; sin filas = la principal)
  return jsonb_build_object('ok', true, 'principal', v_pr, 'empleados', coalesce((
    select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre, 'legajo', e.legajo,
             'plantas', coalesce((select jsonb_agg(jsonb_build_object('codigo', p.codigo, 'nombre', p.nombre) order by p.orden, p.codigo)
                                    from gt.empleado_planta ep join gt.plantas p on p.codigo = ep.planta and p.activo
                                   where ep.empleado_id = e.id),
                                 (select jsonb_build_array(jsonb_build_object('codigo', p.codigo, 'nombre', p.nombre))
                                    from gt.plantas p where p.codigo = v_pr),
                                 '[]'::jsonb))
                     order by gt.legajo_num(e.legajo) nulls last, e.nombre)
      from gt.empleados e where e.activo), '[]'::jsonb));
end $function$;

create or replace function public.gt_botones2()
returns table(codigo text, nombre text, unidad text, orden integer, pide_codigo boolean, pide_cantidad boolean, planta text)
language sql stable security definer set search_path to '' as $$
  select r.codigo, r.nombre, r.unidad, r.orden, r.pide_codigo, r.pide_cantidad, r.planta
    from gt.rubros r where r.activo order by r.orden, r.codigo;
$$;
revoke all on function public.gt_botones2() from public;
grant execute on function public.gt_botones2() to anon, authenticated;

-- sobre la definición viva del 01/10 (v1.17): + planta (sólo si existe en gt.plantas; si no, null)
create or replace function public.gt_registrar(p_filas jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  f jsonb; ok jsonb := '[]'::jsonb; rech jsonb := '[]'::jsonb; v_cid text; v_emp bigint;
begin
  for f in select * from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb)) loop
    v_cid := f->>'client_id';
    v_emp := case when (f->>'empleado_id') ~ '^\d+$' then (f->>'empleado_id')::bigint end;
    if v_cid is null or v_cid = '' then
      rech := rech || jsonb_build_object('client_id', null, 'motivo', 'sin client_id');
    elsif v_emp is null or not exists (select 1 from gt.empleados e where e.activo and e.id = v_emp) then
      rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', 'empleado inexistente o inactivo');
    elsif f->>'opcion' = 'AREA' and not exists (select 1 from gt.rubros r where r.codigo = f->>'rubro') then
      rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', 'área inexistente');
    elsif f->>'opcion' <> 'AREA' and not exists (select 1 from gt.tareas t where t.codigo = f->>'opcion') then
      rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', 'tarea inexistente');
    elsif (f->>'cantidad') is not null and (f->>'cantidad') !~ '^\d+(\.\d+)?$' then
      rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', 'cantidad inválida');
    else
      insert into gt.registros (client_id, empleado_id, opcion, rubro, cantidad, descripcion, texto, ts_cliente, ts_inicio, dispositivo, medida, planta)
      values (v_cid, v_emp, f->>'opcion', nullif(f->>'rubro',''), (f->>'cantidad')::numeric, f->>'descripcion', nullif(f->>'texto',''),
              (f->>'ts_cliente')::timestamptz, nullif(f->>'ts_inicio','')::timestamptz, f->>'dispositivo', nullif(btrim(f->>'medida'), ''),
              (select p.codigo from gt.plantas p where p.codigo = nullif(btrim(f->>'planta'), '')))
      on conflict (client_id) do nothing;
      ok := ok || to_jsonb(v_cid);
    end if;
  end loop;
  return jsonb_build_object('ok', ok, 'rechazados', rech);
end $function$;

-- ============================================================================================
-- PARTE 2 — DATOS, APLICADA el 2026-10-01. Efectos: Darío Méndez y Luis Luna ven «¿En qué planta
-- trabajás hoy?» al entrar; el resto entra como siempre (Pellegrini). En Aula la botonera son las
-- 3 áreas nuevas; en Pellegrini, las 11 de siempre. Las 3 áreas registran sólo el tiempo (sin código
-- ni cantidad) hasta que Thomas defina qué se cuenta.
-- insert into gt.plantas (codigo, nombre, orden) values ('PELL', 'Pellegrini', 1), ('AULA', 'Aula', 2);
-- insert into gt.empleado_planta (empleado_id, planta) values (6, 'PELL'), (6, 'AULA'), (5, 'PELL'), (5, 'AULA');
-- insert into gt.rubros (codigo, nombre, unidad, orden, activo, pide_codigo, pide_cantidad, planta) values
--   ('MOLDU', 'Moldurado', '—', 21, true, false, false, 'AULA'),
--   ('LIJA',  'Lijado',    '—', 22, true, false, false, 'AULA'),
--   ('PINT',  'Pintado',   '—', 23, true, false, false, 'AULA');

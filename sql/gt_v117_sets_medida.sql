-- GT v1.17 — APLICADO el 2026-10-01 (Thomas):
--  · los SETS DE 3 («Set x3» en la descripción) sólo se comparan entre sets de 3, en todo el proceso:
--    grupo = «Set x3 · <moldura> · <las 3 medidas ordenadas>».
--  · en MONTAJE y GANCHO, con un set de 3 la app pregunta QUÉ MEDIDA se va a montar / ponerle gancho;
--    ese tramo se compara con la moldura + esa medida (o sea, con los cuadros sueltos de esa medida).
--    La medida elegida va en la columna nueva gt.registros.medida (apertura y cierre).
alter table gt.registros add column if not exists medida text;

create or replace function gt.moldura_de(p_desc text) returns text language sql immutable set search_path to ''
as $$ select coalesce('Mold ' || (regexp_match(p_desc, 'Mold\s+([0-9]+(?:mm)?)', 'i'))[1], case when p_desc ~* '\mMDF\M' then 'MDF' end) $$;
create or replace function gt.es_set3(p_desc text) returns boolean language sql immutable set search_path to ''
as $$ select coalesce(p_desc ~* '\mset\s*x\s*3\M', false) $$;

create or replace function gt.grupo_auto(p_desc text, p_medida text) returns text
 language sql immutable set search_path to ''
as $$
  -- misma moldura + misma medida = misma demora (1.16). Un set de 3 sólo con sets de 3 (1.17).
  select case
    when coalesce(btrim(p_medida), '') = '' then null
    when gt.es_set3(p_desc) then 'Set x3 · ' || coalesce(gt.moldura_de(p_desc) || ' · ', '') ||
      (select string_agg(btrim(x), ' + ' order by btrim(x)) from unnest(string_to_array(p_medida, '+')) x)
    when gt.moldura_de(p_desc) is null then null
    else gt.moldura_de(p_desc) || ' · ' || btrim(p_medida) end
$$;
revoke all on function gt.moldura_de(text) from public, anon, authenticated;
revoke all on function gt.es_set3(text) from public, anon, authenticated;

-- grupo de un tramo: con medida elegida (pieza de un set en Montaje/Gancho) → moldura + esa medida
create or replace function gt.grupo_tramo(p_codigo text, p_medida text) returns text
 language sql stable security definer set search_path to ''
as $$
  select case when coalesce(btrim(p_medida), '') <> '' then
      coalesce((select gt.moldura_de(c.descripcion) from gt.codigos c where upper(c.codigo) = upper(btrim(p_codigo))),
               'Código ' || upper(btrim(p_codigo))) || ' · ' || btrim(p_medida)
    else gt.grupo_codigo(p_codigo) end
$$;
revoke all on function gt.grupo_tramo(text, text) from public, anon, authenticated;

-- gt_registrar: guarda también la medida
CREATE OR REPLACE FUNCTION public.gt_registrar(p_filas jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
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
      insert into gt.registros (client_id, empleado_id, opcion, rubro, cantidad, descripcion, texto, ts_cliente, ts_inicio, dispositivo, medida)
      values (v_cid, v_emp, f->>'opcion', nullif(f->>'rubro',''), (f->>'cantidad')::numeric, f->>'descripcion', nullif(f->>'texto',''),
              (f->>'ts_cliente')::timestamptz, nullif(f->>'ts_inicio','')::timestamptz, f->>'dispositivo', nullif(btrim(f->>'medida'), ''))
      on conflict (client_id) do nothing;
      ok := ok || to_jsonb(v_cid);
    end if;
  end loop;
  return jsonb_build_object('ok', ok, 'rechazados', rech);
end $function$;

-- lo de hoy, con la medida (la app pasa a esta; gt_registros_hoy queda para celulares viejos)
create or replace function public.gt_registros_hoy2(p_empleado bigint)
 returns table(client_id text, opcion text, rubro text, cantidad numeric, descripcion text, texto text,
               ts_cliente timestamptz, ts_inicio timestamptz, medida text)
 language sql stable security definer set search_path to ''
as $function$
  select r.client_id, r.opcion, r.rubro, r.cantidad, r.descripcion, r.texto, r.ts_cliente, r.ts_inicio, r.medida
    from gt.registros r
   where r.empleado_id = p_empleado
     and r.ts_cliente >= (date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires')
   order by r.ts_cliente;
$function$;
revoke all on function public.gt_registros_hoy2(bigint) from public;
grant execute on function public.gt_registros_hoy2(bigint) to anon, authenticated;

-- cierre automático: copia también la medida
create or replace function gt.cierre_automatico(p_enviar boolean default true)
 returns text language plpgsql security definer set search_path to ''
as $function$
declare
  v_d date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_ini timestamptz := v_d::timestamp at time zone 'America/Argentina/Buenos_Aires';
  v_sa time := coalesce((select valor from gt.config where clave = 'hora_salida'), '17:30')::time;
  v_chat text := coalesce((select valor from gt.config where clave = 'telegram_chat'), '-1004379879565');
  r record; v_cierre timestamptz; v_lista text := '';
begin
  for r in
    select a.*, e.nombre, ru.nombre area,
           ((v_d + coalesce(hd.salida, h.salida, v_sa)) at time zone 'America/Argentina/Buenos_Aires') salida
      from gt.registros a
      join gt.empleados e on e.id = a.empleado_id
      left join gt.rubros ru on ru.codigo = a.rubro
      left join gt.horario_empleado h on h.empleado_id = a.empleado_id
      left join gt.horario_dia hd on hd.empleado_id = a.empleado_id and hd.dow = extract(isodow from v_d)
     where a.opcion = 'AREA' and a.ts_inicio is null and a.ts_cliente >= v_ini
       and not exists (select 1 from gt.registros c where c.empleado_id = a.empleado_id and c.rubro = a.rubro
                         and c.opcion = 'AREA' and c.ts_inicio = a.ts_cliente)
     order by e.nombre
  loop
    v_cierre := least(now(), greatest(r.ts_cliente, r.salida));
    insert into gt.registros (client_id, empleado_id, opcion, rubro, cantidad, descripcion, texto, ts_cliente, ts_inicio, dispositivo, medida)
    values ('auto-cierre-' || r.id, r.empleado_id, 'AREA', r.rubro, null, 'Cerrado por el sistema (no tocó Terminé)',
            r.texto, v_cierre, r.ts_cliente, 'sistema:cierre', r.medida)
    on conflict (client_id) do nothing;
    v_lista := v_lista || E'\n• ' || r.nombre || ' — ' || coalesce(r.area, r.rubro) || coalesce(' · ' || r.texto, '') ||
               coalesce(' (' || r.medida || ')', '') ||
               ' desde ' || to_char(r.ts_cliente at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') ||
               ' (cerrado ' || to_char(v_cierre at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') || ', sin cantidad)';
  end loop;
  if v_lista = '' then return null; end if;
  v_lista := '🔒 GT — cerré solo lo que quedó abierto ' || to_char(v_d, 'DD/MM') || ':' || v_lista;
  if p_enviar then perform public.tg_enqueue(v_lista, 'gt-cierre-auto-' || v_d::text, v_chat); end if;
  return v_lista;
end $function$;

-- producción del admin: el código muestra la medida elegida (pieza de un set)
create or replace function public.gt_admin_produccion2(p_pass text, p_dia date default null)
 returns table(empleado text, area text, rubro text, codigo text, descripcion text, desde timestamptz, hasta timestamptz,
               cantidad numeric, unidad text, uxb integer, unidades numeric, auto boolean)
 language sql stable security definer set search_path to ''
as $function$
  with par as (select coalesce(p_dia, (now() at time zone 'America/Argentina/Buenos_Aires')::date) d),
  hoy as (select r.* from gt.registros r, par
           where r.opcion = 'AREA' and r.rubro <> 'ALMU'
             and r.ts_cliente >= par.d::timestamp at time zone 'America/Argentina/Buenos_Aires'
             and r.ts_cliente <  (par.d + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),
  tramos as (
    select c.empleado_id, c.rubro, c.texto, c.medida, c.ts_inicio desde, c.ts_cliente hasta, c.cantidad, c.dispositivo = 'sistema:cierre' auto
      from hoy c where c.ts_inicio is not null
    union all
    select a.empleado_id, a.rubro, a.texto, a.medida, a.ts_cliente, null, null, false from hoy a
     where a.ts_inicio is null
       and not exists (select 1 from hoy c where c.empleado_id = a.empleado_id and c.rubro = a.rubro and c.ts_inicio = a.ts_cliente))
  select e.nombre, ru.nombre, t.rubro, t.texto || coalesce(' (' || t.medida || ')', ''), coalesce(cr.descripcion, co.descripcion),
         t.desde, t.hasta, t.cantidad, ru.unidad, co.uxb,
         case when ru.unidad ilike 'cajas%' and co.uxb is not null then t.cantidad * co.uxb end, coalesce(t.auto, false)
    from tramos t join gt.empleados e on e.id = t.empleado_id join gt.rubros ru on ru.codigo = t.rubro
    left join gt.codigos co on upper(co.codigo) = upper(btrim(t.texto))
    left join gt.codigos_rubro cr on cr.rubro = t.rubro and upper(cr.codigo) = upper(btrim(t.texto))
   where gt.pass_ok(p_pass)
   order by gt.legajo_num(e.legajo) nulls last, e.nombre, t.desde;
$function$;

-- ritmo: el grupo de cada tramo sale de gt.grupo_tramo (con la medida elegida, si la hay)
create or replace function public.gt_admin_ritmo2(p_pass text, p_dia date default null)
 returns table(empleado text, legajo text, area text, rubro text, grupo text, codigos text, unidad text, hecho numeric,
               horas numeric, por_hora numeric, prom_grupo numeric, tramos int)
 language sql stable security definer set search_path to ''
as $function$
  with par as (select coalesce(p_dia, (now() at time zone 'America/Argentina/Buenos_Aires')::date) d),
  base as (
    select c.empleado_id, c.rubro, (c.ts_cliente at time zone 'America/Argentina/Buenos_Aires')::date dia,
           upper(btrim(c.texto)) || coalesce(' (' || c.medida || ')', '') cod,
           case when exists (select 1 from gt.codigo_area ca where ca.rubro = c.rubro)
                then coalesce(gt.grupo_tramo(c.texto, c.medida), 'Código ' || upper(btrim(c.texto))) end grp,
           extract(epoch from c.ts_cliente - c.ts_inicio) / 3600.0 h,
           case when ru.unidad ilike 'cajas%' and co.uxb is not null then c.cantidad * co.uxb else c.cantidad end v,
           case when ru.unidad ilike 'cajas%' and co.uxb is not null then 'unidades' else ru.unidad end u
      from gt.registros c
      join gt.rubros ru on ru.codigo = c.rubro
      left join gt.codigos co on upper(co.codigo) = upper(btrim(c.texto))
     where c.opcion = 'AREA' and c.rubro <> 'ALMU' and c.ts_inicio is not null and c.cantidad is not null
       and c.ts_cliente - c.ts_inicio >= interval '2 minutes'
       and c.ts_cliente >= ((select d from par) - 28)::timestamp at time zone 'America/Argentina/Buenos_Aires'
       and c.ts_cliente <  ((select d from par) + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),
  prom as (select rubro, grp, u, sum(v) / nullif(sum(h), 0) ph from base, par where dia < par.d group by 1, 2, 3),
  hoy as (select empleado_id, rubro, grp, u, string_agg(distinct cod, ', ') cods, sum(v) v, sum(h) h, count(*)::int n
            from base, par where dia = par.d group by 1, 2, 3, 4)
  select e.nombre, e.legajo, ru.nombre, x.rubro, x.grp, x.cods, x.u, round(x.v, 2), round(x.h::numeric, 2),
         case when x.h >= 0.25 then round((x.v / x.h)::numeric, 1) end,
         round(p.ph::numeric, 1), x.n
    from hoy x join gt.empleados e on e.id = x.empleado_id join gt.rubros ru on ru.codigo = x.rubro
    left join prom p on p.rubro = x.rubro and p.u = x.u and p.grp is not distinct from x.grp
   where gt.pass_ok(p_pass)
   order by gt.legajo_num(e.legajo) nulls last, e.nombre, ru.orden, x.grp;
$function$;

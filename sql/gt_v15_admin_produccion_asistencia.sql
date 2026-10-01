-- GT v1.5 — APLICADO el 2026-10-01 (definición viva traída con pg_get_functiondef).
-- Admin: pestañas Producción y Asistencia. Las dos RPC exigen la clave del monitor (gt.pass_ok):
-- con clave mala devuelven 0 filas. Probado como anon: 151515 → 10 / 9 filas; clave mala → 0.

CREATE OR REPLACE FUNCTION gt.pass_ok(p_pass text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select coalesce((select extensions.crypt(p_pass, valor) = valor from gt.config where clave = 'monitor_pass'), false)
     and p_pass is not null;
$function$;
revoke all on function gt.pass_ok(text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gt_admin_produccion(p_pass text, p_dia date DEFAULT NULL::date)
 RETURNS TABLE(empleado text, area text, rubro text, codigo text, descripcion text, desde timestamp with time zone, hasta timestamp with time zone, cantidad numeric, unidad text, uxb integer, unidades numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  with par as (select coalesce(p_dia, (now() at time zone 'America/Argentina/Buenos_Aires')::date) d),
  hoy as (select r.* from gt.registros r, par
           where r.opcion = 'AREA' and r.rubro <> 'ALMU'
             and r.ts_cliente >= par.d::timestamp at time zone 'America/Argentina/Buenos_Aires'
             and r.ts_cliente <  (par.d + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),
  tramos as (
    select c.empleado_id, c.rubro, c.texto, c.ts_inicio desde, c.ts_cliente hasta, c.cantidad from hoy c where c.ts_inicio is not null
    union all
    select a.empleado_id, a.rubro, a.texto, a.ts_cliente, null, null from hoy a
     where a.ts_inicio is null
       and not exists (select 1 from hoy c where c.empleado_id = a.empleado_id and c.rubro = a.rubro and c.ts_inicio = a.ts_cliente))
  select e.nombre, ru.nombre, t.rubro, t.texto, coalesce(cr.descripcion, co.descripcion), t.desde, t.hasta, t.cantidad, ru.unidad, co.uxb,
         case when ru.unidad ilike 'cajas%' and co.uxb is not null then t.cantidad * co.uxb end
    from tramos t join gt.empleados e on e.id = t.empleado_id join gt.rubros ru on ru.codigo = t.rubro
    left join gt.codigos co on upper(co.codigo) = upper(btrim(t.texto))
    left join gt.codigos_rubro cr on cr.rubro = t.rubro and upper(cr.codigo) = upper(btrim(t.texto))
   where gt.pass_ok(p_pass)
   order by e.nombre, t.desde;
$function$;

CREATE OR REPLACE FUNCTION public.gt_admin_asistencia(p_pass text, p_dia date DEFAULT NULL::date)
 RETURNS TABLE(empleado text, legajo text, entrada timestamp without time zone, entrada_prevista timestamp without time zone, almuerzo_sale timestamp without time zone, almuerzo_vuelve timestamp without time zone, almuerzo_desde timestamp without time zone, almuerzo_hasta timestamp without time zone, flexible boolean, fin timestamp without time zone, salida_prevista timestamp without time zone, area_abierta boolean, termino boolean, tolerancia_min integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  with par as (select coalesce(p_dia, (now() at time zone 'America/Argentina/Buenos_Aires')::date) d,
                      coalesce((select valor from gt.config where clave = 'hora_entrada'), '08:00')::time g_en,
                      coalesce((select valor from gt.config where clave = 'tolerancia_min'), '5')::int tol),
  pri as (select r.empleado_id, min(r.ts_cliente) primero from gt.registros r, par
           where r.ts_cliente >= par.d::timestamp at time zone 'America/Argentina/Buenos_Aires'
             and r.ts_cliente <  (par.d + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires' group by 1)
  select e.nombre, e.legajo, p.primero at time zone 'America/Argentina/Buenos_Aires',
         par.d + coalesce(hd.entrada, h.entrada, par.g_en),
         j.sale, j.vuelve, j.ad, j.ah, coalesce(j.flex, h.almuerzo_flexible, false), j.fin,
         coalesce(j.sa, par.d + coalesce(hd.salida, h.salida, coalesce((select valor from gt.config where clave = 'hora_salida'), '17:30')::time)),
         coalesce(j.area_abierta, false), coalesce(j.termino, false), par.tol
    from par, gt.empleados e
    left join pri p on p.empleado_id = e.id
    left join gt.horario_empleado h on h.empleado_id = e.id
    left join gt.horario_dia hd on hd.empleado_id = e.id and hd.dow = extract(isodow from (select d from par))
    left join gt.jornada_estado((select d from par)) j on j.nombre = e.nombre
   where e.activo and gt.pass_ok(p_pass)
   order by e.nombre;
$function$;

revoke all on function public.gt_admin_produccion(text, date) from public;
revoke all on function public.gt_admin_asistencia(text, date) from public;
grant execute on function public.gt_admin_produccion(text, date) to anon, authenticated;
grant execute on function public.gt_admin_asistencia(text, date) to anon, authenticated;

-- GT gt_v145 (Elías, 02/10/2026: «en admin no muestra el ritmo ni la familia… el encolado de la foto es 10*30»).
-- Producción del admin mostraba código y descripción pero no la FAMILIA (grupo de fabricación, 1.15: moldura + medida):
-- sólo salía en la tabla de Ritmo, que no cuenta tramos de menos de 2 min (D35) y ese día estaba vacía.
-- gt_admin_produccion3 = gt_admin_produccion2 + la columna `familia`, calculada igual que el grupo de gt_admin_ritmo2:
-- sólo en las áreas con lista de productos (gt.codigo_area) y con gt.grupo_tramo(código, medida del set). Un código sin
-- familia sale «Código 173» (va solo), como en el ritmo. Función NUEVA (cambiar las columnas de la 2 pide DROP, y el
-- conector no lo deja): admin.html llama a la 3 y, si falla, a la 2.
-- ROLLBACK: admin.html vuelve a llamar a la 2; la 3 queda inocua (o la borra el dueño en el SQL Editor).

create or replace function public.gt_admin_produccion3(p_pass text, p_dia date default null)
 returns table(empleado text, area text, rubro text, codigo text, descripcion text, desde timestamptz, hasta timestamptz,
               cantidad numeric, unidad text, uxb integer, unidades numeric, auto boolean, familia text)
 language sql stable security definer set search_path to ''
as $function$
  with par as (select coalesce(p_dia, (now() at time zone 'America/Argentina/Buenos_Aires')::date) d),
  hoy as (select r.* from gt.registros r, par
           where r.opcion = 'AREA' and r.rubro <> 'ALMU'
             and r.ts_cliente >= par.d::timestamp at time zone 'America/Argentina/Buenos_Aires'
             and r.ts_cliente <  (par.d + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),
  tramos as (
    select c.empleado_id, c.rubro, c.texto, c.medida, c.detalle, c.ts_inicio desde, c.ts_cliente hasta, c.cantidad, c.dispositivo = 'sistema:cierre' auto
      from hoy c where c.ts_inicio is not null
    union all
    select a.empleado_id, a.rubro, a.texto, a.medida, a.detalle, a.ts_cliente, null, null, false from hoy a
     where a.ts_inicio is null
       and not exists (select 1 from hoy c where c.empleado_id = a.empleado_id and c.rubro = a.rubro and c.ts_inicio = a.ts_cliente)),
  conpaso as (select distinct p.rubro from gt.rubro_pasos p where p.campo = 'texto')
  select e.nombre, ru.nombre, t.rubro, t.texto || coalesce(' (' || t.medida || ')', ''),
         coalesce(cr.descripcion, co.descripcion, gt.detalle_txt(t.detalle)),
         t.desde, t.hasta, t.cantidad, ru.unidad, co.uxb,
         case when ru.unidad ilike 'cajas%' and co.uxb is not null then t.cantidad * co.uxb end, coalesce(t.auto, false),
         -- gt_v145: la familia, igual que el grupo del ritmo (gt_admin_ritmo2)
         case when nullif(btrim(t.texto), '') is not null and exists (select 1 from gt.codigo_area ca where ca.rubro = t.rubro)
              then coalesce(gt.grupo_tramo(t.texto, t.medida), 'Código ' || upper(btrim(t.texto))) end
    from tramos t join gt.empleados e on e.id = t.empleado_id join gt.rubros ru on ru.codigo = t.rubro
    left join gt.codigos co on t.rubro not in (select cp.rubro from conpaso cp) and upper(co.codigo) = upper(btrim(t.texto))
    left join gt.codigos_rubro cr on cr.rubro = t.rubro and upper(cr.codigo) = upper(btrim(t.texto))
   where gt.pass_ok(p_pass)
   order by gt.legajo_num(e.legajo) nulls last, e.nombre, t.desde;
$function$;

revoke all on function public.gt_admin_produccion3(text, date) from public;
grant execute on function public.gt_admin_produccion3(text, date) to anon, authenticated, service_role;

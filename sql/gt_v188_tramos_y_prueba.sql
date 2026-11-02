-- gt_v188 (02/11/2026): corregir a mano un tramo mal marcado y la «Persona de Prueba» de la Botonera del admin (Angely).
--   «Se marcó por error dos tareas al mismo tiempo: quiero la opción de editar y eliminar. Cuando se edite o elimine algún tiempo, el
--    programa debe volver a hacer los cálculos del tiempo de duración.»
--   «En la botonera del admin, un empleado de prueba que me permita probar todas las funciones y que lo que haga no se guarde. En las
--    tareas de a 2 personas que no pida que se sume la 2.ª.»
-- TRAMOS. Un tramo = dos filas de gt.registros: la apertura (ts_inicio NULL, ts_cliente = hora de inicio) y el cierre (ts_inicio = esa hora,
-- ts_cliente = hora de fin, cantidad). Producción, Ritmo, Rendimiento, Asistencia y el stock (gt.movimientos) se CALCULAN de esas filas cada vez que se
-- piden, así que al cambiar un horario o una cantidad la duración (neta de pausas) y todo lo demás se recalculan solos: no hay nada guardado aparte.
--   gt_admin_produccion4   = gt_admin_produccion3 + id_apertura / id_cierre (para saber qué tramo es)
--   gt_admin_tramo_editar  cambia desde / hasta (y la cantidad si el tramo está cerrado) · rechaza hasta <= desde, horas futuras y ids que no son del mismo tramo
--   gt_admin_tramo_eliminar el tramo deja de contar: opcion = 'AREAX' (la misma marca que usa el cierre del sistema reemplazado). NO se borra ninguna fila.
--   gt.registro_correcciones   cada edición / baja queda anotada con cómo estaba antes y cómo quedó (RLS: la lee sólo el servicio)
-- Todo exige la clave del monitor (gt.pass_ok). Sin ningún delete (el conector pide una confirmación aparte por cada borrado).
-- PERSONA DE PRUEBA: ya existía (gt.empleados.prueba, id 10, inactiva, en las dos plantas, sin registros). Ahora:
--   gt_empleado_prueba() la devuelve (la app la suma a la lista SOLO en modo vista: la Botonera del admin y la clave de vista) y
--   se le dan las áreas exclusivas de Javier (gt.empleado_rubro: ISIS, OP, FACT) para que vea TODAS las áreas. En modo vista nada se graba.
-- Rollback: update gt.registros set opcion = 'AREA' where id in (<los de gt.registro_correcciones.id_apertura / id_cierre>) para deshacer una baja, y volver a poner los
-- horarios de «antes» (jsonb) para deshacer una edición. Las funciones se pueden dejar: sin la pestaña no las llama nadie.
-- Sin punto y coma dentro de textos ni comentarios (el conector parte el pedido por esa marca).
create table if not exists gt.registro_correcciones (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  accion text not null check (accion in ('editar', 'eliminar')),
  empleado_id bigint,
  rubro text,
  texto text,
  id_apertura uuid,
  id_cierre uuid,
  antes jsonb not null,
  despues jsonb,
  nota text
);
alter table gt.registro_correcciones enable row level security;

create or replace function public.gt_admin_produccion4(p_pass text, p_dia date default null)
returns table (empleado text, area text, rubro text, codigo text, descripcion text, desde timestamptz, hasta timestamptz, cantidad numeric, unidad text,
               uxb integer, unidades numeric, auto boolean, familia text, id_apertura uuid, id_cierre uuid)
language sql stable security definer set search_path = ''
as $function$
  with par as (select coalesce(p_dia, (now() at time zone 'America/Argentina/Buenos_Aires')::date) d),
  hoy as (select r.* from gt.registros r, par
           where r.opcion = 'AREA' and r.rubro <> 'ALMU'
             and r.ts_cliente >= par.d::timestamp at time zone 'America/Argentina/Buenos_Aires'
             and r.ts_cliente <  (par.d + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),
  tramos as (
    select c.empleado_id, c.rubro, c.texto, c.medida, c.detalle, c.ts_inicio desde, c.ts_cliente hasta, c.cantidad, c.dispositivo = 'sistema:cierre' auto,
           (select a.id from gt.registros a where a.empleado_id = c.empleado_id and a.rubro = c.rubro and a.opcion = 'AREA' and a.ts_inicio is null
               and a.ts_cliente = c.ts_inicio limit 1) id_apertura, c.id id_cierre
      from hoy c where c.ts_inicio is not null
    union all
    select a.empleado_id, a.rubro, a.texto, a.medida, a.detalle, a.ts_cliente, null, null, false, a.id, null from hoy a
     where a.ts_inicio is null
       and not exists (select 1 from hoy c where c.empleado_id = a.empleado_id and c.rubro = a.rubro and c.ts_inicio = a.ts_cliente)),
  conpaso as (select distinct p.rubro from gt.rubro_pasos p where p.campo = 'texto')
  select e.nombre, ru.nombre, t.rubro, t.texto || coalesce(' (' || t.medida || ')', ''),
         coalesce(cr.descripcion, co.descripcion, gt.detalle_txt(t.detalle)),
         t.desde, t.hasta, t.cantidad, gt.unidad_area(t.rubro, t.texto), co.uxb,
         case when gt.unidad_area(t.rubro, t.texto) ilike 'cajas%' and co.uxb is not null then t.cantidad * co.uxb end, coalesce(t.auto, false),
         case when nullif(btrim(t.texto), '') is not null and exists (select 1 from gt.codigo_area ca where ca.rubro = t.rubro)
              then coalesce(gt.familia(t.rubro, t.texto, t.medida), 'Código ' || upper(btrim(t.texto))) end,
         t.id_apertura, t.id_cierre
    from tramos t join gt.empleados e on e.id = t.empleado_id join gt.rubros ru on ru.codigo = t.rubro
    left join gt.codigos co on t.rubro not in (select cp.rubro from conpaso cp) and upper(co.codigo) = upper(btrim(t.texto))
    left join gt.codigos_rubro cr on cr.rubro = t.rubro and upper(cr.codigo) = upper(btrim(t.texto))
   where gt.pass_ok(p_pass)
   order by gt.legajo_num(e.legajo) nulls last, e.nombre, t.desde;
$function$;

create or replace function public.gt_admin_tramo_editar(p_pass text, p_id_apertura uuid, p_id_cierre uuid, p_desde timestamptz, p_hasta timestamptz,
                                                          p_cantidad numeric default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare a gt.registros; c gt.registros; v_antes jsonb;
begin
  if not gt.pass_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'clave'); end if;
  select * into a from gt.registros where id = p_id_apertura and opcion = 'AREA' and ts_inicio is null;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_existe', 'mensaje', 'No encuentro ese tramo (puede que ya lo hayan cambiado)'); end if;
  if p_id_cierre is not null then
    select * into c from gt.registros where id = p_id_cierre and opcion = 'AREA' and ts_inicio = a.ts_cliente and empleado_id = a.empleado_id and rubro = a.rubro;
    if not found then return jsonb_build_object('ok', false, 'error', 'no_coincide', 'mensaje', 'El cierre no es de ese tramo (puede que ya lo hayan cambiado)'); end if;
  end if;
  if p_desde is null then return jsonb_build_object('ok', false, 'error', 'desde', 'mensaje', 'Falta la hora de inicio'); end if;
  if p_desde > now() + interval '2 minutes' then return jsonb_build_object('ok', false, 'error', 'futuro', 'mensaje', 'El inicio no puede ser en el futuro'); end if;
  if c.id is not null then
    if p_hasta is null or p_hasta <= p_desde then return jsonb_build_object('ok', false, 'error', 'orden', 'mensaje', 'El «hasta» tiene que ser después del «desde»'); end if;
    if p_hasta > now() + interval '2 minutes' then return jsonb_build_object('ok', false, 'error', 'futuro', 'mensaje', 'El fin no puede ser en el futuro'); end if;
    if p_cantidad is not null and p_cantidad < 0 then return jsonb_build_object('ok', false, 'error', 'cantidad', 'mensaje', 'La cantidad no puede ser negativa'); end if;
  end if;
  v_antes := jsonb_build_object('desde', a.ts_cliente, 'hasta', c.ts_cliente, 'cantidad', c.cantidad);
  update gt.registros set ts_cliente = p_desde where id = a.id;
  if c.id is not null then
    update gt.registros set ts_inicio = p_desde, ts_cliente = p_hasta, cantidad = coalesce(p_cantidad, cantidad) where id = c.id;
  end if;
  insert into gt.registro_correcciones (accion, empleado_id, rubro, texto, id_apertura, id_cierre, antes, despues, nota)
  values ('editar', a.empleado_id, a.rubro, a.texto, a.id, c.id, v_antes,
          jsonb_build_object('desde', p_desde, 'hasta', case when c.id is null then null else p_hasta end, 'cantidad', case when c.id is null then null else coalesce(p_cantidad, c.cantidad) end),
          'Admin GT');
  return jsonb_build_object('ok', true);
end $function$;

create or replace function public.gt_admin_tramo_eliminar(p_pass text, p_id_apertura uuid, p_id_cierre uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare a gt.registros; c gt.registros;
begin
  if not gt.pass_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'clave'); end if;
  select * into a from gt.registros where id = p_id_apertura and opcion = 'AREA' and ts_inicio is null;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_existe', 'mensaje', 'No encuentro ese tramo (puede que ya lo hayan cambiado)'); end if;
  if p_id_cierre is not null then
    select * into c from gt.registros where id = p_id_cierre and opcion = 'AREA' and ts_inicio = a.ts_cliente and empleado_id = a.empleado_id and rubro = a.rubro;
    if not found then return jsonb_build_object('ok', false, 'error', 'no_coincide', 'mensaje', 'El cierre no es de ese tramo (puede que ya lo hayan cambiado)'); end if;
  end if;
  update gt.registros set opcion = 'AREAX' where id = a.id;
  if c.id is not null then update gt.registros set opcion = 'AREAX' where id = c.id; end if;
  insert into gt.registro_correcciones (accion, empleado_id, rubro, texto, id_apertura, id_cierre, antes, despues, nota)
  values ('eliminar', a.empleado_id, a.rubro, a.texto, a.id, c.id,
          jsonb_build_object('desde', a.ts_cliente, 'hasta', c.ts_cliente, 'cantidad', c.cantidad), null, 'Admin GT: el tramo deja de contar (opcion AREAX)');
  return jsonb_build_object('ok', true);
end $function$;

create or replace function public.gt_empleado_prueba()
returns jsonb
language sql stable security definer set search_path = ''
as $function$
  select (select jsonb_build_object('id', e.id, 'nombre', '🧪 ' || e.nombre, 'legajo', null, 'prueba', true,
            'plantas', coalesce((select jsonb_agg(jsonb_build_object('codigo', p.codigo, 'nombre', p.nombre) order by p.orden, p.codigo)
                                   from gt.empleado_planta ep join gt.plantas p on p.codigo = ep.planta and p.activo where ep.empleado_id = e.id), '[]'::jsonb))
            from gt.empleados e where e.prueba order by e.id limit 1);
$function$;

-- que la persona de prueba vea TODAS las áreas: las exclusivas de Javier (gt.empleado_rubro dice de quién es un área)
insert into gt.empleado_rubro (empleado_id, rubro)
select e.id, r.rubro from gt.empleados e, (select distinct rubro from gt.empleado_rubro where empleado_id not in (select id from gt.empleados where prueba)) r
 where e.prueba
on conflict do nothing;

revoke all on function public.gt_admin_produccion4(text, date) from public;
revoke all on function public.gt_admin_tramo_editar(text, uuid, uuid, timestamptz, timestamptz, numeric) from public;
revoke all on function public.gt_admin_tramo_eliminar(text, uuid, uuid) from public;
revoke all on function public.gt_empleado_prueba() from public;
grant execute on function public.gt_admin_produccion4(text, date) to anon, authenticated;
grant execute on function public.gt_admin_tramo_editar(text, uuid, uuid, timestamptz, timestamptz, numeric) to anon, authenticated;
grant execute on function public.gt_admin_tramo_eliminar(text, uuid, uuid) to anon, authenticated;
grant execute on function public.gt_empleado_prueba() to anon, authenticated;

-- gt_v153 (02/10/2026): en Rendimiento la PAREJA se reparte las unidades SEGÚN EL TIEMPO de cada uno.
-- Pedido: *«le tiene que contar a los 2, como pareja, pero en proporción a lo que hicieron… es utilizar el tiempo»*.
-- Antes (gt_v151): el tramo de quien invitó (el que carga las cajas de los dos) se le COPIABA entero al que aceptó, y el
-- tiempo era sólo el de quien invitó menos SUS pausas. Si iba al baño quien invitó, se descontaba ese rato pero las cajas que
-- el compañero hizo solo seguían sumadas (la pareja salía 20 % más rápida); si iba el invitado, no se descontaba nada (20 %
-- más lenta). Además, una pareja salía al doble de rápida que quien trabaja solo en la misma fila.
-- Ahora:
-- · Tiempo de quien invitó = su tramo menos sus pausas (como siempre).
-- · Tiempo del que aceptó = lo que estuvo DENTRO del tramo de quien invitó (de su apertura con _invitado a su cierre, o al
--   cierre de quien invitó si es antes / si no cerró) menos SUS pausas.
-- · Las unidades se reparten en proporción a esos dos tiempos. Cada uno queda con (tiempo de los dos ÷ unidades) segundos por
--   unidad: lo que tarda una persona, comparable con quien trabaja solo. Deja sin efecto D47 («la pareja con los segundos
--   de la pareja, no al doble»).
-- · El mínimo de 2 min (D35) se mide sobre el tramo de quien invitó, antes de repartir.
-- ROLLBACK: volver a crear public.gt_admin_rendimiento con el cuerpo de sql/gt_v151_parejas.sql. gt.pausas_seg queda inocua.

-- Segundos de pausa (áreas no productivas: Baño, Movimiento, Almuerzo) que un operario tuvo DENTRO de [desde, hasta], sin
-- contar dos veces una pausa dentro de otra (gt_v149). Es la misma cuenta que estaba escrita adentro de gt_admin_rendimiento.
create or replace function gt.pausas_seg(p_emp bigint, p_desde timestamptz, p_hasta timestamptz) returns numeric
language sql stable set search_path to '' as $function$
  select coalesce(sum(extract(epoch from p.ts_cliente - p.ts_inicio)), 0)
    from gt.registros p join gt.rubros pr on pr.codigo = p.rubro and not pr.productivo
   where p.empleado_id = p_emp and p.opcion = 'AREA' and p.ts_inicio is not null
     and p.ts_inicio >= p_desde and p.ts_cliente <= p_hasta
     and not exists (select 1 from gt.registros q join gt.rubros qr on qr.codigo = q.rubro and not qr.productivo
                      where q.empleado_id = p.empleado_id and q.opcion = 'AREA' and q.ts_inicio is not null
                        and q.id <> p.id and q.ts_inicio <= p.ts_inicio and q.ts_cliente >= p.ts_cliente
                        and q.ts_inicio >= p_desde and q.ts_cliente <= p_hasta)
$function$;
revoke all on function gt.pausas_seg(bigint, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.gt_admin_rendimiento(p_pass text, p_desde date default null, p_hasta date default null)
 returns json
 language sql
 stable security definer
 set search_path to ''
as $function$
  with par as (select coalesce(p_hasta, (now() at time zone 'America/Argentina/Buenos_Aires')::date) h,
                      coalesce(p_desde, coalesce(p_hasta, (now() at time zone 'America/Argentina/Buenos_Aires')::date) - 27) d),
  base as (
    select c.id, c.empleado_id, c.rubro, c.ts_inicio ini, c.ts_cliente fin,
           coalesce(gt.variable_rendimiento(c.rubro, c.texto, c.medida),
                    case when coalesce(btrim(c.texto), '') = '' then 'Sin código' else 'Código ' || upper(btrim(c.texto)) end) variable,
           extract(epoch from c.ts_cliente - c.ts_inicio) - gt.pausas_seg(c.empleado_id, c.ts_inicio, c.ts_cliente) seg,
           case when ru.unidad ilike 'cajas%' and co.uxb is not null then c.cantidad * co.uxb else c.cantidad end u
      from gt.registros c
      join gt.rubros ru on ru.codigo = c.rubro
      left join gt.codigos co on upper(co.codigo) = upper(btrim(c.texto))
     where c.opcion = 'AREA' and c.ts_inicio is not null and c.cantidad is not null and c.cantidad > 0
       and c.rubro in ('CORTE', 'GRAMP', 'ENCOL', 'MONT', 'GANCHO', 'EMBL', 'CONTR')
       and c.ts_cliente >= (select d from par)::timestamp at time zone 'America/Argentina/Buenos_Aires'
       and c.ts_cliente <  ((select h from par) + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),
  comp as (
    select b.id, pa.para_id,
           greatest(0, extract(epoch from x.hasta - x.desde) - gt.pausas_seg(pa.para_id, x.desde, x.hasta)) seg
      from base b
      join gt.parejas pa on pa.de_id = b.empleado_id and pa.rubro = b.rubro and pa.ts = b.ini and pa.estado = 'aceptada'
      join lateral (
        select greatest(a.ts_cliente, b.ini) desde,
               least(coalesce((select min(k.ts_cliente) from gt.registros k
                                where k.empleado_id = a.empleado_id and k.opcion = 'AREA' and k.rubro = a.rubro
                                  and k.ts_inicio = a.ts_cliente), b.fin), b.fin) hasta
          from gt.registros a
         where a.empleado_id = pa.para_id and a.opcion = 'AREA' and a.ts_inicio is null and a.rubro = b.rubro
           and a.detalle->>'_invitado' = pa.id::text
         order by a.ts_cliente limit 1) x on x.hasta > x.desde),
  tr as (
    select b.empleado_id, b.rubro, b.variable, b.seg,
           case when c.seg is null or c.seg = 0 then b.u else b.u * b.seg / (b.seg + c.seg) end u
      from base b left join comp c on c.id = b.id
     where b.seg >= 120
    union all
    select c.para_id, b.rubro, b.variable, c.seg, b.u * c.seg / (b.seg + c.seg)
      from base b join comp c on c.id = b.id
     where b.seg >= 120 and c.seg > 0),
  ag as (
    select ru.nombre area, ru.codigo rubro, ru.orden, t.variable, e.nombre empleado, e.legajo,
           round(sum(t.u), 1) unidades, round(sum(t.seg)) segundos, count(*)::int tramos
      from tr t join gt.empleados e on e.id = t.empleado_id join gt.rubros ru on ru.codigo = t.rubro
     group by 1, 2, 3, 4, 5, 6)
  select case when gt.pass_ok(p_pass) then
    json_build_object('desde', (select d from par), 'hasta', (select h from par),
      'filas', coalesce((select json_agg(ag order by ag.orden, ag.variable, gt.legajo_num(ag.legajo) nulls last, ag.empleado) from ag), '[]'::json))
  end
$function$;

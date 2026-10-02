-- GT gt_v150 (Elías, 02/10/2026): «necesito que haya tablas por rendimiento dentro de la parte de análisis… dentro de la
-- tabla corte va a estar en una columna las diferentes variables y después una columna por persona» · «el rendimiento en
-- montaje, gancho, emblistado, contraído y encolado tiene que estar medido en cuántos segundos tardan por unidad».
-- Tablas: Corte, Grampeado, Encolado, Montaje, Gancho, Emblistado, Contraído (las de la lista de Elías).
-- · La VARIABLE (fila) de cada tabla, con lo propuesto en D46 mientras Elías no diga otra cosa:
--     Corte      → la moldura de la pieza (03, 05, 012, 3P 1/2, 3P 3/4, 045, Trav 20mm: el prefijo, como gt.molduras)
--     Grampeado  → moldura + medida del aro, sin el color («03 · 27.5*40»)
--     el resto   → la familia (gt.familia: moldura + medida; en Encolado sólo la medida, gt_v146)
-- · Unidades: cajas × UxB en las áreas de producto; piezas / aros en Corte y Grampeado.
-- · Segundos NETOS: cada tramo menos sus pausas (Baño, Movimiento), sin contar dos veces una pausa dentro de otra (gt_v149).
-- · Cuentan los tramos cerrados con cantidad y 2 min o más netos (D35). Las parejas (D45/D47) todavía no: cada uno con lo suyo.
-- · Devuelve json en UNA fila (la API corta en 1.000 filas: gt_v148).
-- ROLLBACK: sacar la pestaña del admin; la función queda inocua.

create or replace function gt.variable_rendimiento(p_rubro text, p_texto text, p_medida text)
returns text language sql stable security definer set search_path to '' as $function$
  select case
    when p_rubro = 'CORTE' then
      (select 'Mold ' || (regexp_match(k.descripcion, '^(3P \d/\d|Trav \d+mm|\d+)'))[1]
         from gt.codigos_rubro k where k.rubro = 'CORTE' and upper(k.codigo) = upper(btrim(p_texto)) limit 1)
    when p_rubro = 'GRAMP' then
      (select 'Mold ' || (regexp_match(k.descripcion, '^(3P \d/\d|Trav \d+mm|\d+)'))[1] || coalesce(' · ' || k.medida, '')
         from gt.codigos_rubro k where k.rubro = 'GRAMP' and upper(k.codigo) = upper(btrim(p_texto)) limit 1)
    else gt.familia(p_rubro, p_texto, p_medida) end
$function$;
revoke all on function gt.variable_rendimiento(text, text, text) from public, anon, authenticated;

create or replace function public.gt_admin_rendimiento(p_pass text, p_desde date default null, p_hasta date default null)
returns json language sql stable security definer set search_path to '' as $function$
  with par as (select coalesce(p_hasta, (now() at time zone 'America/Argentina/Buenos_Aires')::date) h,
                      coalesce(p_desde, coalesce(p_hasta, (now() at time zone 'America/Argentina/Buenos_Aires')::date) - 27) d),
  tr as (
    select c.empleado_id, c.rubro,
           coalesce(gt.variable_rendimiento(c.rubro, c.texto, c.medida),
                    case when coalesce(btrim(c.texto), '') = '' then 'Sin código' else 'Código ' || upper(btrim(c.texto)) end) variable,
           extract(epoch from c.ts_cliente - c.ts_inicio) - coalesce(pz.seg, 0) seg,
           case when ru.unidad ilike 'cajas%' and co.uxb is not null then c.cantidad * co.uxb else c.cantidad end u
      from gt.registros c
      join gt.rubros ru on ru.codigo = c.rubro
      left join gt.codigos co on upper(co.codigo) = upper(btrim(c.texto))
      left join lateral (select sum(extract(epoch from p.ts_cliente - p.ts_inicio)) seg
                           from gt.registros p join gt.rubros pr on pr.codigo = p.rubro and not pr.productivo
                          where p.empleado_id = c.empleado_id and p.opcion = 'AREA' and p.ts_inicio is not null
                            and p.ts_inicio >= c.ts_inicio and p.ts_cliente <= c.ts_cliente
                            and not exists (select 1 from gt.registros q join gt.rubros qr on qr.codigo = q.rubro and not qr.productivo
                                             where q.empleado_id = p.empleado_id and q.opcion = 'AREA' and q.ts_inicio is not null
                                               and q.id <> p.id and q.ts_inicio <= p.ts_inicio and q.ts_cliente >= p.ts_cliente
                                               and q.ts_inicio >= c.ts_inicio and q.ts_cliente <= c.ts_cliente)) pz on true
     where c.opcion = 'AREA' and c.ts_inicio is not null and c.cantidad is not null and c.cantidad > 0
       and c.rubro in ('CORTE', 'GRAMP', 'ENCOL', 'MONT', 'GANCHO', 'EMBL', 'CONTR')
       and c.ts_cliente >= (select d from par)::timestamp at time zone 'America/Argentina/Buenos_Aires'
       and c.ts_cliente <  ((select h from par) + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),
  ag as (
    select ru.nombre area, ru.codigo rubro, ru.orden, t.variable, e.nombre empleado, e.legajo,
           sum(t.u) unidades, round(sum(t.seg)) segundos, count(*)::int tramos
      from tr t join gt.empleados e on e.id = t.empleado_id join gt.rubros ru on ru.codigo = t.rubro
     where t.seg >= 120
     group by 1, 2, 3, 4, 5, 6)
  select case when gt.pass_ok(p_pass) then
    json_build_object('desde', (select d from par), 'hasta', (select h from par),
      'filas', coalesce((select json_agg(ag order by ag.orden, ag.variable, gt.legajo_num(ag.legajo) nulls last, ag.empleado) from ag), '[]'::json))
  end
$function$;
revoke all on function public.gt_admin_rendimiento(text, date, date) from public;
grant execute on function public.gt_admin_rendimiento(text, date, date) to anon, authenticated, service_role;

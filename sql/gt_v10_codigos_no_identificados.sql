-- GT v10.0 (01/10/2026) — APLICADO. Códigos que los operarios registraron sin estar en la lista de su área.
-- Consulta: select * from gt.codigos_no_identificados order by ultima desc;
-- Rollback: drop view gt.codigos_no_identificados;
create or replace view gt.codigos_no_identificados with (security_invoker = true) as
select r.rubro, upper(btrim(r.texto)) codigo, count(*) veces,
       min(r.ts_cliente) primera, max(r.ts_cliente) ultima,
       string_agg(distinct e.nombre, ', ') quienes
  from gt.registros r join gt.empleados e on e.id = r.empleado_id
 where r.opcion = 'AREA' and coalesce(btrim(r.texto), '') <> ''
   and exists (select 1 from public.gt_codigos_area() l where l.rubro = r.rubro)
   and not exists (select 1 from public.gt_codigos_area() l
                    where l.rubro = r.rubro
                      and regexp_replace(upper(l.codigo), '^0+(?=\d)', '') = regexp_replace(upper(btrim(r.texto)), '^0+(?=\d)', ''))
 group by 1, 2;
revoke all on gt.codigos_no_identificados from anon, authenticated;

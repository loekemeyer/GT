-- gt_v170 (Thomas, 08/10/2026): «cuando encolan artículos de deco se anotan unidades y cuando encolan artículos de cuadro se
-- encolan cajas. Hay que hacer esa norma de separación».
-- · gt.codigo_area.unidad (text): la unidad en que se cuenta ESE código en ESA área. Vacía = la del área (gt.rubros.unidad).
--   Hoy: los 47 de deco de Encolado (todo lo que no es Cuadro / Cuadros / Porta / Diploma, la misma separación de gt_v154)
--   → 'unidades encoladas'. Cuadros, portas 220 a 224 y diplomas siguen en 'cajas encoladas'.
-- · gt.unidad_area(área, código): la unidad que rige. La usan el celular (gt_codigos_area2 manda «unidad»), Producción del
--   admin (gt_admin_produccion3), Ritmo (gt_admin_ritmo2), Rendimiento (gt_admin_rendimiento), gt.produccion y
--   gt.movimientos: un tramo en unidades NO se multiplica por la UxB.
-- · Otro código o área igual: update gt.codigo_area set unidad = 'unidades …' where rubro = '…' and codigo = '…'.
-- Rollback: update gt.codigo_area set unidad = null where rubro = 'ENCOL' (con eso todo vuelve a contar cajas: la función
--   cae a la unidad del área). Las funciones pueden quedar como están.
-- ⚠ Lo cargado antes de hoy en Encolado de deco (si alguien anotó unidades) se lee desde ahora como unidades: es lo que
--   pidió Thomas («la realidad es que…»). Medido: 0 tramos de deco en Encolado antes del 08/10 (ver el SELECT al final).

alter table gt.codigo_area add column if not exists unidad text;
comment on column gt.codigo_area.unidad is 'gt_v170: la unidad en que se cuenta este código en esta área (vacía = gt.rubros.unidad). Deco en Encolado = unidades encoladas.';

update gt.codigo_area a set unidad = 'unidades encoladas'
  from gt.codigos c
 where c.codigo = a.codigo and a.rubro = 'ENCOL' and a.unidad is null
   and c.descripcion !~* '^\s*(cuadros?|porta|diploma)';

create or replace function gt.unidad_area(p_rubro text, p_codigo text)
 returns text
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(
    (select ca.unidad from gt.codigo_area ca
      where ca.rubro = p_rubro and ca.unidad is not null and gt.sin0(ca.codigo) = gt.sin0(btrim(p_codigo)) limit 1),
    (select r.unidad from gt.rubros r where r.codigo = p_rubro limit 1));
$function$;

create or replace function public.gt_codigos_area2()
 returns json
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(json_agg(x order by x.rubro, x.codigo), '[]'::json) from (
    select c.codigo, c.descripcion, c.medida, a.rubro, null::text[] as articulos, a.unidad
      from gt.codigos c join gt.codigo_area a on a.codigo = c.codigo and a.activo
     where c.activo
    union all
    select k.codigo, k.descripcion, k.medida, k.rubro, k.articulos, null::text from gt.codigos_rubro k where k.activo
  ) x;
$function$;

-- las 5 lecturas: se parte de la definición VIVA y se cambia sólo la unidad (cada reemplazo tiene que aparecer las veces esperadas)
do $v$
declare
  d text; n int;
begin
  -- 1) gt_admin_produccion3
  d := pg_get_functiondef('public.gt_admin_produccion3(text,date)'::regprocedure);
  n := (length(d) - length(replace(d, 't.cantidad, ru.unidad, co.uxb,', ''))) / length('t.cantidad, ru.unidad, co.uxb,');
  if n <> 1 then raise exception 'produccion3: % veces la unidad', n; end if;
  d := replace(d, 't.cantidad, ru.unidad, co.uxb,', 't.cantidad, gt.unidad_area(t.rubro, t.texto), co.uxb,');
  d := replace(d, 'case when ru.unidad ilike ''cajas%'' and co.uxb is not null then t.cantidad',
                  'case when gt.unidad_area(t.rubro, t.texto) ilike ''cajas%'' and co.uxb is not null then t.cantidad');
  if position('ru.unidad ilike' in d) > 0 then raise exception 'produccion3: quedó un ru.unidad ilike'; end if;
  execute d;
  -- 2) gt_admin_rendimiento
  d := pg_get_functiondef('public.gt_admin_rendimiento(text,date,date)'::regprocedure);
  n := (length(d) - length(replace(d, 'case when ru.unidad ilike ''cajas%''', ''))) / length('case when ru.unidad ilike ''cajas%''');
  if n <> 1 then raise exception 'rendimiento: % veces', n; end if;
  execute replace(d, 'case when ru.unidad ilike ''cajas%''', 'case when gt.unidad_area(c.rubro, c.texto) ilike ''cajas%''');
  -- 3) gt_admin_ritmo2
  d := pg_get_functiondef('public.gt_admin_ritmo2(text,date)'::regprocedure);
  n := (length(d) - length(replace(d, 'case when ru.unidad ilike ''cajas%''', ''))) / length('case when ru.unidad ilike ''cajas%''');
  if n <> 2 then raise exception 'ritmo2: % veces', n; end if;
  d := replace(d, 'case when ru.unidad ilike ''cajas%''', 'case when gt.unidad_area(c.rubro, c.texto) ilike ''cajas%''');
  if position('else ru.unidad end u' in d) = 0 then raise exception 'ritmo2: no está el else ru.unidad'; end if;
  execute replace(d, 'else ru.unidad end u', 'else gt.unidad_area(c.rubro, c.texto) end u');
  -- 4) gt.produccion
  d := pg_get_viewdef('gt.produccion'::regclass, true);
  if position(E'ru.unidad,\n    c.uxb,' in d) = 0 or position('WHEN ru.unidad ~~* ''cajas%''::text' in d) = 0 then
    raise exception 'produccion: no está lo esperado';
  end if;
  d := replace(d, E'ru.unidad,\n    c.uxb,', E'gt.unidad_area(r.rubro, r.texto) AS unidad,\n    c.uxb,');
  d := replace(d, 'WHEN ru.unidad ~~* ''cajas%''::text', 'WHEN gt.unidad_area(r.rubro, r.texto) ~~* ''cajas%''::text');
  execute 'create or replace view gt.produccion with (security_invoker = true) as ' || d;
  -- 5) gt.movimientos (security_invoker): un tramo en unidades no se multiplica por la UxB
  d := pg_get_viewdef('gt.movimientos'::regclass, true);
  n := (length(d) - length(replace(d, 'r.cantidad * COALESCE(c.uxb, 1)::numeric AS u', ''))) / length('r.cantidad * COALESCE(c.uxb, 1)::numeric AS u');
  if n <> 1 then raise exception 'movimientos: % veces', n; end if;
  execute 'create or replace view gt.movimientos with (security_invoker = true) as ' || replace(d,
    'r.cantidad * COALESCE(c.uxb, 1)::numeric AS u',
    'r.cantidad * CASE WHEN gt.unidad_area(r.area, r.texto) ~~* ''unidades%''::text THEN 1 ELSE COALESCE(c.uxb, 1) END::numeric AS u');
end $v$;

-- verificación
-- select a.codigo, c.descripcion, a.unidad from gt.codigo_area a join gt.codigos c using (codigo) where a.rubro = 'ENCOL' and a.unidad is not null order by 1;
-- select count(*) from gt.registros r where r.rubro = 'ENCOL' and r.ts_inicio is not null and gt.unidad_area(r.rubro, r.texto) ilike 'unidades%';

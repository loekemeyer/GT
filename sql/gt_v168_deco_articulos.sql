-- gt_v168 — un código de Deco que sirve para varios artículos pregunta cuál se fabrica (Thomas, 08/10/2026)
-- Pedido: «456, 536, 818, 534 usan el 3080. Cuando ponen 3080, debe preguntar qué código va a fabricar».
-- · gt.codigos_rubro.articulos (text[]): con 2 o más, el celular pregunta «¿Qué artículo vas a fabricar?» con un botón
--   por artículo y lo guarda en gt.registros.detalle.articulo (apertura y cierre). Vacía = no pregunta (como hasta hoy).
-- · gt_codigos_area2 (misma firma) suma la clave «articulos» a cada fila. gt_codigos_area queda igual (cambiar sus
--   columnas pide DROP): un celular que cae a la 1 no pregunta.
-- Otro código igual: update gt.codigos_rubro set articulos = array['…','…'] where rubro = 'DECO' and codigo = '…';
-- Rollback: update gt.codigos_rubro set articulos = null · gt_codigos_area2 con el cuerpo de antes
--   (select coalesce(json_agg(x), '[]'::json) from public.gt_codigos_area() x).

alter table gt.codigos_rubro add column if not exists articulos text[];

update gt.codigos_rubro
   set articulos = array['456', '536', '818', '534'],
       descripcion = 'Armado Bandeja — 456/536/818/534 Bandeja 13x30'
 where rubro = 'DECO' and codigo = '3080';

create or replace function public.gt_codigos_area2()
 returns json
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(json_agg(x order by x.rubro, x.codigo), '[]'::json) from (
    select c.codigo, c.descripcion, c.medida, a.rubro, null::text[] as articulos
      from gt.codigos c join gt.codigo_area a on a.codigo = c.codigo and a.activo
     where c.activo
    union all
    select k.codigo, k.descripcion, k.medida, k.rubro, k.articulos from gt.codigos_rubro k where k.activo
  ) x;
$function$;

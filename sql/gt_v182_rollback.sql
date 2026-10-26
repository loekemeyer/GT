-- Rollback de gt_v182 (cajas armadas como stock). Sin punto y coma dentro de textos ni comentarios.
-- 1) gt.movimientos: saca las dos ramas caja_armada de la definición viva
do $mov$
declare
  v  text := pg_get_viewdef('gt.movimientos'::regclass, true);
  s  int  := position(E'\n        UNION ALL\n         SELECT r.registro_id,\n            r.ts,\n            r.dia,\n            r.empleado_id,\n            r.planta,\n            r.area,\n            ''caja_armada''::text AS text' in v);
  fin text := E'          WHERE rp.area = ''CONTR''::text';
  e  int  := position(fin || E'\n        )\n SELECT registro_id' in v);
begin
  if s = 0 or e = 0 or e < s then
    raise exception 'gt.movimientos: no se encontraron las ramas caja_armada (s=%, e=%)', s, e;
  end if;
  execute 'create or replace view gt.movimientos as ' || left(v, s - 1) || substring(v from e + length(fin));
  alter view gt.movimientos set (security_invoker = true);
end
$mov$;

-- 2) gt.stock: saca la unidad «cajas»
do $stk$
declare
  v text := pg_get_viewdef('gt.stock'::regclass, true);
begin
  execute 'create or replace view gt.stock as ' || replace(v, E'\n            WHEN ''caja_armada''::text THEN ''cajas''::text', '');
  alter view gt.stock set (security_invoker = true);
end
$stk$;

-- 3) la caja plana deja de descontarse al armar, y el catálogo queda inactivo (el conector no deja DELETE)
update gt.codigos_rubro set insumo = null, insumo_cant = null where rubro = 'ARMCAJ';
update gt.insumos set activo = false where codigo like 'CAJA %';

-- 4) gt.demanda_cajas: se puede dejar (queda vacía de movimientos) o borrarla desde el SQL Editor con
--    drop view gt.demanda_cajas

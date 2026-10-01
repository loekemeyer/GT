-- GT v1.7 — APLICADO el 2026-10-01. Thomas: «ordená a los empleados por número de legajo».
-- gt.legajo_num('t95') = 95. Ordenan así: la lista de nombres del celular (gt_clave_validar, que además
-- devuelve el legajo), Asistencia (gt_admin_asistencia) y Producción (gt_admin_produccion).
-- Sin legajo, al final por nombre. Verificado: t48 Walter · t81 Juan · t95 Javier · t107 Dario · t148 Ximena
-- · t157 Luis · t161 Lautaro · t172 David · t174 Federico.
create or replace function gt.legajo_num(p text) returns int language sql immutable set search_path to ''
as $$ select nullif(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '')::int $$;
revoke all on function gt.legajo_num(text) from public, anon, authenticated;
-- Las tres RPC: mismo cuerpo que v15 / v10, con el ORDER BY cambiado a
--   order by gt.legajo_num(e.legajo) nulls last, e.nombre
-- Definición viva: select pg_get_functiondef('public.gt_clave_validar(text)'::regprocedure); (ídem las otras dos)

-- GT gt_v148 (Elías, 02/10/2026: «estoy en guardado y no me aparece nada al poner 224»).
-- La API de Supabase (PostgREST) corta cada respuesta en 1.000 filas. gt_codigos_area() devuelve 2.273 (317 productos en 6
-- áreas + los propios de Corte, Grampeado, Deco y Recibir), ordenadas por área: al celular le llegaban Contraído, Corte,
-- Deco, Emblistado y 127 de los 317 de Encolado, y NADA de Gancho, Grampeado, Guardado, Montaje ni Recibir. En esas áreas
-- no se mostraba qué producto era lo tipeado, no se preguntaba «¿Lo registro igual?» y Montaje / Gancho no preguntaban la
-- medida de un set de 3 (el aviso de Telegram por código no registrado sí andaba: lo hace la base). Desde el 01/10, cuando
-- se cargaron los 323 productos en las áreas; medido el 02/10: 7 aperturas con código en esas áreas, ningún set.
-- gt_codigos_area2 devuelve la misma lista en UNA sola fila (json): 26 KB comprimido. La app 1.35 la usa y, si falla, la 1.
-- ROLLBACK: la app vuelve a la 1 sola; la 2 queda inocua (o la borra el dueño en el SQL Editor).
create or replace function public.gt_codigos_area2()
 returns json language sql stable security definer set search_path to ''
as $function$
  select coalesce(json_agg(x), '[]'::json) from public.gt_codigos_area() x;
$function$;
revoke all on function public.gt_codigos_area2() from public;
grant execute on function public.gt_codigos_area2() to anon, authenticated, service_role;

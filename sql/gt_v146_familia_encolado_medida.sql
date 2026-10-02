-- GT gt_v146 (Elías, 02/10/2026: «cuando se hace encolado la moldura no es un factor, solamente la medida»).
-- La familia (grupo de fabricación de 1.15/1.16: moldura + medida, «en cualquier proceso», Thomas) pasa a depender del
-- ÁREA: un área con gt.rubros.familia_sin_moldura = true agrupa sólo por medida. Hoy, sólo Encolado. Ej.: el 173 (Mold 03)
-- y el 224 (Mold 30mm) quedan en «10*30» y «30*40» en Encolado; en Montaje siguen «Mold 03 · 10*30» y «Mold 30mm · 30*40».
-- Un set de 3 en esas áreas: «Set x3 · 15*21 + 20*30 + 30*40» (sin moldura). Pasar otra área a «sólo medida» es un update.
-- Lo usan el ritmo (gt_admin_ritmo2, también el promedio de 4 semanas, que se recalcula solo) y Producción del admin
-- (gt_admin_produccion3). Las recetas de insumos por grupo (gt.producto_insumo, gt.demanda_producto) no cambian.
-- ROLLBACK: update gt.rubros set familia_sin_moldura = false where codigo = 'ENCOL';   (todo vuelve a moldura + medida)

alter table gt.rubros add column if not exists familia_sin_moldura boolean not null default false;
comment on column gt.rubros.familia_sin_moldura is 'gt_v146 (Elías 02/10): true = en esta área la familia es sólo la medida (la moldura no cambia la demora). Hoy: ENCOL.';
update gt.rubros set familia_sin_moldura = true where codigo = 'ENCOL';

create or replace function gt.familia(p_rubro text, p_codigo text, p_medida text)
returns text language sql stable security definer set search_path to '' as $function$
  select case
    when coalesce((select r.familia_sin_moldura from gt.rubros r where r.codigo = p_rubro), false) then
      coalesce(nullif(btrim(p_medida), ''),   -- la medida elegida de un set (Montaje / Gancho, 1.17)
        (select case when coalesce(btrim(c.medida), '') = '' then null
                     when gt.es_set3(c.descripcion) then 'Set x3 · ' ||
                       (select string_agg(btrim(x), ' + ' order by btrim(x)) from unnest(string_to_array(c.medida, '+')) x)
                     else btrim(c.medida) end
           from gt.codigos c where upper(c.codigo) = upper(btrim(p_codigo))))
    else gt.grupo_tramo(p_codigo, p_medida) end
$function$;
revoke all on function gt.familia(text, text, text) from public, anon, authenticated;

-- el ritmo y Producción: sólo cambia la llamada que arma la familia, sobre la definición VIVA de cada una
do $parche$
begin
  execute replace(pg_get_functiondef('public.gt_admin_ritmo2(text,date)'::regprocedure),
                  'gt.grupo_tramo(c.texto, c.medida)', 'gt.familia(c.rubro, c.texto, c.medida)');
  execute replace(pg_get_functiondef('public.gt_admin_produccion3(text,date)'::regprocedure),
                  'gt.grupo_tramo(t.texto, t.medida)', 'gt.familia(t.rubro, t.texto, t.medida)');
end $parche$;

-- verificación: las dos tienen que llamar a gt.familia y ya no a gt.grupo_tramo
-- select proname, prosrc like '%gt.familia(%' usa_familia, prosrc like '%grupo_tramo%' usa_grupo_tramo
--   from pg_proc where proname in ('gt_admin_ritmo2', 'gt_admin_produccion3');

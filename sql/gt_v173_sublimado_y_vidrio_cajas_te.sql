-- gt_v173 (Thomas, 21/10/2026): D3 «sí» (códigos de Sublimado) + D4 (qué vidrio lleva cada producto).
--
-- 1) Tablero «Codigos Sublimado»: 24 códigos 5101-5124 en Deco, «Sublimado <moldura> — <artículo>». Los de artículos
--    discontinuados (563J, 564J y el Cartel 302, D64) entran apagados. El 307 Arbolito va con moldura 012, como el tablero.
--    No mueven stock. El 5101 / 5102 / 5103 ya se venían tipeando fuera de la lista (Juan Gimenez y Darío Mendez).
-- 2) D4 de Thomas:
--    · 224 Porta Gigante Mold 30mm 30*40 → VIDRIO 29*40 (código 2007). Receta por producto en Montaje, con el FONDO de la regla 7.
--    · 227 Cuadro Vintage c/Vidrio 20*30 → VIDRIO 20*30: ya lo daba la regla 6, no cambia.
--    · 15*37 (2012) discontinuo: se apaga el código y el insumo.
--    · 8.5*23 → 661, 17.5*23 → 662, 23*26.5 → 663 (Cajas de Té). Las Cajas de Té NO pasan por Montaje: se arman en Deco
--      (nunca se registró un 661-663 en Montaje). El vidrio se descuenta al cerrar «Panal + Bastidor + Tapa c/Bisagras»
--      (3084 / 3086 / 3088), uno por caja [Probable: el vidrio va en la tapa].
--      Para eso gt.codigos_rubro.insumo_cant: cuánto mueve el insumo por unidad del tramo (vacío = +1, lo produce;
--      -1 = lo consume). gt.movimientos multiplica la cantidad por ese número.
-- 3) D5 «no»: no hay conteo inicial de vidrio. El stock queda con los movimientos solos (arranca negativo).
--
-- Rollback:
--   update gt.codigos_rubro set activo = false where rubro = 'DECO' and codigo between '5101' and '5124';
--   update gt.codigos_rubro set insumo = null, insumo_cant = null where rubro = 'DECO' and codigo in ('3084','3086','3088');
--   update gt.insumo_receta set activo = false where fuente = 'gt_v173';
--   update gt.codigos_rubro set activo = true where rubro = 'DECO' and codigo = '2012';

insert into gt.codigos_rubro (rubro, codigo, descripcion, medida, activo, articulos)
select 'DECO', c, d, null, a, null from (values
 ('5101', 'Sublimado Pareja 045 — 563 Cajón 2 Tablas 15*21', true),
 ('5102', 'Sublimado 100 — 563 Cajón 2 Tablas 15*21', true),
 ('5103', 'Sublimado Pareja 045 — 564 Cajón 2 Tablas 20*30', true),
 ('5104', 'Sublimado 100 — 564 Cajón 2 Tablas 20*30', true),
 ('5105', 'Sublimado Pareja 045 — 565 Cajón 2 Tablas 25*35', true),
 ('5106', 'Sublimado 100 — 565 Cajón 2 Tablas 25*35', true),
 ('5107', 'Sublimado Pareja 045 — 563J Cajón 2 Tablas 15*21', false),
 ('5108', 'Sublimado 100 — 563J Cajón 2 Tablas 15*21', false),
 ('5109', 'Sublimado Pareja 045 — 564J Cajón 2 Tablas 20*30', false),
 ('5110', 'Sublimado 100 — 564J Cajón 2 Tablas 20*30', false),
 ('5111', 'Sublimado 100 — 573 Cajón Cuadrado', true),
 ('5112', 'Sublimado 100 — 578 Cajón Cuadrado', true),
 ('5113', 'Sublimado 012 — 307 Arbolito', true),
 ('5114', 'Sublimado 045 — 302 Cartel 045', false),
 ('5115', 'Sublimado 70mm — 303 Cartel 4 Tablas', true),
 ('5116', 'Sublimado 100 — 615 Servilletero', true),
 ('5117', 'Sublimado Aro Vintage 10*15', true),
 ('5118', 'Sublimado Aro Vintage 13*18', true),
 ('5119', 'Sublimado Aro Decapado 10*15', true),
 ('5120', 'Sublimado Aro Decapado 13*18', true),
 ('5121', 'Sublimado Aro Decapado 15*21', true),
 ('5122', 'Sublimado 100 — 574 Cajón Rectangular', true),
 ('5123', 'Sublimado 100 — 577 Cajón Rectangular', true),
 ('5124', 'Sublimado 100 — 579 Cajón Estante', true)) v(c, d, a)
on conflict do nothing;

alter table gt.codigos_rubro add column if not exists insumo_cant numeric;
comment on column gt.codigos_rubro.insumo_cant is
  'gt_v173: cuánto mueve el insumo por unidad del tramo. Vacío = +1 (lo produce, ej. Corte Vidrio). -1 = lo consume (ej. 3084 Caja de Té)';

-- gt.movimientos: sobre la definición VIVA, la rama de gt_v172 pasa a multiplicar por insumo_cant
do $v$
declare d text; n int;
  ancla constant text := 'cri.insumo,' || chr(10) || '            NULL::text AS text,' || chr(10) || '            r.cantidad,';
begin
  d := pg_get_viewdef('gt.movimientos'::regclass, true);
  if position('cri.insumo_cant' in d) > 0 then raise notice 'gt_v173 ya aplicada'; return; end if;
  n := (length(d) - length(replace(d, ancla, ''))) / length(ancla);
  if n <> 1 then raise exception 'movimientos: el ancla aparece % veces', n; end if;
  execute 'create or replace view gt.movimientos with (security_invoker = true) as ' || replace(d, ancla,
    'cri.insumo,' || chr(10) || '            NULL::text AS text,' || chr(10) || '            r.cantidad * COALESCE(cri.insumo_cant, 1::numeric),');
end $v$;

update gt.codigos_rubro set insumo = 'VIDRIO 8.5*23',   insumo_cant = -1 where rubro = 'DECO' and codigo = '3084';
update gt.codigos_rubro set insumo = 'VIDRIO 17.5*23',  insumo_cant = -1 where rubro = 'DECO' and codigo = '3086';
update gt.codigos_rubro set insumo = 'VIDRIO 23*26.5',  insumo_cant = -1 where rubro = 'DECO' and codigo = '3088';

update gt.codigos_rubro set activo = false where rubro = 'DECO' and codigo = '2012';
update gt.insumos set activo = false, nota = nota || ' · discontinuo (Thomas 21/10)' where codigo = 'VIDRIO 15*37' and activo;

insert into gt.insumo_receta (nivel, codigo, insumo, cantidad, etapa, fuente, nota, activo, por_pieza)
select 'producto', p, i, c, 'MONT', 'gt_v173', n, true, false from (values
  ('224', 'VIDRIO 29*40', 1, 'Thomas 21/10 (D4): el 224 lleva el vidrio de 29*40'),
  ('224', 'FONDO 30*40', 1, '[Adivinando] regla 7')) v(p, i, c, n)
where not exists (select 1 from gt.insumo_receta x where x.fuente = 'gt_v173' and x.codigo = v.p and x.insumo = v.i);

-- verificación
-- select codigo, descripcion, activo, insumo, insumo_cant from gt.codigos_rubro where rubro = 'DECO' and (codigo like '51%' or insumo is not null) order by 1;
-- select codigo, saldo from gt.stock where codigo like 'VIDRIO%' order by 1;

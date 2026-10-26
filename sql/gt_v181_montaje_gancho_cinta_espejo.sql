-- gt_v181 (26/10/2026): cartel de Montaje → 3 códigos nuevos. Formato «Operación — artículo», como Deco.
-- Van a MONT y no a DECO porque es donde se tipean: el 3046 entró 6 veces fuera de lista en Montaje entre el 16/10 y
-- el 26/10 (Federico Realini, Lautaro Durante). Montaje suma esta lista a la de productos (gt_codigos_area2 une las
-- dos por área), así que los 331 productos siguen igual. No mueven stock.
-- Rollback: update gt.codigos_rubro set activo = false where rubro = 'MONT' and codigo in ('3045','3046','3047');
insert into gt.codigos_rubro (rubro, codigo, descripcion, medida, activo) values
 ('MONT','3045','Colocar Cinta Moj y Gancho — 237 Cuadro Mold 30mm Vintage',null,true),
 ('MONT','3046','Colocado 1 Gancho XCL — Espejo',null,true),
 ('MONT','3047','Colocado 2 Gancho XCL — Espejo',null,true)
on conflict (rubro, codigo) do nothing;

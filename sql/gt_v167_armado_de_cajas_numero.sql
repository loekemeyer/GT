-- 1.67 (Thomas, 19/10/2026): «Ahí debería preguntar qué número de caja va a armar», con la lista del tablero «Num Caja».
-- Armado de cajas (ARMCAJ, hija de Contraído desde la 1.64) pasa a pedir el código ANTES de empezar, como Corte o Deco.
-- Los 22 números van a gt.codigos_rubro (códigos propios de un rubro), NO a gt.codigo_area (ésa es para los 331 productos):
-- un «2» de caja no es el producto 2. La app los muestra como botones porque 7 de los 22 son texto («Caja Notebook») y no
-- se pueden tipear con el teclado numérico.
-- ⚠ No mueve stock: gt.movimientos sólo cruza codigos_rubro con CORTE y GRAMP, y los productos con las 6 áreas de producto.
-- Rollback: delete from gt.codigos_rubro where rubro = 'ARMCAJ';
--           update gt.rubros set pide_codigo = false where codigo = 'ARMCAJ';
insert into gt.codigos_rubro (rubro, codigo, descripcion, medida, activo, articulos)
select 'ARMCAJ', c, null, null, true, null
  from unnest(array['2','5','10','12','13','14','15','16','22','29','30',
                    '20*50','38*38','40*15','40*50',
                    'Caja Cuadros Set','Caja Notebook','Exhi 2 Porta','Exhi 3 Porta','Exhi Cuadro','IMP','Tapa + Base']) as c
on conflict do nothing;

update gt.rubros set pide_codigo = true where codigo = 'ARMCAJ';

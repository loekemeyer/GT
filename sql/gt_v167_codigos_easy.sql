-- gt_v167 (Thomas, 05/10/2026: lista «Artículos de Easy · venta jun-26 hasta sep-26», «agregá todos estos»).
-- De los 34 de la lista, 28 ya estaban. Faltaban 6, todos con venta en TN (gt.consumo_tn) y sin ficha en GT.
-- [Probable] Mold 03 y UxB 16 (los cuadros 30*40 del 394 al 428 son todos Mold 03 x16) · los sets, UxB 8 como los Set x3.
-- [Adivinando] el Set x2 (470): medida «30*40 + 30*40» y UxB 8. Sin color de marco: no descuentan aro hasta cargarlo.
-- NO se tocan: 420 (Easy: «Coral 30*40», la base: «Wine 20*30») y 457 (Easy: «Infantil M 30*40», la base: «Back to School 30*40»).
insert into gt.codigos (codigo, descripcion, medida, uxb, activo, fabrica) values
  ('257', 'Cuadro Mold 03 Bauhaus Verde', '30*40', 16, true, true),
  ('299', 'Cuadro Mold 03 Musica', '30*40', 16, true, true),
  ('458', 'Cuadro Mold 03 Infantil F', '30*40', 16, true, true),
  ('469', 'Cuadro Mold 03 Velvet', '30*40', 16, true, true),
  ('470', 'Cuadros Mold 03 Set x2 Bauhaus Studio', '30*40 + 30*40', 8, true, true),
  ('471', 'Cuadros Mold 03 Set x3 Bauhaus Blue', '30*40 + 30*40 + 30*40', 8, true, true)
on conflict do nothing;
insert into gt.codigo_area (codigo, rubro, activo)
select c, r, true from unnest(array['257','299','458','469','470','471']) c
 cross join unnest(array['ENCOL','MONT','GANCHO','EMBL','CONTR','GUARD']) r
on conflict do nothing

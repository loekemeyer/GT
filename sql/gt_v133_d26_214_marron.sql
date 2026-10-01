-- GT — D26 (Thomas, 01/10/2026): el 214 Diploma Mold 012 c/Vidrio (30*40) es MARRÓN, no Cedro.
-- Su aro es 012 Marron 27.5*40 (en un cuadro, el 30 del producto es el 27,5 del aro, como el 03 Negro 080), y no
-- existía en Grampeado: se crea el 240. Corte ya tiene 012 Marron de 27,5 cm (80) y de 40 cm (82).
-- Rollback: select gt.color_fijar('214', array['Cedro'], 'foto Claude + regla Thomas D10');
--           update gt.codigos_rubro set activo = false where rubro = 'GRAMP' and codigo = '240';
select gt.color_fijar('214', array['Marrón'], 'Thomas 01/10 (D26)');
insert into gt.codigos_rubro (rubro, codigo, descripcion, medida, activo) values
  ('GRAMP', '240', '012 Marron', '27.5*40', true)   -- 214 Diploma Mold 012 c/Vidrio
on conflict (rubro, codigo) do nothing;
-- Chequeo: select * from gt.producto_aro where producto = '214';  select * from gt.aro_piezas where aro = '240';

-- gt_v171 (21/10/2026): «Codigos Corte Vidrio» en Deco — 15 medidas del tablero, códigos 2001 a 2015.
-- Pedido: foto del tablero «Codigos Corte Vidrio» + «Carga estos · Rubro deco».
-- Van a gt.codigos_rubro (códigos propios del rubro DECO), como el resto de las operaciones de Deco: el celular los
-- muestra «Corte Vidrio · 10*15» y al terminar pide «unidades fabricadas» (la unidad del área).
-- Ningún rubro usaba 2001-2015 (medido antes de cargar): no se cruzan con Corte, Grampeado ni productos.
-- ⚠ No mueve stock: gt.movimientos cruza codigos_rubro sólo con CORTE y GRAMP. El vidrio cortado NO suma al insumo
--   «VIDRIO {medida}» que descuenta Montaje (gt_v142).
-- Medidas tal como están en el tablero (punto decimal, como el resto de gt: «27.5*40»).
-- Rollback: update gt.codigos_rubro set activo = false where rubro = 'DECO' and codigo between '2001' and '2015';
insert into gt.codigos_rubro (rubro, codigo, descripcion, medida, activo, articulos)
select 'DECO', c, 'Corte Vidrio', m, true, null
  from (values ('2001', '10*15'), ('2002', '13*18'), ('2003', '15*21'), ('2004', '20*25'), ('2005', '20*30'),
               ('2006', '27.5*40'), ('2007', '29*40'), ('2008', '40*50'), ('2009', '50*60'), ('2010', '60*80'),
               ('2011', '60*100'), ('2012', '15*37'), ('2013', '8.5*23'), ('2014', '17.5*23'), ('2015', '23*26.5')) as v(c, m)
on conflict do nothing;

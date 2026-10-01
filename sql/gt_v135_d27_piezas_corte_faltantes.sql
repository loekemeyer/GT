-- GT — D27 (Thomas, 01/10/2026: «creemoslos»): las piezas de Corte que les faltaban a los 10 aros sin receta.
-- Los Trav 20mm ya existían en Corte (151, 153, 154, 155, 156) pero SIN medida (no se leía en la foto del tablero):
-- se les pone la medida que piden sus aros (el código más bajo = el lado más corto); al Celeste le faltaba una.
-- El 116 (Bco P 29*40) sigue la regla D23: el lado de 29 sale de una pieza Bco Total nueva (168) y el de 40 de la 116.
-- Rollback (SQL Editor): update gt.codigos_rubro set activo = false where rubro = 'CORTE' and codigo::int between 159 and 168;
--   update gt.codigos_rubro set medida = null where rubro = 'CORTE' and codigo in ('151','153','154','155','156');
--   delete from gt.receta_corte where nota like 'Thomas 01/10 (D27)%';
update gt.codigos_rubro set medida = '29 cm'   where rubro = 'CORTE' and codigo = '151' and medida is null;  -- Trav 20mm Verde (aro 123)
update gt.codigos_rubro set medida = '67.5 cm' where rubro = 'CORTE' and codigo = '154' and medida is null;  -- Trav 20mm Verde (aro 123)
update gt.codigos_rubro set medida = '27 cm'   where rubro = 'CORTE' and codigo = '153' and medida is null;  -- Trav 20mm Rosa (aro 119)
update gt.codigos_rubro set medida = '62 cm'   where rubro = 'CORTE' and codigo = '156' and medida is null;  -- Trav 20mm Rosa (aro 119)
update gt.codigos_rubro set medida = '27 cm'   where rubro = 'CORTE' and codigo = '155' and medida is null;  -- Trav 20mm Celeste (aro 120)
insert into gt.codigos_rubro (rubro, codigo, descripcion, medida, activo) values
  ('CORTE', '159', 'Trav 20mm Celeste', '62 cm',   true),  -- aro 120
  ('CORTE', '160', '03 Bco',            '27 cm',   true),  -- aro 121
  ('CORTE', '161', '03 Bco',            '62 cm',   true),  -- aro 121
  ('CORTE', '162', '03 Bco',            '29 cm',   true),  -- aro 122
  ('CORTE', '163', '03 Bco',            '67.5 cm', true),  -- aro 122
  ('CORTE', '164', '03 Negro',          '30 cm',   true),  -- aro 148 (lo usa el 146)
  ('CORTE', '165', '03 Natural',        '23 cm',   true),  -- aro 233
  ('CORTE', '166', '3P 3/4 Negro',      '27.5 cm', true),  -- aro 104
  ('CORTE', '167', '3P 1/2 Bco',        '120 cm',  true),  -- aro 118
  ('CORTE', '168', '3P 3/4 Bco Total',  '29 cm',   true)   -- aro 116, regla D23
on conflict (rubro, codigo) do nothing;
insert into gt.receta_corte (aro, pieza, cant, nota) values
  ('116', '168', 2, 'Thomas 01/10 (D27): Bco P 29*40, lado 29 de Bco Total (regla D23)'),
  ('116', '116', 2, 'Thomas 01/10 (D27): Bco P 29*40, lado 40 de Bco')
on conflict (aro, pieza) do nothing;
-- Chequeo: select * from gt.aro_piezas where pieza is null;   -- vacía = todos los aros tienen con qué cortarse

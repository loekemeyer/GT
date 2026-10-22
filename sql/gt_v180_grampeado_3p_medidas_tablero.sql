-- gt_v180 (22/10/2026): «El 118 es el 40x50. No existe 3P de 1/2 en esa medida 30x120» (foto del operario + foto de la
-- planilla «Códigos para planilla diaria de grampeado»). La transcripción de gt_codigos_corte_grampeado.sql (01/10) corrió
-- UNA FILA hacia arriba todo el bloque 3P desde 29*40: le faltaban las filas 30*30 y 60*80 del tablero. 22 aros mal:
--   1/2 Bco P: 118 · 3/4 Bco P: 103 116 100 093 106 096 099 112 102 111 105 · 3/4 Negro: 104 101 094 108 097 098 110 095 109 107.
-- Sin ningún registro de Grampeado con esos 22 códigos al 22/10 10:08 (80 registros GRAMP en total): no hay historia que rehacer.
-- gt.aro_piezas, gt.producto_aro, gt.movimientos y la demanda son vistas sobre gt.codigos_rubro: se corrigen solas.
-- Arrastres de decisiones tomadas sobre la medida mal leída:
--   · 236 / 237 (D22, «3P 3/4 60*80 no existe») son el 105 / 107 del tablero → activo = false (sin registros).
--   · Receta de corte D27 «Bco P 29*40 = 168 + 116» estaba en el aro 116: el 29*40 es el 103 → pasa al 103. La D23 del
--     103 («Bco P 27.5*40») queda sin aro: en el tablero no hay 3/4 Bco P de 27.5*40. El 116 (30*30) va solo: 114 ×4.
--   · Corte 167 «3P 1/2 Bco 120 cm» (D27) existía sólo para el 118 en 30*120 → activo = false (sin registros ni stock).
--   · Corte 166 «3P 3/4 Negro 27.5 cm» (D27) existía sólo para el lado corto del 104: ahora el 104 es 29*40 → 29 cm.
-- Rollback: los valores viejos están en gt_codigos_corte_grampeado.sql, gt_v134 y gt_v135.
begin;

update gt.codigos_rubro k set medida = v.nueva
  from (values
    ('118', '30*120',  '40*50'),
    ('103', '27.5*40', '29*40'),  ('116', '29*40',  '30*30'),  ('100', '30*70',  '30*90'),  ('093', '30*90',  '30*120'),
    ('106', '30*120',  '40*50'),  ('096', '40*50',  '40*60'),  ('099', '40*60',  '48*48'),  ('112', '48*48',  '50*60'),
    ('102', '50*60',   '50*70'),  ('111', '50*70',  '60*100'), ('105', '60*100', '60*80'),
    ('104', '27.5*40', '29*40'),  ('101', '30*70',  '30*90'),  ('094', '30*90',  '30*120'), ('108', '30*120', '40*50'),
    ('097', '40*50',   '40*60'),  ('098', '40*60',  '48*48'),  ('110', '48*48',  '50*60'),  ('095', '50*60',  '50*70'),
    ('109', '50*70',   '60*100'), ('107', '60*100', '60*80')
  ) v(codigo, vieja, nueva)
 where k.rubro = 'GRAMP' and k.codigo = v.codigo and k.medida = v.vieja;

update gt.codigos_rubro set activo = false where rubro = 'GRAMP' and codigo in ('236', '237') and activo;

delete from gt.receta_corte where aro = '103' and nota like 'Thomas 01/10 (D23)%';
update gt.receta_corte set aro = '103',
       nota = replace(nota, 'Thomas 01/10 (D27)', 'Thomas 01/10 (D27, del 116 al 103 en gt_v180)')
 where aro = '116' and nota like 'Thomas 01/10 (D27)%';

update gt.codigos_rubro set activo = false where rubro = 'CORTE' and codigo = '167' and activo;
update gt.codigos_rubro set medida = '29 cm' where rubro = 'CORTE' and codigo = '166' and medida = '27.5 cm';

commit;

-- Chequeo: select * from gt.aro_piezas where pieza is null;   -- vacía = todos los aros tienen con qué cortarse

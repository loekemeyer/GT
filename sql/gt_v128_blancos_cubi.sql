-- GT — aro de los blancos 3P 3/4 y el corte «cubi» (Thomas, 01/10/2026: D21, D16).
-- D21: «790 a 793 bco t · 228 bco P · 310 bco t».
-- D16: «Bco t es cubi» → el corte «cubo/cubi» de Corte son las piezas 3P 3/4 Bco Total (136 a 141, 10 a 21 cm).
--      Con eso los aros 3P 3/4 Bco P chicos (066 / 067 / 068), que se arman con piezas de Bco Total
--      (D6: «sí, pero se cortan cubo»), descuentan esas piezas de Corte.
-- Rollback (lo corre el dueño en el SQL Editor; el conector no deja DELETE):
--   delete from gt.receta_aro where nota like 'Thomas 01/10 (D21)%';
--   delete from gt.receta_corte where nota like 'Thomas 01/10 (D16)%';

insert into gt.receta_aro (producto, pieza, aro, cant, nota) values
  ('790', '10*15', '063', 1, 'Thomas 01/10 (D21): Porta Mold 30mm Blanco = Bco T'),
  ('791', '13*18', '064', 1, 'Thomas 01/10 (D21): Porta Mold 30mm Blanco = Bco T'),
  ('792', '15*21', '065', 1, 'Thomas 01/10 (D21): Porta Mold 30mm Blanco = Bco T'),
  ('793', '20*25', '113', 1, 'Thomas 01/10 (D21): Porta Mold 30mm Blanco = Bco T'),
  ('310', '20*25', '113', 1, 'Thomas 01/10 (D21): Colgante Llaves = Bco T'),
  ('228', '30*40', '103', 1, 'Thomas 01/10 (D21): Vintage c/Vidrio = Bco P')
on conflict (producto, pieza, aro) do nothing;

insert into gt.receta_corte (aro, pieza, cant, nota) values
  ('066', '136', 2, 'Thomas 01/10 (D16): Bco P chico se arma con piezas Bco Total (cubi)'),
  ('066', '138', 2, 'Thomas 01/10 (D16): Bco P chico se arma con piezas Bco Total (cubi)'),
  ('067', '137', 2, 'Thomas 01/10 (D16): Bco P chico se arma con piezas Bco Total (cubi)'),
  ('067', '139', 2, 'Thomas 01/10 (D16): Bco P chico se arma con piezas Bco Total (cubi)'),
  ('068', '138', 2, 'Thomas 01/10 (D16): Bco P chico se arma con piezas Bco Total (cubi)'),
  ('068', '141', 2, 'Thomas 01/10 (D16): Bco P chico se arma con piezas Bco Total (cubi)')
on conflict (aro, pieza) do nothing;

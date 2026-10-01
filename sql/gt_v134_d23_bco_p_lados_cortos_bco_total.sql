-- GT — D23 (Thomas, 01/10/2026: «ok»): los aros 3P 3/4 Bco P con lados de 20, 25 y 27,5 cm toman esos lados de
-- las piezas Bco Total de Corte (140 = 20 cm, 142 = 25 cm, 143 = 27,5 cm); los lados de 30 y 40 siguen saliendo
-- de la lista «3P 3/4 Bco» (114 = 30 cm, 116 = 40 cm). Misma regla que los chicos 066 a 068 (D6 / D16).
-- Con receta manual, el aro deja de resolverse «auto»: por eso 070 y 103 llevan también su lado largo.
-- Rollback (SQL Editor): delete from gt.receta_corte where nota like 'Thomas 01/10 (D23)%';
insert into gt.receta_corte (aro, pieza, cant, nota) values
  ('069', '140', 2, 'Thomas 01/10 (D23): Bco P 20*25, lado 20 de Bco Total'),
  ('069', '142', 2, 'Thomas 01/10 (D23): Bco P 20*25, lado 25 de Bco Total'),
  ('117', '140', 2, 'Thomas 01/10 (D23): Bco P 20*27.5, lado 20 de Bco Total'),
  ('117', '143', 2, 'Thomas 01/10 (D23): Bco P 20*27.5, lado 27.5 de Bco Total'),
  ('070', '140', 2, 'Thomas 01/10 (D23): Bco P 20*30, lado 20 de Bco Total'),
  ('070', '114', 2, 'Thomas 01/10 (D23): Bco P 20*30, lado 30 de Bco'),
  ('103', '143', 2, 'Thomas 01/10 (D23): Bco P 27.5*40, lado 27.5 de Bco Total'),
  ('103', '116', 2, 'Thomas 01/10 (D23): Bco P 27.5*40, lado 40 de Bco')
on conflict (aro, pieza) do nothing;
-- Chequeo: select * from gt.aro_piezas where aro in ('069','117','070','103') order by 1, 2;

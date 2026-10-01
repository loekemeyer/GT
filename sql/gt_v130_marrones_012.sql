-- GT — colores de los marcos marrones de moldura 012 (Thomas, 01/10/2026: D10 «012 y 05 sí»).
-- Regla confirmada: rojizo = Cedro, miel = Roble, marrón oscuro = Marrón. Se cargó la lectura de Claude
-- (docs/colores_marco_cruce.csv), que es la que aplicó esa regla; ChatGPT había puesto «Marrón» genérico.
-- Surtidos: reparto parejo (1/n) por gt.producto_aro. 553 va Marrón: la moldura 012 no tiene Negro.
-- Rollback (lo corre el dueño en el SQL Editor): delete from gt.codigo_color where fuente = 'foto Claude + regla Thomas D10';
insert into gt.codigo_color (codigo, color, proporcion, fuente, nota) values
  ('214','Cedro',null,'foto Claude + regla Thomas D10','rojizo = Cedro'),
  ('550','Cedro',null,'foto Claude + regla Thomas D10','rojizo con filete dorado'),
  ('553','Marrón',null,'foto Claude + regla Thomas D10','marrón muy oscuro con filete plateado (012 no tiene Negro)'),
  ('604','Roble',null,'foto Claude + regla Thomas D10','miel = Roble'),
  ('740','Cedro',null,'foto Claude + regla Thomas D10','rojizo = Cedro'),
  ('741','Cedro',null,'foto Claude + regla Thomas D10','rojizo = Cedro'),
  ('743','Cedro',null,'foto Claude + regla Thomas D10','rojizo = Cedro'),
  ('744','Cedro',null,'foto Claude + regla Thomas D10','rojizo = Cedro'),
  ('745','Cedro',null,'foto Claude + regla Thomas D10','rojizo = Cedro'),
  ('400','Marrón',null,'foto Claude + regla Thomas D10','surtido'), ('400','Cedro',null,'foto Claude + regla Thomas D10','surtido'),
  ('402','Marrón',null,'foto Claude + regla Thomas D10','surtido'), ('402','Cedro',null,'foto Claude + regla Thomas D10','surtido'),
  ('605','Marrón',null,'foto Claude + regla Thomas D10','surtido'), ('605','Cedro',null,'foto Claude + regla Thomas D10','surtido'),
  ('606','Marrón',null,'foto Claude + regla Thomas D10','surtido'), ('606','Cedro',null,'foto Claude + regla Thomas D10','surtido'),
  ('607','Marrón',null,'foto Claude + regla Thomas D10','surtido'), ('607','Cedro',null,'foto Claude + regla Thomas D10','surtido'),
  ('608','Marrón',null,'foto Claude + regla Thomas D10','surtido'), ('608','Cedro',null,'foto Claude + regla Thomas D10','surtido'),
  ('609','Marrón',null,'foto Claude + regla Thomas D10','surtido'), ('609','Cedro',null,'foto Claude + regla Thomas D10','surtido'),
  ('710','Marrón',null,'foto Claude + regla Thomas D10','surtido'), ('710','Natural',null,'foto Claude + regla Thomas D10','surtido'), ('710','Cedro',null,'foto Claude + regla Thomas D10','surtido'),
  ('711','Marrón',null,'foto Claude + regla Thomas D10','surtido'), ('711','Natural',null,'foto Claude + regla Thomas D10','surtido'), ('711','Cedro',null,'foto Claude + regla Thomas D10','surtido'),
  ('712','Marrón',null,'foto Claude + regla Thomas D10','surtido'), ('712','Natural',null,'foto Claude + regla Thomas D10','surtido'), ('712','Cedro',null,'foto Claude + regla Thomas D10','surtido'),
  ('713','Marrón',null,'foto Claude + regla Thomas D10','surtido'), ('713','Natural',null,'foto Claude + regla Thomas D10','surtido'), ('713','Cedro',null,'foto Claude + regla Thomas D10','surtido'),
  ('714','Marrón',null,'foto Claude + regla Thomas D10','surtido'), ('714','Natural',null,'foto Claude + regla Thomas D10','surtido'), ('714','Cedro',null,'foto Claude + regla Thomas D10','surtido')
on conflict (codigo, color) do nothing;

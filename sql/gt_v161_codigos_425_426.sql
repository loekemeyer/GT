-- gt_v161 (Thomas, 05/10/2026: «426 Línea Matisse Floral · 425 Línea Coral · 30x40»). Se vendían en TN y no estaban en la lista
-- (D69). [Probable] Mold 03 y 16 por caja, como todos los cuadros 30*40 del 403 al 428: se corrige con un update.
-- Mismas áreas que sus vecinos (Encolado, Montaje, Gancho, Emblistado, Contraído, Guardado). Sin color de marco todavía.
insert into gt.codigos (codigo, descripcion, medida, uxb, activo, fabrica) values
  ('425', 'Cuadro Mold 03 Línea Coral', '30*40', 16, true, true),
  ('426', 'Cuadro Mold 03 Línea Matisse Floral', '30*40', 16, true, true)
on conflict do nothing;
insert into gt.codigo_area (codigo, rubro, activo)
select c, r, true from unnest(array['425','426']) c cross join unnest(array['ENCOL','MONT','GANCHO','EMBL','CONTR','GUARD']) r
on conflict do nothing

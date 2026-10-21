-- gt_v179 (Thomas, 21/10/2026): «un solo código para la moldura de una misma medida… que pregunte qué color están cortando,
-- si rosa, natural o celeste». La pregunta de gt_v176 (206 / 207 / 212, al terminar) suma Natural.
-- Rollback: update gt.rubro_pasos set opciones = array['Rosa', 'Celeste'] where rubro = 'CORTE' and orden in (2, 3, 4) and campo = 'color';
update gt.rubro_pasos set opciones = array['Rosa', 'Natural', 'Celeste']
 where rubro = 'CORTE' and orden in (2, 3, 4) and campo = 'color';

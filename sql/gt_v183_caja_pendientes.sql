-- gt_v183 (28/10/2026): caja de los artículos que faltaban. Angely devolvió la planilla «Cajas pendientes por artículo»
-- con la columna Caja completa para los 39 artículos pendientes (hoja Pendientes). Su caja manda sobre la que propuso Claude.
-- Difieren de la propuesta de Claude: 608 (16 en vez de 15), 745 (16 en vez de 15), 311 (40*15 en vez de 40*50), 335 y 343 (15 en vez de IMP).
-- Se suman 426 (40*15) y 456 (10) de la hoja «Ya contraídos»: eran propuestas de Claude (misma moldura, medida y UxB que 39 y 3 artículos con caja) y la hoja volvió sin tocarlas.
-- Quedan SIN caja los 557 y 220 (la hoja «Ya contraídos» volvió en blanco) y los activos sin demanda hoy.
-- Sólo completa lo que está en blanco (caja is null): no pisa lo cargado en gt_v181.
-- Rollback: update gt.codigos set caja = null where codigo in (los de abajo)
update gt.codigos c set caja = v.caja
  from (values
    ('130','12'), ('173','12'), ('156','14'), ('232','14'), ('446','14'), ('449','14'),
    ('251','30'), ('126','30'), ('186','30'), ('253','30'), ('390','30'), ('445','30'),
    ('817','30'), ('409','40*15'), ('411','40*50'), ('118','40*50'), ('608','16'), ('745','16'),
    ('790','15'), ('791','15'), ('311','40*15'), ('537','40*50'), ('370','IMP'), ('374','IMP'),
    ('335','15'), ('343','15'), ('663','38*38'), ('222','38*38'), ('082','14'), ('088','12'),
    ('119','20*50'), ('223','40*50'), ('303','14'), ('538','14'), ('615','30'), ('631','13'),
    ('781E','Exhi 2 Porta'), ('782E','Exhi 3 Porta'), ('895','13'), ('426','40*15'), ('456','10')
  ) as v(cod, caja)
 where ltrim(c.codigo, '0') = ltrim(v.cod, '0') and c.caja is null;

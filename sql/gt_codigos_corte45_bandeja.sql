-- Corte 45° — tablero «Codigos Corte 45° Bandeja» (foto, Elías 16/10/2026: «cargalos todos»).
-- descripcion = moldura · medida = producto (código de artículo). Códigos repetidos en el tablero: una fila con todos.
-- 213 y 214 YA eran «012 Celeste 13 / 27.5 cm»: se suma el producto del tablero, no se pisa (D13 pendiente).
-- 663 (Caja de Té Grande), tapas: corregido a mano en el cartel; leído 03 Chica Tapa = 311, 03 Gde. Tapa = 314 [Probable].
insert into gt.codigos_rubro (rubro, codigo, descripcion, medida, activo) values
 ('CORTE','236','045 Chico','Bandeja 25*35 Natural (541)',true),
 ('CORTE','237','045 Grande','Bandeja 25*35 Natural (541)',true),
 ('CORTE','240','045 Chico y Grande','Bandeja 30*30 Bco (546)',true),
 ('CORTE','238','045 Chico','Bandeja 25*35 Bco (537/548)',true),
 ('CORTE','239','045 Grande','Bandeja 25*35 Bco (537/548)',true),
 ('CORTE','229','045 Chico','Bandeja Notebook (545)',true),
 ('CORTE','228','045 Grande','Bandeja Notebook (545)',true),
 ('CORTE','294','70 Chico','Set Organizador Chico (660-1)',true),
 ('CORTE','295','70 Grande','Set Organizador Chico (660-1)',true),
 ('CORTE','292','70 Chico','Set Organizador Mediano (660-2)',true),
 ('CORTE','293','70 Grande','Set Organizador Mediano (660-2)',true),
 ('CORTE','290','70 Chico','Set Organizador Grande (660-3)',true),
 ('CORTE','291','70 Grande','Set Organizador Grande (660-3)',true),
 ('CORTE','308','70 Chico','Caja de Té Chica (661)',true),
 ('CORTE','309','70 Chico','Caja de Té Mediana (662)',true),
 ('CORTE','307','70 Grande · 70 Chico','Caja de Té Chica (661) y Mediana (662) · Grande (663)',true),
 ('CORTE','310','70 Grande','Caja de Té Grande (663)',true),
 ('CORTE','312','03 Chica Tapa','Caja de Té Chica (661)',true),
 ('CORTE','313','03 Chica Tapa','Caja de Té Mediana (662)',true),
 ('CORTE','311','03 Gde. Tapa · 03 Chica Tapa','Caja de Té Chica (661) y Mediana (662) · Grande (663)',true),
 ('CORTE','314','03 Gde. Tapa','Caja de Té Grande (663)',true)
on conflict (rubro, codigo) do update set descripcion = excluded.descripcion, medida = excluded.medida, activo = true;

update gt.codigos_rubro set descripcion = '012 Celeste · 045 Chico', medida = '13 cm · Cajón Porta Cubiertos (556)'
 where rubro = 'CORTE' and codigo = '213' and descripcion = '012 Celeste';
update gt.codigos_rubro set descripcion = '012 Celeste · 045 Grande', medida = '27.5 cm · Cajón Porta Cubiertos (556)'
 where rubro = 'CORTE' and codigo = '214' and descripcion = '012 Celeste';

-- gt_v174 (Thomas, 21/10/2026): tablero «Corte 90° Grados» → códigos de Corte 200-273.
-- Pedido: «258 en corte no lo tenés» + foto del tablero («El 258 es moldura de 100 con ranura para cajón 25x34»).
-- Mismo formato que el tablero «Corte 45° Bandeja» (gt_codigos_corte45_bandeja.sql): descripcion = moldura,
-- medida = producto (código de artículo). En los cajones van sólo los artículos activos: 563J, 564J, 570, 581, 582 y
-- 589 a 594 son discontinuos (D64).
-- 206 / 207 / 212 YA estaban («012 Rosa 13 cm», «012 Rosa 27.5 cm», «Manija 03 Rosa», 07/10, D95): NO se pisan (D9).
-- Ya se venían tipeando fuera de la lista: 204 (Javier Burgos), 208, 210, 211 (Luis Luna, Lautaro Durante, Ximena Ortiz)
-- y 258 (Luis Luna): con la carga, esos tramos pasan a ser de la lista (gt.movimientos lee la lista al momento).
-- Mueven stock como todo Corte: + piezas en el depósito «corte» con el código.
-- Rollback: update gt.codigos_rubro set activo = false where rubro = 'CORTE' and codigo in (<los de abajo>);
insert into gt.codigos_rubro (rubro, codigo, descripcion, medida, activo) values
 ('CORTE','204','012 Corte Chico','Bandeja 20x20 (535)',true),
 ('CORTE','205','012 Corte Grande','Bandeja 20x20 (535)',true),
 ('CORTE','225','012 Corte Chico','Bandeja 30x30 (538)',true),
 ('CORTE','208','012 Corte Chico','Bandeja Cama Chica 30x40 (540/542)',true),
 ('CORTE','209','012 Corte Grande','Bandeja Cama Chica 30x40 (540/542)',true),
 ('CORTE','211','045 Travesaño','Bandeja Cama Chica 30x40 (540/542)',true),
 ('CORTE','210','012 Pata','Bandeja Cama Chica 30x40 (540/542)',true),
 ('CORTE','200','012 Corte Chico','Bandeja Cama Grande 33x50 (543)',true),
 ('CORTE','201','012 Corte Grande','Bandeja Cama Grande 33x50 (543)',true),
 ('CORTE','203','045 Travesaño','Bandeja Cama Grande 33x50 (543)',true),
 ('CORTE','202','012 Pata','Bandeja Cama Grande 33x50 (543)',true),
 ('CORTE','266','045 c/Ran c/B','Cajón 2 Tablas Bco 15*21 (563)',true),
 ('CORTE','265','045 s/Ran c/B','Cajón 2 Tablas Bco 15*21 (563)',true),
 ('CORTE','267','100 c/Ran c/B','Cajón 2 Tablas Bco 15*21 (563)',true),
 ('CORTE','243','100 c/Ran','Cajón 2 Tablas Bco 15*21 (563)',true),
 ('CORTE','241','045 s/Ran','Cajón 2 Tablas Bco 15*21 (563)',true),
 ('CORTE','242','045 c/Ran','Cajón 2 Tablas Bco 15*21 (563)',true),
 ('CORTE','269','045 c/Ran c/B','Cajón 2 Tablas Bco 20*27.5 (564)',true),
 ('CORTE','268','045 s/Ran c/B','Cajón 2 Tablas Bco 20*27.5 (564)',true),
 ('CORTE','270','100 c/Ran c/B','Cajón 2 Tablas Bco 20*27.5 (564)',true),
 ('CORTE','246','100 c/Ran','Cajón 2 Tablas Bco 20*27.5 (564)',true),
 ('CORTE','244','045 s/Ran','Cajón 2 Tablas Bco 20*27.5 (564)',true),
 ('CORTE','245','045 c/Ran','Cajón 2 Tablas Bco 20*27.5 (564)',true),
 ('CORTE','271','045 c/Ran c/B','Cajón 2 Tablas Bco 25*34 (565)',true),
 ('CORTE','272','045 s/Ran c/B','Cajón 2 Tablas Bco 25*34 (565)',true),
 ('CORTE','273','100 c/Ran c/B','Cajón 2 Tablas Bco 25*34 (565)',true),
 ('CORTE','249','100 c/Ran','Cajón 2 Tablas Bco 25*34 (565)',true),
 ('CORTE','247','045 s/Ran','Cajón 2 Tablas Bco 25*34 (565)',true),
 ('CORTE','248','045 c/Ran','Cajón 2 Tablas Bco 25*34 (565)',true),
 ('CORTE','252','100 c/Ran','Cajón 2 Tablas Nat 15*21 (583)',true),
 ('CORTE','250','045 s/Ran','Cajón 2 Tablas Nat 15*21 (583)',true),
 ('CORTE','251','045 c/Ran','Cajón 2 Tablas Nat 15*21 (583)',true),
 ('CORTE','255','100 c/Ran','Cajón 2 Tablas Nat 20*27.5 (584)',true),
 ('CORTE','253','045 s/Ran','Cajón 2 Tablas Nat 20*27.5 (584)',true),
 ('CORTE','254','045 c/Ran','Cajón 2 Tablas Nat 20*27.5 (584)',true),
 ('CORTE','258','100 c/Ran','Cajón 2 Tablas Nat 25*34 (585)',true),
 ('CORTE','256','045 s/Ran','Cajón 2 Tablas Nat 25*34 (585)',true),
 ('CORTE','257','045 c/Ran','Cajón 2 Tablas Nat 25*34 (585)',true)
on conflict (rubro, codigo) do nothing;

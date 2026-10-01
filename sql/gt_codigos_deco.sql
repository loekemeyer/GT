-- Códigos de operación del Sector Deco, transcriptos de la foto del tablero «08. Sector Deco» (Thomas, 01/10/2026).
-- El 3004 (Patas c/Trav) es el mismo para 540, 542 y 547. La parte derecha del tablero (661/662/663 Caja de Té,
-- 556 Cajón Porta Cubiertos, 557 Secaplatos) salió cortada en la foto: sus códigos NO están acá.
-- Con el «sí» del dueño. Idempotente.
insert into gt.codigos_rubro (rubro, codigo, descripcion, medida) values
  ('DECO', '3001', 'Armado Bastidor — 542 Bandeja Cama Chica 30x40', null),
  ('DECO', '3002', 'Armado Bastidor — 540 Bandeja Cama Chica 30x40', null),
  ('DECO', '3003', 'Armado Bastidor — 547 Bandeja Cama Chica 30x40', null),
  ('DECO', '3004', 'Patas c/Trav — 540/542/547 Bandeja Cama Chica 30x40', null),
  ('DECO', '3005', 'Armado Bastidor — 543 Bandeja Cama Grande 33x50', null),
  ('DECO', '3006', 'Patas c/Trav — 543 Bandeja Cama Grande 33x50', null),
  ('DECO', '3007', 'Armado Corte Chico c/Manija — 535 Bandeja 20x20', null),
  ('DECO', '3008', 'Armado Corte Chico c/Manija — 536 Bandeja 13x30', null),
  ('DECO', '3009', 'Armado Corte Chico c/Manija — 538 Bandeja 30x30', null),
  ('DECO', '3014', 'Colocado Manija — 537 Band 25*35 Bca Nature Manija Metal', null),
  ('DECO', '3015', 'Colocado Manija — 541 Band 25*35 Nat Vint Manija Cuero', null),
  ('DECO', '3016', 'Colocado Manija — 546 Band 30*30 Bca Vint Manija Metal', null),
  ('DECO', '3017', 'Colocado Manija — 548 Band 25*35 Bca Vint Manija Metal', null),
  ('DECO', '3019', 'Estructura Sop — 545 Bandeja Notebook', null),
  ('DECO', '3020', 'Patas c/Base — 545 Bandeja Notebook', null),
  ('DECO', '3021', 'Bastidor c/100 Chica — 545 Bandeja Notebook', null),
  ('DECO', '3037', 'Aro + Soga — 160 Porta Broche Grande Verde', null),
  ('DECO', '3038', 'Aro + Soga + Broche + Panfletos — 160 Porta Broche Grande Verde', null),
  ('DECO', '3039', 'Aro + Soga — 162 Porta Broche Chico Celeste/Rosa', null),
  ('DECO', '3040', 'Aro + Soga + Broche + Panfletos — 162 Porta Broche Chico Celeste/Rosa', null),
  ('DECO', '3041', 'Aro + Soga — 163 Porta Broche Blanco 40*50', null),
  ('DECO', '3042', 'Aro + Soga + Broche + Panfletos — 163 Porta Broche Blanco 40*50', null),
  ('DECO', '3051', 'Enduido — 537 Band 25*35 Bca Nature Manija Metal', null),
  ('DECO', '3052', 'Enduido — 546 Band 30*30 Bca Vint Manija Metal', null),
  ('DECO', '3053', 'Enduido — 548 Band 25*35 Bca Vint Manija Metal', null),
  ('DECO', '3054', 'Lijado — 537 Band 25*35 Bca Nature Manija Metal', null),
  ('DECO', '3055', 'Lijado — 546 Band 30*30 Bca Vint Manija Metal', null),
  ('DECO', '3056', 'Lijado — 548 Band 25*35 Bca Vint Manija Metal', null),
  ('DECO', '3060', 'Bastidor + Patas c/Tornillo — 540 Bandeja Cama Chica 30x40', null),
  ('DECO', '3061', 'Bastidor + Patas c/Tornillo — 542 Bandeja Cama Chica 30x40', null),
  ('DECO', '3062', 'Bastidor + Patas c/Tornillo — 543 Bandeja Cama Grande 33x50', null),
  ('DECO', '3063', 'Bastidor + Patas c/Tornillo — 547 Bandeja Cama Chica 30x40', null),
  ('DECO', '3079', 'Armado Bandeja — 535 Bandeja 20x20', null),
  ('DECO', '3080', 'Armado Bandeja — 536 Bandeja 13x30', null),
  ('DECO', '3081', 'Armado Bandeja — 538 Bandeja 30x30', null)
on conflict (rubro, codigo) do update set descripcion = excluded.descripcion;

update gt.rubros set pide_codigo = true where codigo = 'DECO';

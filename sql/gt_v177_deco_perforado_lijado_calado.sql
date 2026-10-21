-- gt_v177 (Thomas, 21/10/2026): cartel de Deco «Codigos Perforado-Lijado-Calado» → 16 códigos nuevos en Deco y el 7001
-- con el nombre del cartel. Formato de Deco: «Operación — artículo».
-- Resuelve D10: el 6005 es «Calado Bast. 045» y el 7010 «Perforado Soporte 10mm», los dos de la Bandeja Notebook 545.
-- Ya se venían tipeando fuera de la lista en Deco: 6005 y 7010 y 7008 (Juan Gimenez), 7006 (Luis Luna, Ximena Ortiz),
-- 8001 (Lautaro Durante). No mueven stock.
-- Rollback: update gt.codigos_rubro set activo = false where rubro = 'DECO' and codigo in (<los de abajo>);
--           update gt.codigos_rubro set descripcion = 'Perforado — Cajas de Té (661, 662, 663)' where rubro = 'DECO' and codigo = '7001';
insert into gt.codigos_rubro (rubro, codigo, descripcion, medida, activo) values
 ('DECO','6001','Calado 045 Trav Chico — 662 Caja de Té Mediana',null,true),
 ('DECO','6002','Calado 045 Trav Gde — 662 Caja de Té Mediana',null,true),
 ('DECO','6003','Calado 045 Trav Chico — 663 Caja de Té Grande',null,true),
 ('DECO','6004','Calado 045 Trav Gde — 663 Caja de Té Grande',null,true),
 ('DECO','6005','Calado Bast. 045 — 545 Bandeja Notebook',null,true),
 ('DECO','6006','Calado Reg Altura Trav 20mm — 545 Bandeja Notebook',null,true),
 ('DECO','7006','Perforado Patas — 542 Bandeja Cama Chica 30x40',null,true),
 ('DECO','7007','Perforado Patas — 543 Bandeja Cama Grande 33x50',null,true),
 ('DECO','7008','Perforado Patas — 545 Bandeja Notebook',null,true),
 ('DECO','7009','Perforado 012 p/Pitones — 310 Cuelga Llaves',null,true),
 ('DECO','7010','Perforado Soporte 10mm — 545 Bandeja Notebook',null,true),
 ('DECO','7011','Perforado 100 Grande — 545 Bandeja Notebook',null,true),
 ('DECO','8001','Lijado Manija 03 — 535/536/538 Bandeja',null,true),
 ('DECO','8002','Lijado Soporte 10mm — 545 Bandeja Notebook',null,true),
 ('DECO','8003','Lijado 100 Chico — 545 Bandeja Notebook',null,true),
 ('DECO','8004','Lijado 100 Grande — 545 Bandeja Notebook',null,true)
on conflict (rubro, codigo) do nothing;

update gt.codigos_rubro set descripcion = 'Perforado Tapa 03 — Cajas de Té (661, 662, 663)'
 where rubro = 'DECO' and codigo = '7001';

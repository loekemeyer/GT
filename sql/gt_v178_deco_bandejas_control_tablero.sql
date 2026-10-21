-- gt_v178 (Thomas, 21/10/2026, «Controla»): Deco contra el tablero de las bandejas (536/535/538, 540/542/543/545/547,
-- 537/541/546/548, Porta Broche 160/162/163). 31 códigos coinciden; las diferencias son de la Bandeja Cama Chica:
-- · el tablero tiene a mano «3001» y «3061» en la columna 540 (tapando el 3002 y el 3060 impresos), y para la 547 da
--   3003 y 3063. La base tenía 3001 y 3061 para 540/542/547 y además 3002 / 3060 para la 540 sola (D103).
--   → 3001 y 3061 quedan para 540/542 (la 547 sale de su pregunta «¿Qué artículo?»), 3002 y 3060 se apagan.
--   Lo ya cargado no se toca: 3001·547 (30, 09/10) y 3061·547 (60, hasta 16/10) quedan como se registraron.
-- · 3007 / 3008 decían «Manija 03 + Corte 012 …»: pasan al nombre del tablero, «Armado Corte Chico c/Manija».
-- Rollback:
--   update gt.codigos_rubro set articulos = array['540','542','547'], descripcion = 'Armado Bastidor — 540/542/547 Bandeja Cama Chica 30x40' where rubro = 'DECO' and codigo = '3001';
--   update gt.codigos_rubro set articulos = array['540','542','547'], descripcion = 'Bastidor + Patas c/Tornillo — 540/542/547 Bandeja Cama Chica 30x40' where rubro = 'DECO' and codigo = '3061';
--   update gt.codigos_rubro set activo = true where rubro = 'DECO' and codigo in ('3002','3060');
--   3007 'Manija 03 + Corte 012 20 cm — 535/549/452 Bandeja 20x20' · 3008 'Manija 03 + Corte 012 13 cm — 456/536/818/534 Bandeja 13x30'
update gt.codigos_rubro set articulos = array['540','542'], descripcion = 'Armado Bastidor — 540/542 Bandeja Cama Chica 30x40'
 where rubro = 'DECO' and codigo = '3001';
update gt.codigos_rubro set articulos = array['540','542'], descripcion = 'Bastidor + Patas c/Tornillo — 540/542 Bandeja Cama Chica 30x40'
 where rubro = 'DECO' and codigo = '3061';
update gt.codigos_rubro set activo = false where rubro = 'DECO' and codigo in ('3002','3060');
update gt.codigos_rubro set descripcion = 'Armado Corte Chico c/Manija — 535/549/452 Bandeja 20x20'
 where rubro = 'DECO' and codigo = '3007';
update gt.codigos_rubro set descripcion = 'Armado Corte Chico c/Manija — 456/536/818/534 Bandeja 13x30'
 where rubro = 'DECO' and codigo = '3008';

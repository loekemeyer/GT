-- gt_v176 (Thomas, 21/10/2026, D9): en Corte no hay códigos por color. «Los códigos de rosa o celeste que no existan, y
-- cuando cortan 012 13 cm, que pregunte qué color.» La moldura 012 de la bandeja se corta ya pintada, Rosa o Celeste.
--
-- 1) 206 / 207 / 212 quedan como el tablero «Corte 90°» (Bandeja Vintage 13x30 536, 20x20 535, 30x30 538), sin color.
--    La medida sigue siendo el largo, para que Rendimiento los agrupe igual («Mold 012 · 13 cm»).
-- 2) Al TERMINAR uno de esos tres, «¿De qué color?» Rosa / Celeste → detalle.color. Es el mismo mecanismo de la 1.65
--    (gt.rubro_pasos con si_campo = 'codigo', momento 'terminar'): cero cambios en la app. 207 y 212 también [Probable]:
--    son el corte grande y la manija de la misma bandeja, que también venían en Rosa y Celeste.
-- 3) Los Celeste se van: 213 / 214 quedan sólo como Cajón Porta Cubiertos (045 Chico / Grande, tablero «Corte 45°»), así
--    que deja de preguntar «¿Qué cortaste?» (esas dos filas de rubro_pasos pasan a ser la pregunta del color del 206 y 207:
--    el conector no deja DELETE). 215 «Manija 03 Celeste» se apaga.
-- ⚠ El stock del depósito «corte» va por código, no por color: Rosa y Celeste del 206 suman juntas.
--
-- Rollback (los textos de antes):
--   206 '012 Rosa' / '13 cm' · 207 '012 Rosa' / '27.5 cm' · 212 'Manija 03 Rosa' / null
--   213 '012 Celeste · 045 Chico' / '13 cm · Cajón Porta Cubiertos (556)' · 214 '012 Celeste · 045 Grande' / '27.5 cm · Cajón Porta Cubiertos (556)'
--   update gt.codigos_rubro set activo = true where rubro = 'CORTE' and codigo = '215';
--   rubro_pasos CORTE 2 y 3: campo 'producto', '¿Qué cortaste?', {012 Celeste, Cajón Porta Cubiertos}, si_valor 213 / 214
--   rubro_pasos CORTE 4: update ... set si_valor = '__off' (no hay DELETE)

update gt.codigos_rubro set descripcion = '012 Corte Chico · Bandeja 13x30 (536)', medida = '13 cm'
 where rubro = 'CORTE' and codigo = '206';
update gt.codigos_rubro set descripcion = '012 Corte Grande · Bandeja 13x30 (536) y 30x30 (538)', medida = '27.5 cm'
 where rubro = 'CORTE' and codigo = '207';
update gt.codigos_rubro set descripcion = 'Manija Madera · Bandeja 13x30 (536), 20x20 (535) y 30x30 (538)', medida = null
 where rubro = 'CORTE' and codigo = '212';
update gt.codigos_rubro set descripcion = '045 Chico', medida = 'Cajón Porta Cubiertos (556)'
 where rubro = 'CORTE' and codigo = '213';
update gt.codigos_rubro set descripcion = '045 Grande', medida = 'Cajón Porta Cubiertos (556)'
 where rubro = 'CORTE' and codigo = '214';
update gt.codigos_rubro set activo = false where rubro = 'CORTE' and codigo = '215';

update gt.rubro_pasos set campo = 'color', pregunta = '¿De qué color?', opciones = array['Rosa', 'Celeste'], si_valor = '206'
 where rubro = 'CORTE' and orden = 2;
update gt.rubro_pasos set campo = 'color', pregunta = '¿De qué color?', opciones = array['Rosa', 'Celeste'], si_valor = '207'
 where rubro = 'CORTE' and orden = 3;
insert into gt.rubro_pasos (rubro, orden, campo, pregunta, opciones, fuente, si_campo, si_valor, momento)
values ('CORTE', 4, 'color', '¿De qué color?', array['Rosa', 'Celeste'], null, 'codigo', '212', 'terminar')
on conflict (rubro, orden) do nothing;

-- 1.65 (D16, Elías, 16/10/2026): el 213 y el 214 de Corte son a la vez 012 Celeste y Cajón Porta Cubiertos (556).
-- Al terminar, sólo con esos códigos, «¿Qué cortaste?» -> detalle.producto. app.js: si_campo = 'codigo' compara contra
-- el código del tramo (sin ceros adelante). Una app vieja no la muestra (compara contra las respuestas y no hay 'codigo').
insert into gt.rubro_pasos (rubro, orden, campo, pregunta, opciones, fuente, si_campo, si_valor, momento) values
 ('CORTE', 2, 'producto', '¿Qué cortaste?', array['012 Celeste','Cajón Porta Cubiertos'], null, 'codigo', '213', 'terminar'),
 ('CORTE', 3, 'producto', '¿Qué cortaste?', array['012 Celeste','Cajón Porta Cubiertos'], null, 'codigo', '214', 'terminar')
on conflict (rubro, orden) do nothing;
-- Análisis: select texto, detalle->>'producto', sum(cantidad) from gt.registros where rubro='CORTE' and ts_inicio is not null
--           and texto in ('213','214') group by 1,2;

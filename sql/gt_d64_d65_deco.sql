-- D64 y D65 (Thomas, 02/10/2026). Aplicado desde la sesión el 02/10 y verificado.
-- D64 «todos discontinuos»: los 13 artículos que nombran códigos de Deco y no están en gt.codigos (302, 563J, 564J, 570,
-- 581, 582, 589 a 594 y 897) están discontinuados → sus 13 operaciones salen de la lista del celular (71 → 58).
-- Si alguien tipea uno igual, entra como código fuera de la lista («¿Lo registro igual?» + aviso por Telegram).
update gt.codigos_rubro set activo = false where rubro = 'DECO' and codigo in
  ('3059','3067','3068','3069','3073','3074','3075','3076','3077','3078','3090','3101','3102');
-- D65 «sí se fabrican»: las Cajas de Té 661, 662 y 663 se arman en Deco (deja sin efecto, para ellas, lo de D37).
-- Entran a gt.demanda_producto por consumo: 3 + 4 + 4 = 11 cajas a fabricar sin conteo (1.641 → 1.652).
update gt.codigos set fabrica = true where codigo in ('661','662','663');
-- volver atrás: activo = true / fabrica = false con los mismos códigos

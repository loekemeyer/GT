-- gt_v159 (1.50, 05/10/2026): «Puesta a punto encoladora», un área que vive DENTRO de Encolado.
-- No sale en la botonera (app.js: DENTRO_DE = { PAPENC: "ENCOL" }): es un botón en la pantalla del código de Encolado.
-- Sin código ni cantidad; productivo (cuenta como primer trabajo del día). Al terminarla se propone seguir en Encolado.
-- Rollback: update gt.rubros set activo = false where codigo = 'PAPENC'
insert into gt.rubros (codigo, nombre, unidad, orden, activo, pide_codigo, pide_cantidad, planta, todas_plantas, familia_sin_moldura, productivo)
values ('PAPENC', 'Puesta a punto encoladora', '—', 32, true, false, false, null, false, false, true)
on conflict (codigo) do nothing

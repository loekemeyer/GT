-- 1.64 (Elías, 16/10/2026): «En contraído faltaría agregar armado de cajas».
-- Mismo molde que PAPENC (1.50): área que vive DENTRO de Contraído (app.js: DENTRO_DE = { ARMCAJ: "CONTR" }),
-- botón en la pantalla del código de Contraído y «Terminar e ir a» al cerrar Contraído. Sin código ni cantidad, productiva.
-- Rollback: update gt.rubros set activo = false where codigo = 'ARMCAJ'
insert into gt.rubros (codigo, nombre, unidad, orden, activo, pide_codigo, pide_cantidad, planta, todas_plantas, familia_sin_moldura, productivo)
values ('ARMCAJ', 'Armado de cajas', '—', 33, true, false, false, null, false, false, true)
on conflict (codigo) do nothing;
-- D15 (Elías, 16/10): pide cantidad. update gt.rubros set pide_cantidad = true, unidad = 'cajas armadas' where codigo = 'ARMCAJ';

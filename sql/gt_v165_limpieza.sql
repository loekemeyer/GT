-- GT v1.54 — «🧹 Limpieza», igual que Movimientos (05/10/2026: «agregá botón limpieza»).
-- Rollback: update gt.rubros set activo = false where codigo = 'LIMP';
-- Sin código ni cantidad, no productiva (gt.pausas_seg la descuenta del área que queda abajo), en todas las plantas.
-- En el celular: PAUSA_DENTRO / PAUSAS de app.js y PAUSAS de admin.html.
insert into gt.rubros (codigo, nombre, unidad, orden, activo, pide_codigo, pide_cantidad, productivo, todas_plantas, planta)
values ('LIMP', 'Limpieza', '—', 32, true, false, false, false, true, null)
on conflict (codigo) do nothing;
-- verificación
select codigo, nombre, orden, activo, productivo, todas_plantas from gt.rubros where codigo in ('MOVIM', 'BANO', 'LIMP') order by orden;

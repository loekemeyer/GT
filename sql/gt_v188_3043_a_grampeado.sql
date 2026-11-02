-- GT v188 — el 3043 «Bastidor 556 Cajón Porta Cubiertos» pasa de Deco a Grampeado (Thomas, 02/11/2026: «Ponelo en grampeado»).
-- Contexto: se cargó en Deco el 07/10 (foto del tablero de bastidores y aros). En Deco no se usó nunca; el 02/11 un operario
-- ya lo tipeó en Grampeado (1 registro, fuera de lista hasta este cambio).
-- Efecto: aparece en «¿Qué vas a grampear?»; al cerrarse suma al depósito «aro» como código 3043. No tiene piezas de corte
-- en gt.aro_piezas, así que el cierre no descuenta piezas y deja la nota «no se encontró la pieza de corte».
-- Rollback: delete from gt.codigos_rubro where rubro = 'GRAMP' and codigo = '3043';
--           update gt.codigos_rubro set activo = true where rubro = 'DECO' and codigo = '3043';
insert into gt.codigos_rubro (rubro, codigo, descripcion, medida, activo)
values ('GRAMP', '3043', 'Bastidor 556 Cajón Porta Cubiertos', null, true)
on conflict (rubro, codigo) do update set descripcion = excluded.descripcion, activo = true;
update gt.codigos_rubro set activo = false where rubro = 'DECO' and codigo = '3043';

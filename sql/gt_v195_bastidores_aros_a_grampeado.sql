-- GT v195 — el tablero «Cod · Descripción · Código Bastidor · Código Aro» pasa entero de Deco a Grampeado (23/11/2026).
-- Pedido: Lautaro Durante, 19/11/2026 17:00 (WhatsApp, con la foto del tablero): «El código 3011 no está en grampeado».
-- Contexto: los 15 códigos del tablero se cargaron en Deco el 07/10. El 3043 ya había pasado a Grampeado (gt_v188, 02/11).
-- Uso medido al 23/11 09:23: en Deco, 0 registros de los 14 restantes. En Grampeado se tipeaban fuera de la lista
-- 3011 (Luis Luna 08/10, Lautaro Durante 19 y 20/11), 3018, 3031, 3032 y 3034 (Juan Gimenez).
-- Efecto: aparecen en «¿Qué vas a grampear?» con su descripción. Stock: sin cambios (gt.movimientos ya sumaba esos
-- registros al depósito «aro» y descontaba GRAMPA; sólo desaparece la nota «código fuera de la lista»). Probado en
-- transacción abortada: aro 3011 +32, 3018 +20, 3031 +72, 3032 +112, 3034 +137, GRAMPA −2.984, igual antes y después.
-- D96 (3031/3033/3035 «Bastidor» y 3084/3086/3088 «Panal + Bastidor + Tapa», dos procesos) no cambia: los 308x siguen en Deco.
-- Rollback:
--   update gt.codigos_rubro set activo = false where rubro = 'GRAMP' and codigo in (<los 14>);
--   update gt.codigos_rubro set activo = true  where rubro = 'DECO'  and codigo in (<los 14>);
insert into gt.codigos_rubro (rubro, codigo, descripcion, medida, activo)
select 'GRAMP', codigo, descripcion, null, true
from gt.codigos_rubro
where rubro = 'DECO'
  and codigo in ('3010','3011','3012','3013','3018','3028','3029','3030','3031','3032','3033','3034','3035','3036')
on conflict (rubro, codigo) do update set descripcion = excluded.descripcion, activo = true;

update gt.codigos_rubro set activo = false
where rubro = 'DECO'
  and codigo in ('3010','3011','3012','3013','3018','3028','3029','3030','3031','3032','3033','3034','3035','3036');

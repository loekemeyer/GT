-- GT v196 — los 15 bastidores y aros del tablero quedan activos en Deco Y en Grampeado (Thomas, 23/11/2026:
-- «Que estén en deco y en grampeado»). Reemplaza la parte de gt_v195 (y de gt_v188 para el 3043) que los apagaba en Deco.
-- Stock: gt.movimientos cruza codigos_rubro por (rubro = área del registro), así que un código en los dos rubros no se
-- cuenta dos veces. Deco no mueve stock por código (sólo Corte y Grampeado).
-- Rollback: update gt.codigos_rubro set activo = false where rubro = 'DECO' and codigo in (<los 15>);
update gt.codigos_rubro set activo = true
where rubro = 'DECO'
  and codigo in ('3010','3011','3012','3013','3018','3028','3029','3030','3031','3032','3033','3034','3035','3036','3043');

-- gt_v175 (Thomas, 21/10/2026, D7): «El 348 no utiliza vidrio».
-- La regla 6 (Montaje de porta / múltiple / c/Vidrio → VIDRIO {medida}) deja afuera también los «Porta Cubo Colgante»:
-- el 348 (30*40) y el 346 (15*21), que es el mismo producto en otra medida [Probable]. Ninguno se registró nunca en Montaje.
-- El FONDO de la regla 7 no cambia.
-- D6 (Thomas: la tapa con bisagras ya llega con el vidrio puesto cuando se arma todo junto en el 3084/3086/3088): el vidrio
-- se pone antes, en la tapa, pero ningún paso registra eso. El 3084/3086/3088 consume una tapa (con su vidrio) por caja,
-- así que el descuento de gt_v173 queda ahí. Lo único que no ve: tapas ya armadas con vidrio que todavía no entraron a una caja.
-- Rollback: update gt.insumo_regla set excluye = 'Difusor|Vela|Sahumerio|Cepillo|Broche' where id = 6;
update gt.insumo_regla
   set excluye = 'Difusor|Vela|Sahumerio|Cepillo|Broche|Cubo Colgante',
       nota = nota || ' · gt_v175 (Thomas 21/10): Porta Cubo Colgante sin vidrio'
 where id = 6 and excluye = 'Difusor|Vela|Sahumerio|Cepillo|Broche';

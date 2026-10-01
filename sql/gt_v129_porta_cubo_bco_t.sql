-- GT — el Porta Cubo arma con los aros Bco T chicos (Thomas, 01/10/2026: «Bco T es cubo», D24).
-- Corrige la lectura de D6 en sql/gt_v125_pintado_paquetes_cubo.sql (814/815/816 → 066/067/068 Bco P).
-- Con esto 790–793 y 814–816 usan los Bco T 063/064/065, que Corte resuelve solo con las piezas Bco Total
-- 136–141. Los Bco P chicos 066/067/068 no los usa hoy ningún producto del catálogo.
-- Rollback: el mismo update con viejo y nuevo invertidos.
update gt.receta_aro r set aro = v.nuevo,
       nota = 'Thomas 01/10 (D24): «Bco T es cubo» → el Porta Cubo arma con los aros 3P 3/4 Bco T chicos'
  from (values ('814','10*15','066','063'), ('815','13*18','067','064'), ('816','15*21','068','065')) v(producto, pieza, viejo, nuevo)
 where r.producto = v.producto and r.pieza = v.pieza and r.aro = v.viejo;

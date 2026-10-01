-- GT — gt.producto_aro como quedó en 1.25 + colores (commit 38354b7). Es el ROLLBACK de sql/gt_v127_surtidos_paquete_corte.sql.
-- La versión nueva agrega dos columnas al final (color, proporcion): para volver hay que hacer
-- drop view gt.producto_aro cascade (se lleva gt.movimientos) y correr esto + sql/gt_movimientos_vivo.sql.
create or replace view gt.producto_aro with (security_invoker = true) as
 WITH pp AS (
         SELECT p.producto,
            p.pieza,
            p.mult,
            gt.perfil_producto(c.descripcion) AS perfil,
            c.descripcion ~* 'soga'::text AS soga,
            ( SELECT max(cc.color) AS max
                   FROM gt.codigo_color cc
                  WHERE cc.codigo = p.producto
                 HAVING count(*) = 1) AS color,
            gt.med_norm(
                CASE
                    WHEN c.descripcion !~* '^Porta\s'::text AND (replace(p.pieza, ' '::text, ''::text) = ANY (ARRAY['10*30'::text, '20*30'::text, '30*30'::text, '30*40'::text])) THEN regexp_replace(replace(p.pieza, ' '::text, ''::text), '30'::text, '27.5'::text, 'g'::text)
                    ELSE p.pieza
                END) AS med_aro
           FROM gt.producto_piezas p
             JOIN gt.codigos c ON c.codigo = p.producto
        ), aro AS (
         SELECT codigos_rubro.codigo,
            gt.perfil_aro(codigos_rubro.descripcion) AS perfil,
            gt.med_norm(codigos_rubro.medida) AS med,
            gt.color_aro(codigos_rubro.descripcion) AS color,
            codigos_rubro.descripcion ~* 'p/soga'::text AS soga
           FROM gt.codigos_rubro
          WHERE codigos_rubro.rubro = 'GRAMP'::text AND codigos_rubro.activo
        ), cand AS (
         SELECT pp_1.producto,
            pp_1.pieza,
            count(a.codigo) AS n,
            min(a.codigo) AS unico,
            string_agg(a.codigo, ' / '::text ORDER BY a.codigo) AS opciones
           FROM pp pp_1
             LEFT JOIN aro a ON a.perfil = pp_1.perfil AND a.med = pp_1.med_aro AND a.soga = pp_1.soga AND (pp_1.color IS NULL OR a.color = pp_1.color OR pp_1.color = 'Blanco'::text AND a.color = 'Blanco total'::text)
          WHERE pp_1.perfil IS NOT NULL
          GROUP BY pp_1.producto, pp_1.pieza
        )
 SELECT pp.producto,
    pp.pieza,
    pp.perfil,
    pp.med_aro,
        CASE
            WHEN r.aro IS NOT NULL THEN NULLIF(r.aro, '-'::text)
            WHEN cand.n = 1 THEN cand.unico
            ELSE NULL::text
        END AS aro,
    COALESCE(r.cant, 1::numeric) * pp.mult::numeric AS cant,
        CASE
            WHEN r.aro IS NOT NULL THEN 'receta'::text
            WHEN cand.n = 1 THEN
            CASE
                WHEN pp.color IS NULL THEN 'auto'::text
                ELSE 'color'::text
            END
            ELSE 'sin receta'::text
        END AS receta,
    cand.opciones
   FROM pp
     JOIN cand USING (producto, pieza)
     LEFT JOIN gt.receta_aro r ON r.producto = pp.producto AND (r.pieza = pp.pieza OR r.pieza = ''::text);
revoke all on gt.producto_aro from anon, authenticated;

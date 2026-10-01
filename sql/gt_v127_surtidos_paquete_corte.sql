-- GT 1.26 — colores confirmados, surtidos repartidos parejo y «terminé el paquete» en Corte (Thomas, 01/10/2026).
--
-- Colores (Thomas): 080 a 089 sin marco · 183 y 211 negro · 217, 233, 275 y 276 natural ·
--   362, 366 y 370 importados, no usan marco · 690 a 694: 1/4 de cada color (Roble, Verde, Marrón, Cedro) ·
--   «Los códigos con varios colores: reparto parejo entre los colores indicados».
-- D15: «en promedio 2 metros de largo las varillas. Cantidad de varillas depende por moldura. En 03 deberían
--   ser 100 varillas. Hagamos que cuando terminen un paquete pongan terminé (en Corte) así empezás a tener registros».
--
-- Qué cambia:
--   · gt.producto_aro da UNA FILA POR COLOR en los surtidos, con cant × proporción (sin proporción cargada:
--     1/n, reparto parejo). Columnas nuevas al final: color, proporcion. «Sin marco» sale con receta 'sin marco'.
--   · gt.moldura_paquete: 03 = 200 m (100 varillas de 2 m).
--   · Corte pregunta al terminar «¿Terminaste el paquete de moldura?» (gt.rubro_pasos, momento terminar).
--   · gt.corte_paquetes: metros de piezas cortadas entre un «sí» y el siguiente, por moldura y color.
--     gt.moldura_paquete_medido: promedio por moldura de los paquetes completos, contra lo cargado.
--
-- Rollback (lo corre el dueño en el SQL Editor; el conector no deja DROP ni DELETE):
--   delete from gt.rubro_pasos where rubro = 'CORTE' and campo = 'paquete';
--   delete from gt.moldura_paquete where moldura = '03';
--   delete from gt.codigo_color where fuente = 'Thomas 01/10';
--   drop view gt.moldura_paquete_medido; drop view gt.corte_paquetes;
--   drop view gt.producto_aro cascade;  -- se lleva gt.movimientos
--   y recrear gt.producto_aro con sql/gt_producto_aro_v126_vivo.sql y gt.movimientos con sql/gt_movimientos_vivo.sql

-- 1) colores que confirmó Thomas
insert into gt.codigo_color (codigo, color, proporcion, fuente, nota) values
  ('183', 'Negro',     null, 'Thomas 01/10', null),
  ('211', 'Negro',     null, 'Thomas 01/10', null),
  ('217', 'Natural',   null, 'Thomas 01/10', null),
  ('233', 'Natural',   null, 'Thomas 01/10', null),
  ('275', 'Natural',   null, 'Thomas 01/10', 'Lino'),
  ('276', 'Natural',   null, 'Thomas 01/10', 'Lino'),
  ('362', 'Sin marco', null, 'Thomas 01/10', 'importado, no usa marco'),
  ('366', 'Sin marco', null, 'Thomas 01/10', 'importado, no usa marco'),
  ('370', 'Sin marco', null, 'Thomas 01/10', 'importado, no usa marco'),
  ('690', 'Roble', 0.25, 'Thomas 01/10', 'surtido 1/4 por color'), ('690', 'Verde', 0.25, 'Thomas 01/10', 'surtido 1/4 por color'),
  ('690', 'Marrón', 0.25, 'Thomas 01/10', 'surtido 1/4 por color'), ('690', 'Cedro', 0.25, 'Thomas 01/10', 'surtido 1/4 por color'),
  ('691', 'Roble', 0.25, 'Thomas 01/10', 'surtido 1/4 por color'), ('691', 'Verde', 0.25, 'Thomas 01/10', 'surtido 1/4 por color'),
  ('691', 'Marrón', 0.25, 'Thomas 01/10', 'surtido 1/4 por color'), ('691', 'Cedro', 0.25, 'Thomas 01/10', 'surtido 1/4 por color'),
  ('692', 'Roble', 0.25, 'Thomas 01/10', 'surtido 1/4 por color'), ('692', 'Verde', 0.25, 'Thomas 01/10', 'surtido 1/4 por color'),
  ('692', 'Marrón', 0.25, 'Thomas 01/10', 'surtido 1/4 por color'), ('692', 'Cedro', 0.25, 'Thomas 01/10', 'surtido 1/4 por color'),
  ('693', 'Roble', 0.25, 'Thomas 01/10', 'surtido 1/4 por color'), ('693', 'Verde', 0.25, 'Thomas 01/10', 'surtido 1/4 por color'),
  ('693', 'Marrón', 0.25, 'Thomas 01/10', 'surtido 1/4 por color'), ('693', 'Cedro', 0.25, 'Thomas 01/10', 'surtido 1/4 por color'),
  ('694', 'Roble', 0.25, 'Thomas 01/10', 'surtido 1/4 por color'), ('694', 'Verde', 0.25, 'Thomas 01/10', 'surtido 1/4 por color'),
  ('694', 'Marrón', 0.25, 'Thomas 01/10', 'surtido 1/4 por color'), ('694', 'Cedro', 0.25, 'Thomas 01/10', 'surtido 1/4 por color')
on conflict (codigo, color) do nothing;

-- 2) D15: un paquete de moldura 03 trae 100 varillas de 2 m
insert into gt.moldura_paquete (moldura, metros_por_paquete, nota)
values ('03', 200, 'Thomas 01/10: 100 varillas de 2 m en promedio') on conflict (moldura) do nothing;

-- 3) D15: Corte pregunta al terminar si se terminó el paquete
insert into gt.rubro_pasos (rubro, orden, campo, pregunta, opciones, fuente, si_campo, si_valor, momento)
values ('CORTE', 1, 'paquete', '¿Terminaste el paquete de moldura?', array['Sí', 'No'], null, null, null, 'terminar')
on conflict (rubro, orden) do nothing;

-- 4) gt.producto_aro: una fila por color (definición viva de 1.25 + el reparto)
create or replace view gt.producto_aro with (security_invoker = true) as
 WITH col AS (
         SELECT cc.codigo,
            cc.color,
            COALESCE(cc.proporcion, 1.0 / count(*) OVER (PARTITION BY cc.codigo)::numeric) AS prop
           FROM gt.codigo_color cc
        ), pp AS (
         SELECT p.producto,
            p.pieza,
            p.mult,
            gt.perfil_producto(c.descripcion) AS perfil,
            c.descripcion ~* 'soga'::text AS soga,
            col.color,
            COALESCE(col.prop, 1::numeric) AS prop,
            gt.med_norm(
                CASE
                    WHEN c.descripcion !~* '^Porta\s'::text AND (replace(p.pieza, ' '::text, ''::text) = ANY (ARRAY['10*30'::text, '20*30'::text, '30*30'::text, '30*40'::text])) THEN regexp_replace(replace(p.pieza, ' '::text, ''::text), '30'::text, '27.5'::text, 'g'::text)
                    ELSE p.pieza
                END) AS med_aro
           FROM gt.producto_piezas p
             JOIN gt.codigos c ON c.codigo = p.producto
             LEFT JOIN col ON col.codigo = p.producto
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
            pp_1.color,
            count(a.codigo) AS n,
            min(a.codigo) AS unico,
            string_agg(a.codigo, ' / '::text ORDER BY a.codigo) AS opciones
           FROM pp pp_1
             LEFT JOIN aro a ON a.perfil = pp_1.perfil AND a.med = pp_1.med_aro AND a.soga = pp_1.soga AND (pp_1.color IS NULL OR a.color = pp_1.color OR pp_1.color = 'Blanco'::text AND a.color = 'Blanco total'::text)
          WHERE pp_1.perfil IS NOT NULL
          GROUP BY pp_1.producto, pp_1.pieza, pp_1.color
        )
 SELECT pp.producto,
    pp.pieza,
    pp.perfil,
    pp.med_aro,
        CASE
            WHEN r.aro IS NOT NULL THEN NULLIF(r.aro, '-'::text)
            WHEN pp.color = 'Sin marco'::text THEN NULL::text
            WHEN cand.n = 1 THEN cand.unico
            ELSE NULL::text
        END AS aro,
    COALESCE(r.cant, 1::numeric) * pp.mult::numeric * pp.prop AS cant,
        CASE
            WHEN r.aro IS NOT NULL THEN 'receta'::text
            WHEN pp.color = 'Sin marco'::text THEN 'sin marco'::text
            WHEN cand.n = 1 THEN
            CASE
                WHEN pp.color IS NULL THEN 'auto'::text
                ELSE 'color'::text
            END
            ELSE 'sin receta'::text
        END AS receta,
    cand.opciones,
    pp.color,
    pp.prop AS proporcion
   FROM pp
     JOIN cand ON cand.producto = pp.producto AND cand.pieza = pp.pieza AND NOT cand.color IS DISTINCT FROM pp.color
     LEFT JOIN gt.receta_aro r ON r.producto = pp.producto AND (r.pieza = pp.pieza OR r.pieza = ''::text);
revoke all on gt.producto_aro from anon, authenticated;

-- 5) D15: metros de piezas cortadas por paquete. Un paquete = lo cortado de esa moldura y color desde el «sí»
--    anterior hasta el «sí» siguiente. El primero de cada moldura empezó antes del registro: no es completo.
create or replace view gt.corte_paquetes with (security_invoker = true) as
 WITH c AS (
         SELECT r.id AS registro_id,
            r.ts_cliente AS ts,
            r.empleado_id,
            btrim(cr.descripcion) AS perfil,
            (regexp_match(cr.descripcion, '^(3P \d/\d|Trav \d+mm|\d+)'::text))[1] AS moldura,
            r.cantidad AS piezas,
            r.cantidad * NULLIF(regexp_replace(replace(COALESCE(cr.medida, ''::text), ','::text, '.'::text), '[^0-9.]'::text, ''::text, 'g'::text), ''::text)::numeric / 100::numeric AS metros,
            COALESCE(r.detalle ->> 'paquete'::text, ''::text) = 'Sí'::text AS fin
           FROM gt.registros r
             JOIN gt.codigos_rubro cr ON cr.rubro = 'CORTE'::text AND gt.sin0(cr.codigo) = gt.sin0(btrim(r.texto))
          WHERE r.opcion = 'AREA'::text AND r.rubro = 'CORTE'::text AND r.ts_inicio IS NOT NULL AND r.cantidad IS NOT NULL
        ), s AS (
         SELECT c.*,
            COALESCE(sum(CASE WHEN c.fin THEN 1 ELSE 0 END) OVER (PARTITION BY c.perfil ORDER BY c.ts, c.registro_id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0::bigint) AS nro
           FROM c
        )
 SELECT perfil,
    moldura,
    nro + 1 AS paquete,
    min(ts) AS desde,
    max(ts) AS hasta,
    count(*) AS tramos,
    sum(piezas) AS piezas,
    round(sum(metros), 2) AS metros,
    bool_or(fin) AS terminado,
    nro > 0 AND bool_or(fin) AS completo
   FROM s
  GROUP BY perfil, moldura, nro;
revoke all on gt.corte_paquetes from anon, authenticated;

create or replace view gt.moldura_paquete_medido with (security_invoker = true) as
 SELECT cp.moldura,
    count(*) AS paquetes,
    round(avg(cp.metros), 1) AS metros_promedio,
    min(cp.metros) AS metros_min,
    max(cp.metros) AS metros_max,
    mp.metros_por_paquete AS metros_cargados,
    round(avg(cp.metros) / NULLIF(mp.metros_por_paquete, 0::numeric) * 100::numeric, 1) AS aprovechamiento_pct
   FROM gt.corte_paquetes cp
     LEFT JOIN gt.moldura_paquete mp ON mp.moldura = cp.moldura
  WHERE cp.completo
  GROUP BY cp.moldura, mp.metros_por_paquete;
revoke all on gt.moldura_paquete_medido from anon, authenticated;

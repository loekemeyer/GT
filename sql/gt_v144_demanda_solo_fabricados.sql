-- GT gt_v144 (D37, Thomas 01/10/2026: «sí») — lo que GT NO FABRICA no entra a la demanda de fabricación.
-- gt.codigos.fabrica (default true): false = reventa / importado. gt.demanda_producto filtra `c.fabrica`, y con ella
-- caen gt.demanda_aros, gt.demanda_corte y gt.demanda_insumos (todas cuelgan de demanda_producto).
--
-- Marcados en false el 01/10:
--   los que nombró Thomas (14, 22 cajas de demanda ese día): Caja 661 662 663 · Cesto 619 620 621 622 623 625 626 ·
--   Estante 898 899 · Jabonera 920 · Set 900 (cestos de bambú)
--   [Probable] los hermanos de reventa, sin demanda ese día (24): Jarron 869 870 910 a 915 · Libro 903 a 907 ·
--   Frasco 863 a 866 · Individual 916 917 918 · Maceta 908 909 · Canasto 901 · Set 902 (canastos de hierro)
--   Quedan como FABRICADOS (no se tocaron): todo lo que lleva «Mold» (cuelgas, arbolito, letrero, mini cartel), los
--   sets de bandejas galvanizadas 518 / 518G / 519 / 519G / 660, Cartel Flecha 527, Org.Canasta 615, Percheros 632 y
--   Secaplatos 557. Si alguno es reventa: update gt.codigos set fabrica = false where codigo = '…'.
--
-- ROLLBACK: update gt.codigos set fabrica = true (y la vista sigue filtrando una columna siempre true).
-- La vista es la definición VIVA (pg_get_viewdef del 01/10, gt_v138) más `AND c.fabrica` en el WHERE de `base`.

alter table gt.codigos add column if not exists fabrica boolean not null default true;
comment on column gt.codigos.fabrica is 'gt_v144 (D37): false = GT no lo fabrica (reventa / importado): no entra a gt.demanda_producto ni a lo que cuelga de ella.';

update gt.codigos set fabrica = false
 where codigo in ('661','662','663', '619','620','621','622','623','625','626', '898','899', '920', '900',
                  '869','870','910','911','912','913','914','915', '903','904','905','906','907', '863','864','865','866',
                  '916','917','918', '908','909', '901', '902');

-- gt.demanda_producto COMPLETA como quedó aplicada (la viva de gt_v138 + `AND c.fabrica` en el WHERE de `base`).
-- Antes de volver a tocarla, traer la viva: select pg_get_viewdef('gt.demanda_producto'::regclass, true);
create or replace view gt.demanda_producto with (security_invoker = true) as
 WITH cfg AS (
         SELECT COALESCE(( SELECT NULLIF(btrim(config.valor), ''::text)::numeric AS "nullif"
                   FROM gt.config
                  WHERE config.clave = 'consumo_meses_cobertura'::text), 1.5) AS cobertura
        ), ped AS (
         SELECT i.codigo,
            sum(i.cajas - i.cajas_armadas) AS cajas,
            count(DISTINCT p.id) AS pedidos,
            min(p.fecha) AS pedido_mas_viejo
           FROM gt.pedido_items i
             JOIN gt.pedidos p ON p.id = i.pedido_id
          WHERE (p.estado = ANY (ARRAY['abierto'::text, 'parcial'::text])) AND i.cajas > i.cajas_armadas
          GROUP BY i.codigo
        ), st AS (
         SELECT stock.codigo,
            sum(stock.saldo) FILTER (WHERE stock.deposito = 'gondola'::text) AS gondola_u,
            sum(stock.saldo) FILTER (WHERE stock.deposito = ANY (ARRAY['encolado'::text, 'montado'::text, 'gancho'::text, 'emblistado'::text, 'contraido'::text])) AS proceso_u,
            bool_or(stock.con_conteo) FILTER (WHERE stock.deposito = 'gondola'::text) AS gondola_contada
           FROM gt.stock
          GROUP BY stock.codigo
        ), base AS (
         SELECT c.codigo,
            c.descripcion,
            c.uxb,
            gt.grupo_codigo(c.codigo) AS grupo,
            pm.maximo_cajas,
            COALESCE(pm.maximo_consumo_cajas,
                CASE
                    WHEN ct.proy_cajas_mes > 0::numeric THEN ceil(ct.proy_cajas_mes * cfg.cobertura)
                    ELSE NULL::numeric
                END) AS maximo_consumo_cajas,
            ped.cajas AS pedidos_cajas,
            ped.pedidos,
            ped.pedido_mas_viejo,
            round(COALESCE(st.gondola_u, 0::numeric) / c.uxb::numeric, 2) AS gondola_cajas,
            round(COALESCE(st.proceso_u, 0::numeric) / c.uxb::numeric, 2) AS proceso_cajas,
            COALESCE(st.gondola_contada, false) AS gondola_contada,
                CASE
                    WHEN pm.maximo_consumo_cajas IS NOT NULL THEN 'consumo manual'::text
                    WHEN ct.proy_cajas_mes > 0::numeric THEN 'consumo'::text
                    WHEN pm.maximo_cajas IS NOT NULL THEN 'gondola'::text
                    ELSE NULL::text
                END AS maximo_rige,
            ct.proy_cajas_mes AS consumo_cajas_mes,
            ct.fuente AS consumo_fuente
           FROM gt.codigos c
             CROSS JOIN cfg
             LEFT JOIN gt.producto_max pm ON pm.codigo = c.codigo
             LEFT JOIN gt.consumo_tn ct ON ct.cod = c.codigo
             LEFT JOIN ped ON ped.codigo = c.codigo
             LEFT JOIN st ON st.codigo = c.codigo
          WHERE c.activo AND c.fabrica AND (pm.codigo IS NOT NULL OR ped.codigo IS NOT NULL OR ct.proy_cajas_mes > 0::numeric)   -- gt_v144 (D37): sólo lo que GT fabrica
        ), calc AS (
         SELECT b.codigo,
            b.descripcion,
            b.uxb,
            b.grupo,
            b.maximo_cajas,
            b.maximo_consumo_cajas,
            b.pedidos_cajas,
            b.pedidos,
            b.pedido_mas_viejo,
            b.gondola_cajas,
            b.proceso_cajas,
            b.gondola_contada,
            b.maximo_rige,
            b.consumo_cajas_mes,
            b.consumo_fuente,
            COALESCE(b.maximo_consumo_cajas, b.maximo_cajas) AS maximo_rige_cajas
           FROM base b
        )
 SELECT codigo,
    descripcion,
    uxb,
    grupo,
    maximo_cajas,
    pedidos_cajas,
    pedidos,
    pedido_mas_viejo,
    gondola_cajas,
    proceso_cajas,
    gondola_contada,
    COALESCE(maximo_rige_cajas, 0::numeric) + COALESCE(pedidos_cajas, 0::numeric) AS objetivo_cajas,
    GREATEST(0::numeric, COALESCE(maximo_rige_cajas, 0::numeric) + COALESCE(pedidos_cajas, 0::numeric) - gondola_cajas) AS a_fabricar_cajas,
    GREATEST(0::numeric, COALESCE(maximo_rige_cajas, 0::numeric) + COALESCE(pedidos_cajas, 0::numeric) - gondola_cajas - proceso_cajas) AS a_empezar_cajas,
    NULLIF(concat_ws(' · '::text,
        CASE WHEN NOT gondola_contada THEN 'góndola sin conteo: se toma 0'::text ELSE NULL::text END,
        CASE WHEN maximo_rige = 'gondola'::text THEN 'sin consumo: rige el máximo de góndola'::text ELSE NULL::text END,
        CASE WHEN maximo_rige IS NULL AND pedidos_cajas IS NOT NULL THEN 'sin máximo ni consumo: sólo los pedidos'::text ELSE NULL::text END), ''::text) AS nota,
    maximo_consumo_cajas,
    maximo_rige,
        CASE
            WHEN maximo_consumo_cajas IS NOT NULL AND maximo_cajas IS NOT NULL THEN GREATEST(0::numeric, maximo_consumo_cajas - maximo_cajas)
            ELSE NULL::numeric
        END AS supera_gondola_cajas,
    consumo_cajas_mes,
    consumo_fuente
   FROM calc;
revoke all on gt.demanda_producto from anon, authenticated;

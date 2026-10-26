-- gt_v182 (26/10/2026): el stock de CAJAS. Pedido (cuando se anota «Armado de cajas» en Contraído):
--   «arman las cajas para todo lo que van a [contraer]… pueden armar 50 cajas de la 4015 y no son de un solo artículo… tiene que aparecerles
--    botones con los números de caja, que anoten la cantidad y eso aumente el stock de cajas armadas y descuente del stock de cajas como
--    insumo. Y cuando contrajeron el 134, si armaron 10 cajas, descuente 10 cajas de la caja 4015.» (la «4015» es la caja 40*15)
-- Lo que hace:
--   1) ARMCAJ (cierre con cantidad, código = la caja): + deposito `caja_armada` de ESA caja y − insumo `CAJA <caja>` (la caja plana que se compra).
--      El descuento de la plana usa lo que ya existía (gt.codigos_rubro.insumo / insumo_cant, como el vidrio de Deco): sin cambiar la vista.
--   2) CONTR (cierre con cantidad): − `caja_armada` de la caja que usa ese artículo (gt.codigos.caja, gt_v181). Cuenta CAJAS: 10 cajas del 134 = 10 de la 40*15.
--      La caja armada NO es de un artículo: se descuenta de la caja, no del artículo. Artículo sin caja cargada = no descuenta nada (ver gt.demanda_cajas).
--   3) gt.demanda_cajas: por caja, cuántas hacen falta (lo que falta fabricar y todavía no se contrajo), cuántas hay armadas, cuántas armar y si
--      «NO ARMAR MÁS». Es la base del monitor en vivo. Cálculo igual al de gt.demanda_producto: sin conteo de las armadas se toma 0 y lo dice el estado.
--   4) gt.stock dice «cajas» para el depósito caja_armada.
-- ⚠ Hasta que alguien CUENTE las cajas armadas y las planas, el saldo es sólo movimiento (el Contraído desde el 02/10 ya descontaría sin que
--   el armado, que arrancó el 21/10, lo compense). El conteo va en gt.stock_inicial (deposito `caja_armada` y `insumo` con codigo `CAJA <caja>`):
--   los movimientos anteriores a contado_en dejan de contar solos.
-- gt.movimientos y gt.stock se cambian SOBRE LA DEFINICIÓN VIVA (pg_get_viewdef), controlando que el ancla aparezca exactamente 1 vez.
-- Rollback: sql/gt_v182_rollback.sql
-- ⚠ Sin punto y coma dentro de los textos entre comillas ni de los comentarios (el conector parte el pedido por esa marca).

-- 1) catálogo de la caja plana (insumo) y su descuento al armar
insert into gt.insumos (codigo, nombre, unidad, activo, nota)
select 'CAJA ' || codigo, 'Caja ' || codigo || ' (plana, sin armar)', 'u', true,
       'Se descuenta al registrar Armado de cajas de esa caja (gt_v182). Conteo: gt.stock_inicial deposito insumo.'
  from gt.codigos_rubro
 where rubro = 'ARMCAJ'
on conflict (codigo) do nothing;

update gt.codigos_rubro
   set insumo = 'CAJA ' || codigo, insumo_cant = -1
 where rubro = 'ARMCAJ' and insumo is null;

-- 2) gt.movimientos: + caja_armada al armar, − caja_armada al contraer (sobre la definición viva)
do $mov$
declare
  v     text := pg_get_viewdef('gt.movimientos'::regclass, true);
  ancla text := 'gt.sin0(cri.codigo) = gt.sin0(r.texto)';
  veces int;
begin
  if position('caja_armada' in v) > 0 then
    return;   -- ya aplicado
  end if;
  veces := (length(v) - length(replace(v, ancla, ''))) / length(ancla);
  if veces <> 1 then
    raise exception 'gt.movimientos: el ancla aparece % veces (esperaba 1): la definicion viva cambio', veces;
  end if;
  execute 'create or replace view gt.movimientos as ' || replace(v, ancla, ancla || $n$

        UNION ALL
         SELECT r.registro_id,
            r.ts,
            r.dia,
            r.empleado_id,
            r.planta,
            r.area,
            'caja_armada'::text,
            r.texto,
            NULL::text,
            r.cantidad,
            'ok'::text,
            NULL::text
           FROM r
          WHERE r.area = 'ARMCAJ'::text
        UNION ALL
         SELECT rp.registro_id,
            rp.ts,
            rp.dia,
            rp.empleado_id,
            rp.planta,
            rp.area,
            'caja_armada'::text,
            cj.caja,
            NULL::text,
            - (rp.u / COALESCE(NULLIF(cj.uxb, 0), 1)::numeric),
            'ok'::text,
            rp.nota
           FROM rp
             JOIN gt.codigos cj ON cj.codigo = rp.producto AND cj.caja IS NOT NULL
          WHERE rp.area = 'CONTR'::text$n$);
  alter view gt.movimientos set (security_invoker = true);
end
$mov$;

-- 3) gt.stock: la unidad del depósito caja_armada
do $stk$
declare
  v     text := pg_get_viewdef('gt.stock'::regclass, true);
  ancla text := $a$WHEN 'moldura_pintada'::text THEN 'paquetes'::text$a$;
  veces int;
begin
  if position('caja_armada' in v) > 0 then
    return;   -- ya aplicado
  end if;
  veces := (length(v) - length(replace(v, ancla, ''))) / length(ancla);
  if veces <> 1 then
    raise exception 'gt.stock: el ancla aparece % veces (esperaba 1)', veces;
  end if;
  execute 'create or replace view gt.stock as ' || replace(v, ancla, ancla || $n$
            WHEN 'caja_armada'::text THEN 'cajas'::text$n$);
  alter view gt.stock set (security_invoker = true);
end
$stk$;

-- 4) gt.demanda_cajas: la base del monitor de cajas
create or replace view gt.demanda_cajas with (security_invoker = true) as
with falta as (   -- por artículo que GT fabrica: las cajas que todavía se van a contraer (lo que falta fabricar menos lo ya contraído)
  select c.caja, c.codigo,
         greatest(0, d.a_fabricar_cajas - greatest(0, coalesce(st.contraido_u, 0)) / coalesce(nullif(c.uxb, 0), 1)::numeric) as cajas
    from gt.demanda_producto d
    join gt.codigos c on c.codigo = d.codigo
    left join (select codigo, sum(saldo) as contraido_u from gt.stock where deposito = 'contraido' group by codigo) st
           on st.codigo = d.codigo
),
nec as (
  select coalesce(caja, '(sin caja)') as caja, count(*) as articulos, sum(cajas) as cajas
    from falta
   group by 1
),
arm as (
  select codigo as caja, sum(saldo) as saldo, bool_or(con_conteo) as contada
    from gt.stock
   where deposito = 'caja_armada'
   group by codigo
),
pla as (
  select substr(codigo, 6) as caja, sum(saldo) as saldo, bool_or(con_conteo) as contada
    from gt.stock
   where deposito = 'insumo' and codigo in (select 'CAJA ' || codigo from gt.codigos_rubro where rubro = 'ARMCAJ')
   group by 1
),
k as (
  select codigo as caja, 0 as ord from gt.codigos_rubro where rubro = 'ARMCAJ' and activo
  union all
  select '(sin caja)', 1
),
calc as (
  select k.caja, k.ord,
         coalesce(n.articulos, 0) as articulos,
         ceil(coalesce(n.cajas, 0)) as hacen_falta,
         a.saldo as armadas,
         coalesce(a.contada, false) as armadas_contadas,
         case when coalesce(a.contada, false) then a.saldo else 0 end as armadas_ref,
         p.saldo as planas,
         coalesce(p.contada, false) as planas_contadas
    from k
    left join nec n on n.caja = k.caja
    left join arm a on a.caja = k.caja
    left join pla p on p.caja = k.caja
)
select caja, articulos, hacen_falta, armadas, armadas_contadas,
       greatest(0, hacen_falta - armadas_ref) as a_armar,
       planas, planas_contadas,
       greatest(0, hacen_falta - armadas_ref - case when planas_contadas then planas else 0 end) as a_comprar,
       case
         when caja = '(sin caja)' then 'falta cargar la caja de ' || articulos || ' artículos'
         when hacen_falta = 0 then 'sin demanda'
         when not armadas_contadas then 'sin conteo de armadas: se toma 0'
         when hacen_falta - armadas_ref <= 0 then 'NO ARMAR MÁS: alcanzan (sobran ' || (armadas_ref - hacen_falta) || ')'
         else 'armar ' || (hacen_falta - armadas_ref)
       end as estado
  from calc
 where caja <> '(sin caja)' or articulos > 0
 order by ord, hacen_falta desc, caja;

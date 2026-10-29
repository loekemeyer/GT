-- ⚠ La definición vigente de gt.demanda_cajas está en gt_v185 (suma tono, etiqueta y corte_en al final). Esta queda como historia.
-- gt_v184 (29/10/2026): cuántas cajas hay que armar, en función de lo que está EMBLISTADO (Angely, 29/10).
--   «A las 12 te paso cuántas cajas armadas hay y cuántos artículos emblistados hay en ese momento, para hacer un corte.
--    Desde ahí te dice cuántas cajas tienen que armar en función de lo que se emblista, y descuenta cuando se contrae.»
--   «El stock de cajas está en dos estadios: la caja plana en pallet y la caja armada, que dura muy poco hasta que se contrae.
--    Por ahora no me importa el stock en pallet, sino el de cajas armadas.»
-- Reemplaza el cálculo de gt_v182 (lo que falta fabricar según la demanda) por LO EMBLISTADO que todavía no se contrajo:
--   hacen_falta = Σ por caja de (stock `emblistado` de cada artículo en cajas = unidades / UxB), con la caja de gt.codigos.caja.
--   armadas     = stock `caja_armada` de esa caja. a_armar = hacen_falta − armadas (mínimo 0).
--   Emblistar suma al hacen_falta. Contraer resta de emblistado Y de las armadas, así que a_armar no se mueve al contraer.
--   Armar suma a las armadas y baja el a_armar. Cuando las armadas alcanzan, el estado dice NO ARMAR MÁS (sólo avisa, no bloquea).
-- Las planas (pallet) siguen descontándose al armar pero el monitor no las muestra: columnas planas / a_comprar quedan en la vista por compatibilidad.
-- EL CORTE: hasta que exista un conteo de `emblistado` en gt.stock_inicial el estado dice «falta el corte» y hacen_falta vale 0
--   (el saldo de emblistado desde el 02/10 es sólo movimiento y da basura). El corte se carga con contado_en = la hora del conteo:
--     · caja_armada: una fila por cada una de las 22 cajas (0 si no hay), medida ''
--     · emblistado:  una fila por cada artículo que tenga caja o movimientos de emblistado (0 si no hay), medida ''
--   Sin la fila en cero, el historial anterior al corte seguiría contando.
-- Rollback: volver a correr el create or replace view de sql/gt_v182_cajas_stock_y_demanda.sql
-- Sin punto y coma dentro de textos ni comentarios (el conector parte el pedido por esa marca).
create or replace view gt.demanda_cajas with (security_invoker = true) as
with corte as (
  select exists (select 1 from gt.stock_inicial where deposito = 'emblistado') as hay
),
emb as (
  select coalesce(c.caja, '(sin caja)') as caja,
         count(*) filter (where s.saldo > 0) as articulos,
         sum(greatest(0, s.saldo) / coalesce(nullif(c.uxb, 0), 1)::numeric) as cajas
    from gt.stock s
    join gt.codigos c on c.codigo = s.codigo
   where s.deposito = 'emblistado'
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
  select k.caja, k.ord, corte.hay,
         case when corte.hay then coalesce(n.articulos, 0) else 0 end as articulos,
         case when corte.hay then ceil(coalesce(n.cajas, 0)) else 0 end as hacen_falta,
         a.saldo as armadas,
         coalesce(a.contada, false) as armadas_contadas,
         case when coalesce(a.contada, false) then a.saldo else 0 end as armadas_ref,
         p.saldo as planas,
         coalesce(p.contada, false) as planas_contadas
    from k
    cross join corte
    left join emb n on n.caja = k.caja
    left join arm a on a.caja = k.caja
    left join pla p on p.caja = k.caja
)
select caja, articulos, hacen_falta, armadas, armadas_contadas,
       greatest(0, hacen_falta - armadas_ref) as a_armar,
       planas, planas_contadas,
       greatest(0, hacen_falta - armadas_ref - case when planas_contadas then planas else 0 end) as a_comprar,
       case
         when not hay then 'falta el corte de emblistado'
         when caja = '(sin caja)' then 'falta cargar la caja de ' || articulos || ' artículos emblistados'
         when hacen_falta = 0 and not armadas_contadas then 'sin nada emblistado'
         when not armadas_contadas then 'sin conteo de armadas: se toma 0'
         when hacen_falta - armadas_ref <= 0 then 'NO ARMAR MÁS: alcanzan (sobran ' || round(armadas_ref - hacen_falta)::bigint || ')'
         else 'armar ' || round(hacen_falta - armadas_ref)::bigint
       end as estado
  from calc
 where caja <> '(sin caja)' or articulos > 0
 order by ord, hacen_falta desc, caja;

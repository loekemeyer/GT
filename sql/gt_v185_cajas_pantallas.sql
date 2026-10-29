-- gt_v185 (29/10/2026): los datos de las dos pantallas de cajas (Angely, D4 «sí»).
--   · celular: en «¿Qué caja vas a armar?» cada botón dice «armar N» / «NO ARMAR MÁS» / «sin emblistado»  → gt_cajas_estado()
--   · admin:   pestaña «📦 Cajas», en vivo, con lo emblistado, las armadas y el estado de cada caja       → gt_admin_cajas(p_pass)
-- gt.demanda_cajas (gt_v184) suma tres columnas AL FINAL (tono, etiqueta, corte_en) para que las dos funciones no repitan la regla.
-- ⚠ Esta es la definición vigente de gt.demanda_cajas: la de gt_v184 queda como historia (mismo cálculo, sin esas tres columnas).
-- tono: armar (falta armar) · nomas (las armadas alcanzan: NO ARMAR MÁS, sólo avisa) · nada (sin emblistado ni armadas) · null (todavía no hay corte).
-- gt_cajas_estado() es pública como gt_codigos_area2 (la lee el celular con la clave pública) y devuelve sólo caja, tono y etiqueta.
-- gt_admin_cajas() exige la clave del monitor (gt.pass_ok) y trae además artículos, emblistado, armadas y la hora del corte.
-- Rollback: drop function public.gt_cajas_estado() y public.gt_admin_cajas(text) (en el SQL Editor: el conector no deja DROP)
--           y volver a correr el create or replace view de sql/gt_v184_cajas_por_emblistado.sql
-- Sin punto y coma dentro de textos ni comentarios (el conector parte el pedido por esa marca).
create or replace view gt.demanda_cajas with (security_invoker = true) as
with corte as (
  select exists (select 1 from gt.stock_inicial where deposito = 'emblistado') as hay,
         (select max(contado_en) from gt.stock_inicial where deposito = 'emblistado') as corte_en
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
  select k.caja, k.ord, corte.hay, corte.corte_en,
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
       end as estado,
       case
         when not hay then null
         when hacen_falta - armadas_ref > 0 then 'armar'
         when hacen_falta > 0 or coalesce(armadas, 0) > 0 then 'nomas'
         else 'nada'
       end as tono,
       case
         when not hay then null
         when hacen_falta - armadas_ref > 0 then 'armar ' || round(hacen_falta - armadas_ref)::bigint
         when hacen_falta > 0 or coalesce(armadas, 0) > 0 then 'NO ARMAR MÁS'
         else 'sin emblistado'
       end as etiqueta,
       corte_en
  from calc
 where caja <> '(sin caja)' or articulos > 0
 order by ord, hacen_falta desc, caja;

create or replace function public.gt_cajas_estado()
returns table (caja text, tono text, etiqueta text)
language sql stable security definer set search_path = ''
as $$
  select d.caja, d.tono, d.etiqueta from gt.demanda_cajas d where d.caja <> '(sin caja)';
$$;

create or replace function public.gt_admin_cajas(p_pass text)
returns table (caja text, articulos bigint, hacen_falta numeric, armadas numeric, a_armar numeric,
               tono text, etiqueta text, estado text, corte_en timestamptz)
language sql stable security definer set search_path = ''
as $$
  select d.caja, d.articulos, d.hacen_falta, d.armadas, d.a_armar, d.tono, d.etiqueta, d.estado, d.corte_en
    from gt.demanda_cajas d
   where gt.pass_ok(p_pass);
$$;

revoke all on function public.gt_cajas_estado() from public;
revoke all on function public.gt_admin_cajas(text) from public;
grant execute on function public.gt_cajas_estado() to anon, authenticated;
grant execute on function public.gt_admin_cajas(text) to anon, authenticated;

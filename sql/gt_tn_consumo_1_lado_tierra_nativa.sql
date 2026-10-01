-- GT — el CONSUMO (la proyección de venta) de Tierra Nativa vive en SU Supabase (Thomas, 01/10/2026: «la lógica del
-- consumo tiene que estar en Supa de Tierra Nativa»). Lo corre Thomas UNA vez en el SQL Editor del proyecto de
-- Tierra Nativa (zjvpzqhbekxnwxdczpof). Gestión lo lee por el acceso de sólo lectura que ya existe (gt_reader).
--
-- Misma regla que la Est. Madre de LK (fn_proyeccion_oc_virgilio, sin la parte de empresas LK/Chef que acá no aplica):
--   · ventana de 6 meses cerrados; proyección = el mayor entre la media de la ventana y el 4.º mejor mes;
--   · si en 6 meses no vendió, se prueba con 12 meses;
--   · reincorporados (vuelven a vender tras 6+ meses sin vender, con 2+ meses cerrados): promedio desde que volvieron,
--     sólo si da más (Thomas, 30/09, D4 de Virgilio);
--   · los códigos de 5 dígitos no se proyectan (se hacen contra pedido); excluidos y remaps de la propia página.
-- Parámetros editables en app_settings (sin fila = el default): gt_proy_meses_ventana 6 · gt_proy_piso_mejor_mes 4 ·
-- gt_proy_meses_fallback 12.
-- Rollback: drop view public.gt_proyeccion; drop function public.gt_proy_window(integer), public.gt_proy_cfg(text, numeric);

create or replace function public.gt_proy_cfg(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.app_settings where key = p_key), p_default)
$$;

create or replace function public.gt_proy_window(p_meses integer)
returns table (item text, proy_cajas numeric)
language sql stable security definer set search_path = public as $$
  with vent as (
    select greatest(coalesce(p_meses, 6), 1)::int as meses,
           public.gt_proy_cfg('gt_proy_piso_mejor_mes', 4)::int as piso,
           public.gt_proy_cfg('gt_proy_meses_ventana', 6)::int as ventana
  ),
  mm as (   -- último mes CERRADO con ventas
    select least(max(extract(year from invoice_date::date)::int * 12 + extract(month from invoice_date::date)::int),
                 extract(year from current_date)::int * 12 + extract(month from current_date)::int - 1) as endm
      from public.sales_lines where invoice_date ~ '^\d{4}-\d{2}-\d{2}'
  ),
  norm as (
    select regexp_replace(upper(btrim(sl.item_code)), '^0+(?=.)', '') as nitem,
           extract(year from sl.invoice_date::date)::int * 12 + extract(month from sl.invoice_date::date)::int as midx,
           sl.boxes::numeric as v
      from public.sales_lines sl, mm, vent
     where sl.invoice_date ~ '^\d{4}-\d{2}-\d{2}' and sl.customer_code is not null
       and extract(year from sl.invoice_date::date)::int * 12 + extract(month from sl.invoice_date::date)::int
           between mm.endm - (vent.meses - 1) and mm.endm
  ),
  base as (
    select coalesce(r.to_code, nz.nitem) as item, nz.midx, sum(nz.v) as v
      from norm nz left join public.sales_item_remap r on r.from_code = nz.nitem
     where not exists (select 1 from public.sales_excluded_items e where e.item_code = nz.nitem)
     group by 1, 2
  ),
  grid as (
    select i.item, g as midx
      from (select distinct item from base) i, mm, vent, generate_series(mm.endm - (vent.meses - 1), mm.endm) g
  ),
  serie as (
    select g.item, g.midx, coalesce(b.v, 0) as v from grid g left join base b on b.item = g.item and b.midx = g.midx
  ),
  st as (
    select item, sum(v) / (select meses from vent) as media,
           (array_agg(v order by v desc))[least((select piso from vent), (select meses from vent))] as m4
      from serie group by item
  )
  select item,
         round(case when (select meses from vent) <= (select ventana from vent) then greatest(media, coalesce(m4, 0)) else media end, 2) as proy_cajas
    from st
$$;

create or replace view public.gt_proyeccion as
with p6 as (select * from public.gt_proy_window(public.gt_proy_cfg('gt_proy_meses_ventana', 6)::int)),
     p12 as (select * from public.gt_proy_window(public.gt_proy_cfg('gt_proy_meses_fallback', 12)::int)),
     merged0 as (
       select coalesce(p6.item, p12.item) as item,
              case when coalesce(p6.proy_cajas, 0) > 0 then p6.proy_cajas
                   when coalesce(p12.proy_cajas, 0) > 0 then p12.proy_cajas else 0 end as proy_cajas,
              case when coalesce(p6.proy_cajas, 0) > 0 then 'ventana 6' when coalesce(p12.proy_cajas, 0) > 0 then 'ventana 12' end as fuente
         from p6 full join p12 on p12.item = p6.item
     ),
     vt_l as (   -- reincorporados: meses con venta en los últimos 30 meses
       select coalesce(r.to_code, n.nitem) as item, date_trunc('month', s.invoice_date::date)::date as m, sum(s.boxes::numeric) as v
         from public.sales_lines s
         cross join lateral (select regexp_replace(upper(btrim(s.item_code)), '^0+(?=.)', '') as nitem) n
         left join public.sales_item_remap r on r.from_code = n.nitem
        where s.invoice_date ~ '^\d{4}-\d{2}-\d{2}' and s.customer_code is not null
          and s.invoice_date >= to_char(current_date - interval '30 months', 'YYYY-MM-DD')
          and s.invoice_date <  to_char(date_trunc('month', current_date), 'YYYY-MM-DD')
          and not exists (select 1 from public.sales_excluded_items e where e.item_code = n.nitem)
        group by 1, 2
     ),
     vt_f as (
       select item, max(m) filter (where gap) as desde
         from (select item, m, coalesce(m - lag(m) over (partition by item order by m) > 185, true) as gap from vt_l) z
        group by item
     ),
     vt as (
       select f.item, sum(l.v) as tot,
              (extract(year from date_trunc('month', current_date)) * 12 + extract(month from date_trunc('month', current_date)))
              - (extract(year from f.desde) * 12 + extract(month from f.desde)) as meses
         from vt_f f join vt_l l on l.item = f.item and l.m >= f.desde
        where f.desde >= (date_trunc('month', current_date) - interval '6 months')::date
          and f.item !~ '^[0-9]{5,}$'
        group by f.item, f.desde
     ),
     merged as (
       select coalesce(m.item, v.item) as item,
              case when v.meses >= 2 and v.tot > 0 and round(v.tot / v.meses, 2) > coalesce(m.proy_cajas, 0)
                   then round(v.tot / v.meses, 2) else coalesce(m.proy_cajas, 0) end as proy_cajas,
              case when v.meses >= 2 and v.tot > 0 and round(v.tot / v.meses, 2) > coalesce(m.proy_cajas, 0)
                   then 'reincorporado' else m.fuente end as fuente
         from merged0 m full join vt v on v.item = m.item
     )
select m.item as cod, m.proy_cajas as proy_cajas_mes, p.uxb,
       round(m.proy_cajas * coalesce(p.uxb, 1)) as proy_uni_mes, m.fuente, p.description
  from merged m
  left join public.products p on regexp_replace(upper(btrim(p.cod)), '^0+(?=.)', '') = m.item
 where m.proy_cajas > 0 and m.item !~ '^[0-9]{5}$'
 order by m.proy_cajas desc;

grant execute on function public.gt_proy_cfg(text, numeric), public.gt_proy_window(integer) to gt_reader;
grant select on public.gt_proyeccion to gt_reader;

-- comprobación: cuántos códigos tienen proyección y los 10 que más venden
select count(*) as codigos_con_proyeccion from public.gt_proyeccion;
select cod, description, proy_cajas_mes, uxb, fuente from public.gt_proyeccion limit 10;

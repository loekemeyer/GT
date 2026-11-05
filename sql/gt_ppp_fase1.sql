-- PPP Tierra Nativa — Fase 1 (Tomás G, 05/11/2026). YA APLICADO en la base (hrxfctzncixxqmpfhskv).
-- D14=B: datos importados del Excel "Planilla Programacion Pedidos" (fuente='excel'); Fase 2 = fuente viva por ISIS (isis_tn), fuente='isis'.
-- D15: tabs A Programar · Entregados · Reporte Picking (los que usa TN hoy; NO el armado automático de tandas de GV).
-- Formato del front = PPP de GV (sub-tabs + cards), en GT admin.html (sección #ppp).

-- ── Tablas (schema gt, RLS on = deny-all anon; la lectura va por las RPC gt_admin_ppp_* security definer) ──
create table if not exists gt.ppp_a_programar (
  id bigint generated always as identity primary key,
  np integer, fecha_recep date, cod integer, cliente text, kg numeric, m3 numeric,
  vend text, dir_entrega text, barrio text, op text, entrega_retira text, rent text, oc text, aviso text,
  bloque text, fuente text not null default 'excel', importado_at timestamptz not null default now());
create table if not exists gt.ppp_entregado (
  id bigint generated always as identity primary key,
  np text, fecha_arribo date, cod integer, cliente text, kg numeric, m3 numeric,
  localidad_expreso text, direccion text, op text, lugar_entrega text, fecha_entrega text,
  observacion text, oc text, art_no_entregado text, cant numeric, importe numeric,
  fuente text not null default 'excel', importado_at timestamptz not null default now());
create table if not exists gt.ppp_picking (
  id bigint generated always as identity primary key,
  cpbte integer, fecha date, cod_articulo integer, descripcion text, cod_cliente integer, cliente text,
  medida text, cant_pedida numeric, a_entregar numeric, uxb numeric, costo numeric, precio_lista numeric,
  acuerdo text, recibo text, inversion numeric, ingreso numeric, ganancia numeric,
  fuente text not null default 'excel', importado_at timestamptz not null default now());
alter table gt.ppp_a_programar enable row level security;
alter table gt.ppp_entregado  enable row level security;
alter table gt.ppp_picking     enable row level security;
create index if not exists ppp_entregado_fecha_idx on gt.ppp_entregado (fecha_arribo desc);
create index if not exists ppp_picking_fecha_idx   on gt.ppp_picking   (fecha desc);

-- ── RPCs de lectura (patrón gt_admin_*: security definer, search_path '', gate gt.pass_ok(p_pass)) ──
create or replace function public.gt_admin_ppp_a_programar(p_pass text)
returns table(np integer, fecha_recep date, cod integer, cliente text, kg numeric, m3 numeric,
              vend text, dir_entrega text, barrio text, op text, entrega_retira text, rent text, oc text, aviso text, bloque text)
language sql stable security definer set search_path to '' as $$
  select np,fecha_recep,cod,cliente,kg,m3,vend,dir_entrega,barrio,op,entrega_retira,rent,oc,aviso,bloque
    from gt.ppp_a_programar where gt.pass_ok(p_pass) order by fecha_recep nulls last, np; $$;
create or replace function public.gt_admin_ppp_entregados(p_pass text, p_limit integer default 300)
returns table(np text, fecha_arribo date, cod integer, cliente text, kg numeric, m3 numeric,
              localidad_expreso text, direccion text, op text, lugar_entrega text, fecha_entrega text,
              observacion text, oc text, art_no_entregado text, cant numeric, importe numeric)
language sql stable security definer set search_path to '' as $$
  select np,fecha_arribo,cod,cliente,kg,m3,localidad_expreso,direccion,op,lugar_entrega,fecha_entrega,
         observacion,oc,art_no_entregado,cant,importe
    from gt.ppp_entregado where gt.pass_ok(p_pass)
   order by fecha_arribo desc nulls last limit greatest(1, least(coalesce(p_limit,300), 2000)); $$;
create or replace function public.gt_admin_ppp_picking(p_pass text, p_limit integer default 500)
returns table(cpbte integer, fecha date, cod_articulo integer, descripcion text, cod_cliente integer, cliente text,
              medida text, cant_pedida numeric, a_entregar numeric, uxb numeric, costo numeric, precio_lista numeric,
              acuerdo text, recibo text, inversion numeric, ingreso numeric, ganancia numeric)
language sql stable security definer set search_path to '' as $$
  select cpbte,fecha,cod_articulo,descripcion,cod_cliente,cliente,medida,cant_pedida,a_entregar,uxb,costo,precio_lista,
         acuerdo,recibo,inversion,ingreso,ganancia
    from gt.ppp_picking where gt.pass_ok(p_pass)
   order by fecha desc nulls last, cpbte limit greatest(1, least(coalesce(p_limit,500), 3000)); $$;
grant execute on function public.gt_admin_ppp_a_programar(text) to anon, authenticated;
grant execute on function public.gt_admin_ppp_entregados(text,integer) to anon, authenticated;
grant execute on function public.gt_admin_ppp_picking(text,integer) to anon, authenticated;

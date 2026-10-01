-- GT — base del circuito de pedidos y la cuenta de QUÉ FABRICAR (Thomas, 01/10/2026: D13, D17, D18, D20).
--   D18 «góndola: tiene máximo y se debe llenar eso + los pedidos»  → objetivo = máximo + pedidos abiertos; se
--       fabrica lo que falta para llegar (y se descuenta lo que ya está en proceso para saber qué EMPEZAR).
--   D20 «máximo 14 días, OC de súper se turnan»                      → gt.pedidos.plazo_dias (default 14), es_super.
--   D17 «sale parcial o se lo espera algunos días»                   → gt.pedidos_plazo dice si puede salir completo o parcial.
--   D13 «después lo vemos»                                           → el armado pedido por pedido queda para más adelante.
-- Sólo base: la app del operario no cambia. Los pedidos los va a cargar el sync con la página de Tierra Nativa (D12).
-- Sin conteo inicial la góndola vale 0 y «lo que falta» es el máximo entero: lo dice la columna nota.
--
-- Rollback (lo corre el dueño en el SQL Editor; el conector no deja DROP):
--   drop view gt.demanda_corte, gt.demanda_aros, gt.pedidos_plazo, gt.demanda_producto, gt.stock;
--   drop table gt.pedido_items, gt.pedidos, gt.stock_inicial, gt.producto_max;

-- 1) máximo de góndola por producto (en cajas). Lo carga Thomas (D25).
create table if not exists gt.producto_max (
  codigo         text primary key references gt.codigos(codigo),
  maximo_cajas   numeric not null check (maximo_cajas >= 0),
  nota           text,
  actualizado_en timestamptz not null default now()
);
alter table gt.producto_max enable row level security;
revoke all on gt.producto_max from anon, authenticated;

-- 2) conteo inicial por depósito: en la unidad del depósito (piezas en corte, aros en aro, unidades en los de producto,
--    metros en moldura). Los movimientos POSTERIORES al conteo se suman encima.
create table if not exists gt.stock_inicial (
  deposito   text not null,
  codigo     text not null,
  medida     text not null default '',
  cantidad   numeric not null check (cantidad >= 0),
  contado_en timestamptz not null default now(),
  nota       text,
  primary key (deposito, codigo, medida)
);
alter table gt.stock_inicial enable row level security;
revoke all on gt.stock_inicial from anon, authenticated;

-- 3) stock = conteo inicial + movimientos posteriores. Sin conteo, con_conteo = false y el saldo es sólo lo movido.
create or replace view gt.stock with (security_invoker = true) as
with claves as (
  select deposito, codigo, coalesce(medida, '') as medida from gt.movimientos where codigo is not null
  union
  select deposito, codigo, medida from gt.stock_inicial
), m as (
  select k.deposito, k.codigo, k.medida, si.cantidad as inicial, si.contado_en,
         coalesce(sum(mv.delta) filter (where si.contado_en is null or mv.ts > si.contado_en), 0) as movido,
         count(mv.registro_id) filter (where mv.receta = 'sin receta') as sin_receta
    from claves k
    left join gt.stock_inicial si on si.deposito = k.deposito and si.codigo = k.codigo and si.medida = k.medida
    left join gt.movimientos mv on mv.deposito = k.deposito and mv.codigo = k.codigo and coalesce(mv.medida, '') = k.medida
   group by 1, 2, 3, 4, 5
)
select deposito, codigo, nullif(medida, '') as medida,
       coalesce(inicial, 0) + movido as saldo,
       case deposito when 'corte' then 'piezas' when 'aro' then 'aros' when 'moldura' then 'metros'
                     when 'moldura_lijada' then 'metros' when 'moldura_pintada' then 'paquetes' else 'unidades' end as unidad,
       inicial is not null as con_conteo, contado_en, movido, sin_receta
  from m;
revoke all on gt.stock from anon, authenticated;

-- 4) pedidos (copia local, venga de donde venga) y sus renglones
create table if not exists gt.pedidos (
  id             bigserial primary key,
  origen         text not null default 'tn',
  pedido_ref     text not null,
  np             text unique,
  cliente_cod    text,
  cliente        text,
  fecha          timestamptz not null default now(),
  es_super       boolean not null default false,
  plazo_dias     integer not null default 14,
  estado         text not null default 'abierto' check (estado in ('abierto', 'parcial', 'armado', 'cargado', 'entregado', 'cancelado')),
  nota           text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (origen, pedido_ref)
);
create table if not exists gt.pedido_items (
  pedido_id     bigint not null references gt.pedidos(id),
  codigo        text not null,
  cajas         numeric not null check (cajas > 0),
  cajas_armadas numeric not null default 0 check (cajas_armadas >= 0),
  primary key (pedido_id, codigo)
);
alter table gt.pedidos enable row level security;
alter table gt.pedido_items enable row level security;
revoke all on gt.pedidos, gt.pedido_items from anon, authenticated;

-- 5) qué fabricar, por producto: objetivo = máximo + pedidos abiertos; a_fabricar = objetivo − góndola;
--    a_empezar = además descuenta lo que ya está en proceso (encolado … contraído).
create or replace view gt.demanda_producto with (security_invoker = true) as
with ped as (
  select i.codigo, sum(i.cajas - i.cajas_armadas) as cajas, count(distinct p.id) as pedidos, min(p.fecha) as pedido_mas_viejo
    from gt.pedido_items i join gt.pedidos p on p.id = i.pedido_id
   where p.estado in ('abierto', 'parcial') and i.cajas > i.cajas_armadas
   group by 1
), st as (
  select codigo,
         sum(saldo) filter (where deposito = 'gondola') as gondola_u,
         sum(saldo) filter (where deposito in ('encolado', 'montado', 'gancho', 'emblistado', 'contraido')) as proceso_u,
         bool_or(con_conteo) filter (where deposito = 'gondola') as gondola_contada
    from gt.stock group by 1
), base as (
  select c.codigo, c.descripcion, c.uxb, gt.grupo_codigo(c.codigo) as grupo,
         pm.maximo_cajas, ped.cajas as pedidos_cajas, ped.pedidos, ped.pedido_mas_viejo,
         round(coalesce(st.gondola_u, 0) / c.uxb, 2) as gondola_cajas,
         round(coalesce(st.proceso_u, 0) / c.uxb, 2) as proceso_cajas,
         coalesce(st.gondola_contada, false) as gondola_contada
    from gt.codigos c
    left join gt.producto_max pm on pm.codigo = c.codigo
    left join ped on ped.codigo = c.codigo
    left join st on st.codigo = c.codigo
   where c.activo and (pm.codigo is not null or ped.codigo is not null)
)
select b.*,
       coalesce(maximo_cajas, 0) + coalesce(pedidos_cajas, 0) as objetivo_cajas,
       greatest(0, coalesce(maximo_cajas, 0) + coalesce(pedidos_cajas, 0) - gondola_cajas) as a_fabricar_cajas,
       greatest(0, coalesce(maximo_cajas, 0) + coalesce(pedidos_cajas, 0) - gondola_cajas - proceso_cajas) as a_empezar_cajas,
       case when not gondola_contada then 'góndola sin conteo: se toma 0' end as nota
  from base b;
revoke all on gt.demanda_producto from anon, authenticated;

-- 6) lo que hay que grampear y cortar para eso (con las recetas de 1.23 a 1.26)
create or replace view gt.demanda_aros with (security_invoker = true) as
with d as (select codigo, a_empezar_cajas * uxb as u from gt.demanda_producto where a_empezar_cajas > 0),
x as (
  select pa.aro, pa.producto, pa.pieza, pa.color, pa.receta, pa.cant * d.u as aros
    from d join gt.producto_aro pa on pa.producto = d.codigo
), agg as (
  select aro, sum(aros) as necesarios,
         string_agg(distinct producto || coalesce(' ' || color, '') || case when receta = 'sin receta' then ' (sin receta)' else '' end, ', ') as para
    from x group by aro
)
select a.aro, coalesce(cr.descripcion, 'sin receta') as descripcion, cr.medida,
       round(a.necesarios, 1) as necesarios, s.saldo as en_stock,
       greatest(0, round(a.necesarios - coalesce(s.saldo, 0), 1)) as a_grampear, a.para
  from agg a
  left join gt.codigos_rubro cr on cr.rubro = 'GRAMP' and cr.codigo = a.aro
  left join gt.stock s on s.deposito = 'aro' and s.codigo = a.aro and s.medida is null;
revoke all on gt.demanda_aros from anon, authenticated;

create or replace view gt.demanda_corte with (security_invoker = true) as
with d as (select aro, a_grampear from gt.demanda_aros where aro is not null and a_grampear > 0),
x as (select ap.pieza, ap.aro, ap.cant * d.a_grampear as piezas from d join gt.aro_piezas ap on ap.aro = d.aro),
agg as (select pieza, sum(piezas) as necesarias, string_agg(distinct aro, ', ') as para from x group by pieza)
select a.pieza, coalesce(cr.descripcion, 'sin receta') as descripcion, cr.medida,
       ceil(a.necesarias) as necesarias, s.saldo as en_stock,
       greatest(0, ceil(a.necesarias - coalesce(s.saldo, 0))) as a_cortar, a.para
  from agg a
  left join gt.codigos_rubro cr on cr.rubro = 'CORTE' and cr.codigo = a.pieza
  left join gt.stock s on s.deposito = 'corte' and s.codigo = a.pieza and s.medida is null;
revoke all on gt.demanda_corte from anon, authenticated;

-- 7) cada pedido contra su plazo (D20) y si puede salir completo o parcial con lo que hay en góndola (D17)
create or replace view gt.pedidos_plazo with (security_invoker = true) as
with g as (select codigo, gondola_cajas from gt.demanda_producto),
it as (
  select i.pedido_id, sum(i.cajas) as cajas, sum(i.cajas_armadas) as armadas, count(*) as items,
         count(*) filter (where i.cajas_armadas >= i.cajas) as items_completos,
         count(*) filter (where coalesce(g.gondola_cajas, 0) + i.cajas_armadas >= i.cajas) as items_cubribles
    from gt.pedido_items i left join g on g.codigo = i.codigo
   group by 1
)
select p.id, p.np, p.origen, p.pedido_ref, p.cliente_cod, p.cliente, p.es_super, p.estado, p.fecha,
       (now() at time zone 'America/Argentina/Buenos_Aires')::date - (p.fecha at time zone 'America/Argentina/Buenos_Aires')::date as dias,
       (p.fecha at time zone 'America/Argentina/Buenos_Aires')::date + p.plazo_dias as vence,
       now() > p.fecha + make_interval(days => p.plazo_dias) as vencido,
       it.cajas, it.armadas, round(100 * it.armadas / nullif(it.cajas, 0)) as pct_armado,
       it.items, it.items_completos,
       it.items_cubribles = it.items as puede_salir_completo,
       it.items_cubribles > 0 and it.items_cubribles < it.items as puede_salir_parcial
  from gt.pedidos p join it on it.pedido_id = p.id
 where p.estado in ('abierto', 'parcial', 'armado')
 order by p.fecha;
revoke all on gt.pedidos_plazo from anon, authenticated;

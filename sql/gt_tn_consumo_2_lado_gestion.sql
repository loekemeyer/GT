-- GT — el consumo de Tierra Nativa llega a Gestión (Thomas, 01/10/2026: «la lógica del consumo tiene que estar en Supa
-- de Tierra Nativa»). PASO 2 (lado Gestión, aplicado como gt_v138_consumo_tn): la estructura que recibe el dato.
--   · gt.consumo_tn: copia local, una fila por código (cajas/mes), la refresca gt.sync_consumo_tn() una vez por día
--     (leer TN cuesta ~2,4 s de conexión y la Est. Madre no cambia en el día). Lo que deja de venir queda en 0.
--   · gt.demanda_producto: máximo por CONSUMO = proyección mensual × gt.config.consumo_meses_cobertura (1,5 por defecto,
--     el mismo índice que las OCs de Virgilio; D19 dice el valor real). Un maximo_consumo_cajas cargado a mano en
--     gt.producto_max gana sobre el calculado. maximo_rige: 'consumo manual' / 'consumo' / 'gondola'.
--     Un producto con consumo entra a la demanda aunque no tenga pedidos ni máximo de góndola: se fabrica para reponer.
-- PASO 3 (sql/gt_tn_consumo_3_lado_gestion_despues.sql): import de la vista de TN, primera corrida y cron, cuando
--     el paso 1 (sql/gt_tn_consumo_1_lado_tierra_nativa.sql) ya corrió en Tierra Nativa.
-- Rollback: drop function gt.sync_consumo_tn(); drop table gt.consumo_tn;  y recrear gt.demanda_producto desde
--   gt_v132_d22_d25_discontinuos_aros_consumo.sql.

create table if not exists gt.consumo_tn (
  cod            text primary key,
  proy_cajas_mes numeric not null default 0,
  uxb            integer,
  proy_uni_mes   numeric,
  fuente         text,
  descripcion    text,
  actualizado_en timestamptz not null default now()
);
alter table gt.consumo_tn enable row level security;
revoke all on gt.consumo_tn from anon, authenticated;
insert into gt.config (clave, valor) values ('consumo_meses_cobertura', '1.5') on conflict (clave) do nothing;

create or replace function gt.sync_consumo_tn()
returns table (codigos int, en_gt int, en_cero int)
language plpgsql security definer set search_path = ''
as $f$
declare v_n int; v_gt int; v_cero int;
begin
  perform pg_advisory_xact_lock(hashtext('gt_sync_consumo_tn'));
  create temp table _tn_proy on commit drop as
    select cod, proy_cajas_mes, uxb, proy_uni_mes, fuente, description from gt_tn.gt_proyeccion;
  insert into gt.consumo_tn (cod, proy_cajas_mes, uxb, proy_uni_mes, fuente, descripcion, actualizado_en)
  select cod, proy_cajas_mes, uxb, proy_uni_mes, fuente, description, now() from _tn_proy
  on conflict (cod) do update
     set proy_cajas_mes = excluded.proy_cajas_mes, uxb = excluded.uxb, proy_uni_mes = excluded.proy_uni_mes,
         fuente = excluded.fuente, descripcion = excluded.descripcion, actualizado_en = now();
  get diagnostics v_n = row_count;
  update gt.consumo_tn c set proy_cajas_mes = 0, proy_uni_mes = 0, fuente = 'sin venta', actualizado_en = now()
   where c.proy_cajas_mes <> 0 and not exists (select 1 from _tn_proy t where t.cod = c.cod);
  get diagnostics v_cero = row_count;
  select count(*) into v_gt from gt.consumo_tn c join gt.codigos g on g.codigo = c.cod where c.proy_cajas_mes > 0;
  return query select v_n, v_gt, v_cero;
end
$f$;
revoke all on function gt.sync_consumo_tn() from public, anon, authenticated;

create or replace view gt.demanda_producto with (security_invoker = true) as
with cfg as (
  select coalesce((select nullif(btrim(valor), '')::numeric from gt.config where clave = 'consumo_meses_cobertura'), 1.5) as cobertura
), ped as (
  select i.codigo, sum(i.cajas - i.cajas_armadas) as cajas, count(distinct p.id) as pedidos, min(p.fecha) as pedido_mas_viejo
    from gt.pedido_items i join gt.pedidos p on p.id = i.pedido_id
   where p.estado in ('abierto', 'parcial') and i.cajas > i.cajas_armadas
   group by i.codigo
), st as (
  select codigo,
         sum(saldo) filter (where deposito = 'gondola') as gondola_u,
         sum(saldo) filter (where deposito in ('encolado', 'montado', 'gancho', 'emblistado', 'contraido')) as proceso_u,
         bool_or(con_conteo) filter (where deposito = 'gondola') as gondola_contada
    from gt.stock
   group by codigo
), base as (
  select c.codigo, c.descripcion, c.uxb, gt.grupo_codigo(c.codigo) as grupo,
         pm.maximo_cajas,
         coalesce(pm.maximo_consumo_cajas,
                  case when ct.proy_cajas_mes > 0 then ceil(ct.proy_cajas_mes * cfg.cobertura) end) as maximo_consumo_cajas,
         ped.cajas as pedidos_cajas, ped.pedidos, ped.pedido_mas_viejo,
         round(coalesce(st.gondola_u, 0) / c.uxb, 2) as gondola_cajas,
         round(coalesce(st.proceso_u, 0) / c.uxb, 2) as proceso_cajas,
         coalesce(st.gondola_contada, false) as gondola_contada,
         case when pm.maximo_consumo_cajas is not null then 'consumo manual'
              when ct.proy_cajas_mes > 0 then 'consumo'
              when pm.maximo_cajas is not null then 'gondola' end as maximo_rige,
         ct.proy_cajas_mes as consumo_cajas_mes, ct.fuente as consumo_fuente
    from gt.codigos c
    cross join cfg
    left join gt.producto_max pm on pm.codigo = c.codigo
    left join gt.consumo_tn ct on ct.cod = c.codigo
    left join ped on ped.codigo = c.codigo
    left join st on st.codigo = c.codigo
   where c.activo and (pm.codigo is not null or ped.codigo is not null or ct.proy_cajas_mes > 0)
), calc as (
  select b.*, coalesce(b.maximo_consumo_cajas, b.maximo_cajas) as maximo_rige_cajas from base b
)
select codigo, descripcion, uxb, grupo, maximo_cajas, pedidos_cajas, pedidos, pedido_mas_viejo,
       gondola_cajas, proceso_cajas, gondola_contada,
       coalesce(maximo_rige_cajas, 0) + coalesce(pedidos_cajas, 0) as objetivo_cajas,
       greatest(0, coalesce(maximo_rige_cajas, 0) + coalesce(pedidos_cajas, 0) - gondola_cajas) as a_fabricar_cajas,
       greatest(0, coalesce(maximo_rige_cajas, 0) + coalesce(pedidos_cajas, 0) - gondola_cajas - proceso_cajas) as a_empezar_cajas,
       nullif(concat_ws(' · ',
         case when not gondola_contada then 'góndola sin conteo: se toma 0' end,
         case when maximo_rige = 'gondola' then 'sin consumo: rige el máximo de góndola' end,
         case when maximo_rige is null and pedidos_cajas is not null then 'sin máximo ni consumo: sólo los pedidos' end), '') as nota,
       maximo_consumo_cajas, maximo_rige,
       case when maximo_consumo_cajas is not null and maximo_cajas is not null
            then greatest(0, maximo_consumo_cajas - maximo_cajas) end as supera_gondola_cajas,
       consumo_cajas_mes, consumo_fuente
  from calc;
revoke all on gt.demanda_producto from anon, authenticated;

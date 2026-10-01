-- GT — lo que contestó Thomas el 01/10/2026 sobre D22 y D25.
--   D25 «máximo por góndola + máximo por consumo, se necesitan ambos» → gt.producto_max lleva los dos. Regla tomada de
--       las OCs de Virgilio («la proyección es rey»): RIGE el de CONSUMO si está cargado, si no el de GÓNDOLA. Lo que el
--       consumo supera a la góndola se fabrica igual y se guarda aparte (columna supera_gondola_cajas).
--   D22 «115 discontinuo · 224/220 crealos · 640-5 discontinuos · 15x21 03 negro crealos · 012 10x10 crealos ·
--        012 cedro para 30x40 no va · 604 disc · 713/4 es roble»
--       → 115, 604, 640, 641, 642 y 645 quedan activo = false (643 y 644 no existen en gt.codigos). Salen de la lista
--         del operario (gt_codigos_area) y de la demanda. Su color y sus códigos de área quedan como historia.
--       → aros nuevos en Grampeado 234 a 239, y dos piezas de Corte (157 y 158: 03 Negro de 15 y 21 cm, que el tablero
--         de Corte no tenía y sin ellas el aro 238 quedaba sin receta de corte).
--       → 713 y 714 pasan a Roble. Las filas Cedro / Marrón / Natural quedan INACTIVAS, no se borran: el conector
--         no deja DELETE y además queda la historia de qué se cargó. gt.color_fijar() es la forma de cambiar un color.
--       → 214 (Diploma 012 30*40, Cedro) queda SIN aro: «no va» (D26 pregunta qué lleva de verdad).
-- Rollback (SQL Editor):
--   update gt.codigos set activo = true, discontinuado_en = null, discontinuado_nota = null
--    where codigo in ('115','604','640','641','642','645');
--   update gt.codigos_rubro set activo = false where (rubro = 'GRAMP' and codigo between '234' and '239')
--                                               or (rubro = 'CORTE' and codigo in ('157','158'));
--   update gt.codigo_color set activo = (coalesce(fuente,'') <> 'Thomas 01/10 (D22)') where codigo in ('713','714');
--   alter table gt.producto_max drop column maximo_consumo_cajas;   -- y recrear gt.demanda_producto desde gt_v131_pedidos_demanda.sql

-- 1) D25: los dos máximos. Un producto puede tener uno solo (constraint producto_max_alguno).
alter table gt.producto_max alter column maximo_cajas drop not null;
alter table gt.producto_max add column if not exists maximo_consumo_cajas numeric check (maximo_consumo_cajas >= 0);
alter table gt.producto_max add constraint producto_max_alguno check (maximo_cajas is not null or maximo_consumo_cajas is not null);
comment on column gt.producto_max.maximo_cajas is 'máximo de GÓNDOLA, en cajas: lo que entra en el lugar';
comment on column gt.producto_max.maximo_consumo_cajas is 'máximo por CONSUMO, en cajas: lo que se vende. Si está cargado, rige';

create or replace view gt.demanda_producto with (security_invoker = true) as
with ped as (
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
         pm.maximo_cajas, pm.maximo_consumo_cajas,
         coalesce(pm.maximo_consumo_cajas, pm.maximo_cajas) as maximo_rige_cajas,
         case when pm.maximo_consumo_cajas is not null then 'consumo'
              when pm.maximo_cajas is not null then 'gondola' end as maximo_rige,
         ped.cajas as pedidos_cajas, ped.pedidos, ped.pedido_mas_viejo,
         round(coalesce(st.gondola_u, 0) / c.uxb, 2) as gondola_cajas,
         round(coalesce(st.proceso_u, 0) / c.uxb, 2) as proceso_cajas,
         coalesce(st.gondola_contada, false) as gondola_contada
    from gt.codigos c
    left join gt.producto_max pm on pm.codigo = c.codigo
    left join ped on ped.codigo = c.codigo
    left join st on st.codigo = c.codigo
   where c.activo and (pm.codigo is not null or ped.codigo is not null)
)
select codigo, descripcion, uxb, grupo, maximo_cajas, pedidos_cajas, pedidos, pedido_mas_viejo,
       gondola_cajas, proceso_cajas, gondola_contada,
       coalesce(maximo_rige_cajas, 0) + coalesce(pedidos_cajas, 0) as objetivo_cajas,
       greatest(0, coalesce(maximo_rige_cajas, 0) + coalesce(pedidos_cajas, 0) - gondola_cajas) as a_fabricar_cajas,
       greatest(0, coalesce(maximo_rige_cajas, 0) + coalesce(pedidos_cajas, 0) - gondola_cajas - proceso_cajas) as a_empezar_cajas,
       nullif(concat_ws(' · ',
         case when not gondola_contada then 'góndola sin conteo: se toma 0' end,
         case when maximo_rige = 'gondola' then 'sin máximo por consumo: rige el de góndola' end,
         case when maximo_rige is null and pedidos_cajas is not null then 'sin máximo cargado: sólo los pedidos' end), '') as nota,
       maximo_consumo_cajas, maximo_rige,
       case when maximo_consumo_cajas is not null and maximo_cajas is not null
            then greatest(0, maximo_consumo_cajas - maximo_cajas) end as supera_gondola_cajas
  from base;
revoke all on gt.demanda_producto from anon, authenticated;

-- 2) D22: discontinuos. activo = false los saca de la lista del operario y de la demanda.
alter table gt.codigos add column if not exists discontinuado_en timestamptz;
alter table gt.codigos add column if not exists discontinuado_nota text;
update gt.codigos set activo = false, discontinuado_en = now(), discontinuado_nota = 'Thomas 01/10/2026 (D22)'
 where codigo in ('115', '604', '640', '641', '642', '645') and activo;

-- 3) D22: aros nuevos en Grampeado y las dos piezas de Corte que les faltaban al 03 Negro.
insert into gt.codigos_rubro (rubro, codigo, descripcion, medida, activo) values
  ('GRAMP', '234', '3P 3/4 Bco P', '30*40', true),   -- 224 Porta Gigante Mold 30mm, Blanco
  ('GRAMP', '235', '3P 3/4 Negro', '30*40', true),   -- 224, Negro
  ('GRAMP', '236', '3P 3/4 Bco P', '60*80', true),   -- 220 Porta Gigante Mold 30mm, Blanco
  ('GRAMP', '237', '3P 3/4 Negro', '60*80', true),   -- 220, Negro
  ('GRAMP', '238', '03 Negro',     '15*21', true),   -- 408 / 409 Set x3
  ('GRAMP', '239', '012 Nat',      '10*10', true),   -- 281 Multiple X6
  ('CORTE', '157', '03 Negro',     '15 cm', true),   -- para el aro 238
  ('CORTE', '158', '03 Negro',     '21 cm', true)    -- para el aro 238
on conflict (rubro, codigo) do nothing;

-- 4) D22: 713 y 714 son Roble. El color se cambia con gt.color_fijar(); lo que sale de la lista queda inactivo.
alter table gt.codigo_color add column if not exists activo boolean not null default true;

create or replace view gt.producto_aro with (security_invoker = true) as
with col as (
  select cc.codigo, cc.color, coalesce(cc.proporcion, 1.0 / count(*) over (partition by cc.codigo)::numeric) as prop
    from gt.codigo_color cc
   where cc.activo                                                   -- gt_v132 (D22): una fila desactivada no cuenta
), pp as (
  select p.producto, p.pieza, p.mult, gt.perfil_producto(c.descripcion) as perfil,
         c.descripcion ~* 'soga' as soga, col.color, coalesce(col.prop, 1::numeric) as prop,
         gt.med_norm(case when c.descripcion !~* '^Porta\s' and replace(p.pieza, ' ', '') in ('10*30', '20*30', '30*30', '30*40')
                          then regexp_replace(replace(p.pieza, ' ', ''), '30', '27.5', 'g')
                          else p.pieza end) as med_aro
    from gt.producto_piezas p
    join gt.codigos c on c.codigo = p.producto
    left join col on col.codigo = p.producto
), aro as (
  select k.codigo, gt.perfil_aro(k.descripcion) as perfil, gt.med_norm(k.medida) as med,
         gt.color_aro(k.descripcion) as color, k.descripcion ~* 'p/soga' as soga
    from gt.codigos_rubro k
   where k.rubro = 'GRAMP' and k.activo
), cand as (
  select pp.producto, pp.pieza, pp.color, count(a.codigo) as n, min(a.codigo) as unico,
         string_agg(a.codigo, ' / ' order by a.codigo) as opciones
    from pp
    left join aro a on a.perfil = pp.perfil and a.med = pp.med_aro and a.soga = pp.soga
                   and (pp.color is null or a.color = pp.color or (pp.color = 'Blanco' and a.color = 'Blanco total'))
   where pp.perfil is not null
   group by pp.producto, pp.pieza, pp.color
)
select pp.producto, pp.pieza, pp.perfil, pp.med_aro,
       case when r.aro is not null then nullif(r.aro, '-')
            when pp.color = 'Sin marco' then null
            when cand.n = 1 then cand.unico end as aro,
       coalesce(r.cant, 1::numeric) * pp.mult * pp.prop as cant,
       case when r.aro is not null then 'receta'
            when pp.color = 'Sin marco' then 'sin marco'
            when cand.n = 1 then case when pp.color is null then 'auto' else 'color' end
            else 'sin receta' end as receta,
       cand.opciones, pp.color, pp.prop as proporcion
  from pp
  join cand on cand.producto = pp.producto and cand.pieza = pp.pieza and not cand.color is distinct from pp.color
  left join gt.receta_aro r on r.producto = pp.producto and (r.pieza = pp.pieza or r.pieza = '');
revoke all on gt.producto_aro from anon, authenticated;

create or replace function gt.color_fijar(p_codigo text, p_colores text[], p_fuente text default 'Thomas', p_nota text default null)
returns setof gt.codigo_color
language plpgsql security definer set search_path = ''
as $f$
begin
  if not exists (select 1 from gt.codigos where codigo = p_codigo) then
    raise exception 'GT: el código % no existe en gt.codigos', p_codigo;
  end if;
  if coalesce(array_length(p_colores, 1), 0) = 0 then
    raise exception 'GT: hace falta al menos un color';
  end if;
  -- lo que no está en la lista queda inactivo (no se borra: queda la historia, y el conector no deja DELETE)
  update gt.codigo_color set activo = false
   where codigo = p_codigo and activo and not (color = any (p_colores));
  insert into gt.codigo_color (codigo, color, proporcion, fuente, nota, activo)
  select p_codigo, c, null, p_fuente, p_nota, true from unnest(p_colores) as c
  on conflict (codigo, color) do update
     set activo = true, proporcion = null, fuente = excluded.fuente, nota = excluded.nota, cargado_en = now();
  return query select * from gt.codigo_color where codigo = p_codigo and activo order by color;
end
$f$;
revoke all on function gt.color_fijar(text, text[], text, text) from public, anon, authenticated;

select gt.color_fijar('713', array['Roble'], 'Thomas 01/10 (D22)');
select gt.color_fijar('714', array['Roble'], 'Thomas 01/10 (D22)');

-- Chequeos:
--   select * from gt.producto_aro where producto in ('224','220','408','409','281','713','714') order by 1, 2, 9;
--   select * from gt.aro_piezas where aro between '234' and '239' order by 1, 2;
--   select codigo, activo, discontinuado_nota from gt.codigos where not activo;
--   select codigo, maximo_cajas, maximo_consumo_cajas from gt.producto_max;   -- vacía hasta que lleguen los datos (D19)

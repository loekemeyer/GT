-- GT v1.23 — MOVIMIENTOS DE STOCK POR ETAPA, sólo internos (Thomas, 01/10/2026).
-- «Por ahora no hace stock, hace solamente movimientos. Cuando pueda voy a cargar el stock, pero por ahora que
--  internamente funcionen los movimientos, pero que no se los muestren a los operarios.»
-- Pedidos y Carga camión (D2): «que tengas la lógica, pero que no la utilices todavía» → está escrita y apagada
-- (gt.config 'stock_pedidos_activo', sin fila = apagado).
--
-- La cadena (Thomas): lo que cortan se grampea; lo que grampean va al stock de aros; lo que encolan descuenta
-- láminas y suma encolado; lo que montan descuenta aros y encolado; gancho descuenta montado; emblistado descuenta
-- gancho; contraído descuenta emblistado; guardado a góndola descuenta contraído; pedidos descuenta góndola; la
-- carga del camión descuenta lo armado.
--
-- CÓMO ESTÁ HECHO: gt.movimientos es una VISTA que sale de cada «Terminé» con cantidad de gt.registros. No guarda
-- nada aparte, así que no se puede desincronizar: un cierre que el sistema reemplaza (AREAX, 1.14) deja de contar
-- solo, y cuando se cargue una receta (gt.receta_aro, gt.receta_corte) se recalcula toda la historia.
--   · Unidades: piezas de corte, aros, y en las áreas de producto cajas × UxB.
--   · Corte → aro: un aro A*B lleva 2 piezas de A y 2 de B del mismo perfil (gt.aro_piezas; resuelve solo
--     los aros cuyo perfil y largo existen en Corte; el resto, gt.receta_corte).
--   · Producto → aro: moldura + medida, con el lado de 30 = 27,5 en cuadros de 10*30, 20*30, 30*30 y 30*40
--     (no en portarretratos). Si queda un solo aro posible se toma solo; si hay varios (el color) espera la
--     planilla de colores (D4) en gt.receta_aro. Mientras tanto el movimiento sale con aro vacío y receta
--     'sin receta', con las opciones.
--   · Sets x3: encolado, montado y gancho van POR MEDIDA; emblistar un set descuenta una de cada medida.
--   · Deco y Esnaola no mueven stock (sin definir / sin cantidad).
-- Nada de esto lo ve el operario: el schema gt está cerrado para anon y no hay RPC que lo lea.
--
-- Rollback (lo corre el dueño en el SQL Editor; el conector no deja DROP):
--   drop view gt.movimientos, gt.producto_aro, gt.producto_piezas, gt.aro_piezas;
--   drop table gt.receta_aro, gt.receta_corte;
--   drop function gt.sin0(text), gt.med_norm(text), gt.perfil_aro(text), gt.perfil_producto(text);

create or replace function gt.sin0(p text) returns text language sql immutable set search_path to '' as $$
  select regexp_replace(upper(btrim(coalesce(p, ''))), '^0+(?=\d)', '')
$$;
create or replace function gt.med_norm(p text) returns text language sql immutable set search_path to '' as $$
  select case when array_length(a, 1) = 2 and a[1] ~ '^[0-9]+(\.[0-9]+)?$' and a[2] ~ '^[0-9]+(\.[0-9]+)?$'
              then least(a[1]::numeric, a[2]::numeric)::text || '*' || greatest(a[1]::numeric, a[2]::numeric)::text
              else array_to_string(a, '*') end
    from (select string_to_array(replace(replace(coalesce(p, ''), ' ', ''), ',', '.'), '*') a) z
$$;
-- perfil del aro (descripción de Grampeado): 03 / 012 / 05 / 045 sin ceros, 3P34, 3P12, TRAV
create or replace function gt.perfil_aro(p text) returns text language sql immutable set search_path to '' as $$
  select case when p ~* '^3P 3/4' then '3P34' when p ~* '^3P 1/2' then '3P12' when p ~* '^Trav' then 'TRAV'
              else regexp_replace((regexp_match(p, '^(\d+)'))[1], '^0+(?=\d)', '') end
$$;
-- perfil del aro que lleva un producto, por su moldura (Mold 30mm = 3P 3/4: supuesto, ver CLAUDE.md)
create or replace function gt.perfil_producto(p text) returns text language sql stable set search_path to '' as $$
  select case when m is null or m = 'MDF' then null
              when m = 'Mold 30mm' then '3P34'
              when m ~ '^Mold [0-9]+$' then regexp_replace(substr(m, 6), '^0+(?=\d)', '')
              else m end
    from (select gt.moldura_de(p) m) z
$$;
revoke all on function gt.sin0(text), gt.med_norm(text), gt.perfil_aro(text), gt.perfil_producto(text)
  from public, anon, authenticated;

-- recetas a mano (mandan sobre lo automático)
create table if not exists gt.receta_aro (
  producto text not null,
  pieza    text not null default '',   -- '' = todo el producto; para sets y múltiples, la medida de la pieza
  aro      text not null,              -- código de Grampeado; '-' = no lleva aro
  cant     numeric not null default 1, -- aros por unidad (se multiplica por el xN del múltiple)
  nota     text,
  primary key (producto, pieza, aro)
);
create table if not exists gt.receta_corte (
  aro   text not null,     -- código de Grampeado
  pieza text not null,     -- código de Corte
  cant  numeric not null,  -- piezas por aro
  nota  text,
  primary key (aro, pieza)
);
alter table gt.receta_aro   enable row level security;
alter table gt.receta_corte enable row level security;
revoke all on gt.receta_aro, gt.receta_corte from anon, authenticated;

-- Corte → aro
create or replace view gt.aro_piezas with (security_invoker = true) as
with aro as (
  select codigo aro,
         lower(regexp_replace(regexp_replace(regexp_replace(btrim(descripcion), '\s+T$', ' Total', 'i'),
               '\s+(P c/B|P|p/soga)$', '', 'i'), '\mNat$', 'Natural', 'i')) perfil,
         string_to_array(replace(replace(coalesce(medida, ''), ' ', ''), ',', '.'), '*') lados
    from gt.codigos_rubro where rubro = 'GRAMP' and activo),
lado as (
  select a.aro, a.perfil, l.v::numeric largo, count(*) * 2 cant
    from aro a, unnest(a.lados) l(v)
   where array_length(a.lados, 1) = 2 and l.v ~ '^[0-9]+(\.[0-9]+)?$'
   group by 1, 2, 3),
corte as (
  select codigo pieza, lower(btrim(descripcion)) perfil,
         nullif(regexp_replace(replace(coalesce(medida, ''), ',', '.'), '[^0-9.]', '', 'g'), '')::numeric largo
    from gt.codigos_rubro where rubro = 'CORTE' and activo)
select rc.aro, rc.pieza, rc.cant, 'receta'::text receta, null::numeric largo from gt.receta_corte rc
union all
select l.aro, c.pieza, l.cant, case when c.pieza is null then 'sin receta' else 'auto' end, l.largo
  from lado l left join corte c on c.perfil = l.perfil and c.largo = l.largo
 where not exists (select 1 from gt.receta_corte rc where rc.aro = l.aro);

-- piezas de cada producto (un set x3 tiene 3; un múltiple «13*18 x4» es una pieza ×4)
create or replace view gt.producto_piezas with (security_invoker = true) as
select c.codigo producto, gt.es_set3(c.descripcion) es_set,
       btrim(regexp_replace(pz.p, '\s*x\s*[0-9]+\s*$', '', 'i')) pieza,
       coalesce((regexp_match(pz.p, 'x\s*([0-9]+)\s*$', 'i'))[1]::int, 1) mult, pz.ord
  from gt.codigos c, lateral unnest(string_to_array(c.medida, '+')) with ordinality pz(p, ord)
 where coalesce(btrim(c.medida), '') <> '';

-- producto → aro
create or replace view gt.producto_aro with (security_invoker = true) as
with pp as (
  select p.producto, p.pieza, p.mult, gt.perfil_producto(c.descripcion) perfil,
         gt.med_norm(case when c.descripcion !~* '^Porta\s' and replace(p.pieza, ' ', '') in ('10*30', '20*30', '30*30', '30*40')
                          then regexp_replace(replace(p.pieza, ' ', ''), '30', '27.5', 'g') else p.pieza end) med_aro
    from gt.producto_piezas p join gt.codigos c on c.codigo = p.producto),
aro as (select codigo, gt.perfil_aro(descripcion) perfil, gt.med_norm(medida) med
          from gt.codigos_rubro where rubro = 'GRAMP' and activo),
cand as (select pp.producto, pp.pieza, count(a.codigo) n, min(a.codigo) unico,
                string_agg(a.codigo, ' / ' order by a.codigo) opciones
           from pp left join aro a on a.perfil = pp.perfil and a.med = pp.med_aro
          where pp.perfil is not null group by 1, 2)
select pp.producto, pp.pieza, pp.perfil, pp.med_aro,
       case when r.aro is not null then nullif(r.aro, '-') when cand.n = 1 then cand.unico end aro,
       coalesce(r.cant, 1) * pp.mult cant,
       case when r.aro is not null then 'receta' when cand.n = 1 then 'auto' else 'sin receta' end receta,
       cand.opciones
  from pp join cand using (producto, pieza)
  left join gt.receta_aro r on r.producto = pp.producto and r.pieza in (pp.pieza, '');

-- los movimientos
create or replace view gt.movimientos with (security_invoker = true) as
with cfg as (select coalesce((select c.valor from gt.config c where c.clave = 'stock_pedidos_activo'), '0') = '1' ped_on),
r as (
  select r.id registro_id, r.ts_cliente ts, (r.ts_cliente at time zone 'America/Argentina/Buenos_Aires')::date dia,
         r.empleado_id, r.planta, r.rubro area, nullif(btrim(r.medida), '') medida, r.cantidad, btrim(r.texto) texto
    from gt.registros r
   where r.opcion = 'AREA' and r.ts_inicio is not null and r.cantidad > 0 and coalesce(btrim(r.texto), '') <> ''),
rc as (   -- Corte y Grampeado: su propia lista de códigos
  select r.*, coalesce(cr.codigo, r.texto) codigo, cr.codigo is null fuera
    from r left join gt.codigos_rubro cr on cr.rubro = r.area and gt.sin0(cr.codigo) = gt.sin0(r.texto)
   where r.area in ('CORTE', 'GRAMP')),
rp as (   -- áreas de producto: cajas × UxB
  select r.*, coalesce(c.codigo, r.texto) producto, c.codigo is null fuera, coalesce(gt.es_set3(c.descripcion), false) es_set,
         r.cantidad * coalesce(c.uxb, 1) u,
         case when c.codigo is null then 'código fuera de la lista' when c.uxb is null then 'sin UxB: se tomó la cantidad' end nota
    from r left join gt.codigos c on gt.sin0(c.codigo) = gt.sin0(r.texto)
   where r.area in ('ENCOL', 'MONT', 'GANCHO', 'EMBL', 'CONTR', 'GUARD')
      or (r.area in ('PED', 'CARGA') and (select ped_on from cfg))),
rpz as (  -- un set va por pieza; lo demás, una sola fila sin pieza
  select rp.*, pz.pieza
    from rp left join lateral (
      select p.pieza from gt.producto_piezas p where rp.es_set and p.producto = rp.producto
      union all select null::text where not rp.es_set) pz on true),
mov (registro_id, ts, dia, empleado_id, planta, area, deposito, codigo, medida, delta, receta, nota) as (
  -- Corte: + piezas
  select registro_id, ts, dia, empleado_id, planta, area, 'corte', codigo, null::text, cantidad, 'ok',
         case when fuera then 'código fuera de la lista' end
    from rc where area = 'CORTE'
  union all  -- Grampeado: + aros
  select registro_id, ts, dia, empleado_id, planta, area, 'aro', codigo, null, cantidad, 'ok',
         case when fuera then 'código fuera de la lista' end
    from rc where area = 'GRAMP'
  union all  -- Grampeado: − piezas de corte (2 de cada lado)
  select rc.registro_id, rc.ts, rc.dia, rc.empleado_id, rc.planta, rc.area, 'corte', ap.pieza, null, -(coalesce(ap.cant, 0) * rc.cantidad),
         coalesce(ap.receta, 'sin receta'),
         case when ap.pieza is null then 'aro ' || rc.codigo || ': no se encontró la pieza de corte' || coalesce(' de ' || ap.largo::text || ' cm', '') end
    from rc left join gt.aro_piezas ap on ap.aro = rc.codigo
   where rc.area = 'GRAMP'
  union all  -- Encolado: + encolado
  select registro_id, ts, dia, empleado_id, planta, area, 'encolado', producto, pieza, u, 'ok', nota from rpz where area = 'ENCOL'
  union all  -- Encolado: − lámina
  select registro_id, ts, dia, empleado_id, planta, area, 'lamina', producto, pieza, -u, 'ok', nota from rpz where area = 'ENCOL'
  union all  -- Montaje: + montado
  select registro_id, ts, dia, empleado_id, planta, area, 'montado', producto, medida, u, 'ok', nota from rp where area = 'MONT'
  union all  -- Montaje: − encolado
  select registro_id, ts, dia, empleado_id, planta, area, 'encolado', producto, medida, -u, 'ok', nota from rp where area = 'MONT'
  union all  -- Montaje: − aros
  select rp.registro_id, rp.ts, rp.dia, rp.empleado_id, rp.planta, rp.area, 'aro', pa.aro, pa.pieza, -(pa.cant * rp.u), pa.receta,
         case when pa.aro is null and pa.receta = 'sin receta'
              then rp.producto || ' ' || pa.pieza || ': ' || coalesce('elegir entre ' || pa.opciones, 'no hay aro ' || pa.med_aro || ' en Grampeado') end
    from rp join gt.producto_aro pa on pa.producto = rp.producto and (rp.medida is null or pa.pieza = rp.medida)
   where rp.area = 'MONT' and (pa.aro is not null or pa.receta = 'sin receta')
  union all  -- Gancho: + gancho, − montado
  select registro_id, ts, dia, empleado_id, planta, area, 'gancho', producto, medida, u, 'ok', nota from rp where area = 'GANCHO'
  union all
  select registro_id, ts, dia, empleado_id, planta, area, 'montado', producto, medida, -u, 'ok', nota from rp where area = 'GANCHO'
  union all  -- Emblistado: + emblistado, − gancho (un set, una de cada medida)
  select registro_id, ts, dia, empleado_id, planta, area, 'emblistado', producto, null, u, 'ok', nota from rp where area = 'EMBL'
  union all
  select registro_id, ts, dia, empleado_id, planta, area, 'gancho', producto, pieza, -u, 'ok', nota from rpz where area = 'EMBL'
  union all  -- Contraído: + contraído, − emblistado
  select registro_id, ts, dia, empleado_id, planta, area, 'contraido', producto, null, u, 'ok', nota from rp where area = 'CONTR'
  union all
  select registro_id, ts, dia, empleado_id, planta, area, 'emblistado', producto, null, -u, 'ok', nota from rp where area = 'CONTR'
  union all  -- Guardado a góndola: + góndola, − contraído
  select registro_id, ts, dia, empleado_id, planta, area, 'gondola', producto, null, u, 'ok', nota from rp where area = 'GUARD'
  union all
  select registro_id, ts, dia, empleado_id, planta, area, 'contraido', producto, null, -u, 'ok', nota from rp where area = 'GUARD'
  union all  -- Pedidos (apagado, D2): + armado, − góndola
  select registro_id, ts, dia, empleado_id, planta, area, 'armado', producto, null, u, 'ok', nota from rp where area = 'PED'
  union all
  select registro_id, ts, dia, empleado_id, planta, area, 'gondola', producto, null, -u, 'ok', nota from rp where area = 'PED'
  union all  -- Carga camión (apagado, D2; el área todavía no existe): − armado
  select registro_id, ts, dia, empleado_id, planta, area, 'armado', producto, null, -u, 'ok', nota from rp where area = 'CARGA'
)
select * from mov;

revoke all on gt.aro_piezas, gt.producto_piezas, gt.producto_aro, gt.movimientos from anon, authenticated;

-- Consultas útiles (sólo por el MCP / SQL Editor):
--   select * from gt.movimientos where dia = current_date order by ts;
--   select deposito, codigo, medida, sum(delta) from gt.movimientos group by 1,2,3 order by 1,2;  -- neto (no es stock: falta el inicial)
--   select * from gt.movimientos where receta = 'sin receta';                                     -- lo que espera receta (D4)

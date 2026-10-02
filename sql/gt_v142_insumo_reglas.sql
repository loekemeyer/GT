-- GT gt_v142 (Thomas, 01/10/2026: «Hacé laburar todo lo de D35 dentro del schema GT») — los insumos se resuelven SOLOS por
-- REGLAS que viven en la base (gt.insumo_regla), sin que nadie cargue producto por producto. Qué lleva un producto en cada
-- etapa se resuelve en este orden, ETAPA por etapa: receta del producto > receta de su grupo > regla (por patrón sobre la
-- descripción). Para los aros: receta del aro > regla. Un insumo '-' en una receta = «en esta etapa no lleva nada».
-- Las plantillas llevan {medida} y se reemplaza por la medida del producto (o la de cada pieza de un set: por_pieza).
--
-- Reglas sembradas (se corrigen con un update, no con un deploy): ver el insert de abajo. Las marcadas [Probable] /
-- [Adivinando] en la nota son lectura de Claude, no dato de Thomas (D36: confirmar o corregir).
--
-- Objetos: gt.insumo_regla (nueva) · gt.insumo_receta + por_pieza · gt.producto_insumo (+ por_pieza, y las reglas) ·
-- gt.movimientos (bloques gt_v142) · gt.demanda_insumos (reglas + nombres automáticos) · gt.insumos (3 filas: GANCHO, FILM, GRAMPA).
-- gt.codigos.lleva_lamina (gt_v141) queda SIN USO: la regla de Encolado lo reemplaza. La columna es inocua.
--
-- ROLLBACK: update gt.insumo_regla set activo = false (apaga todas las reglas: queda como gt_v141, con el respaldo de
-- lámina + chapadur en Encolado) · la vista anterior: sql/gt_v141_lamina_chapadur.sql.

alter table gt.insumo_receta add column if not exists por_pieza boolean not null default false;
comment on column gt.insumo_receta.por_pieza is 'true = en un set x3 se descuenta uno por cada medida (lámina, chapadur, gancho). false = uno por unidad del producto.';

create table if not exists gt.insumo_regla (
  id        bigserial primary key,
  ambito    text not null default 'producto' check (ambito in ('producto', 'aro')),
  etapa     text not null references gt.rubros (codigo),
  patron    text,            -- regex (sin distinguir mayúsculas) sobre la descripción del producto / del aro. null = todos
  excluye   text,            -- regex: si matchea, la regla no aplica
  insumo    text not null,   -- plantilla: 'GANCHO', 'BLIS {medida}', 'VIDRIO {medida}'… ('-' = no lleva nada en esta etapa)
  cantidad  numeric not null default 1 check (cantidad > 0),
  por_pieza boolean not null default false,
  orden     int not null default 100,
  activo    boolean not null default true,
  fuente    text,
  nota      text,
  cargado_en timestamptz not null default now()
);
alter table gt.insumo_regla enable row level security;
revoke all on gt.insumo_regla from anon, authenticated;

insert into gt.insumos (codigo, nombre, unidad, nota) values
  ('GANCHO', 'Gancho', 'u', 'gt_v142'),
  ('FILM',   'Film termocontraíble (unidades contraídas, no metros)', 'u', 'gt_v142: cuenta unidades, no metros de film'),
  ('GRAMPA', 'Grampa', 'u', 'gt_v142')
on conflict (codigo) do nothing;
-- la convención «-» necesita su fila (FK de gt.insumo_receta): inactiva a propósito, para que no figure en la demanda
insert into gt.insumos (codigo, nombre, unidad, activo, nota)
values ('-', '(no lleva nada en esta etapa)', 'u', false, 'gt_v142: convención para una receta que ANULA la regla en una etapa. No es un insumo')
on conflict (codigo) do nothing;

insert into gt.insumo_regla (ambito, etapa, patron, excluye, insumo, cantidad, por_pieza, orden, fuente, nota) values
  ('producto', 'ENCOL',  '^cuadros?\M', 'MDF', 'LAM {medida}',    1, true,  10, 'Thomas 01/10', 'lámina encolada es lámina + chapadur. Cuadros, menos los MDF importados (080 a 089)'),
  ('producto', 'ENCOL',  '^cuadros?\M', 'MDF', 'CHAP {medida}',   1, true,  11, 'Thomas 01/10', 'ídem'),
  ('producto', 'GANCHO', '^(cuadros?|porta|espejo|diploma|multiple)\M', null, 'GANCHO', 1, true, 20, 'Claude 01/10', '[Probable] un gancho por cuadro. Un set x3: uno por cuadro'),
  ('producto', 'EMBL',   '^(cuadros?|porta|espejo|diploma|multiple)\M', null, 'BLIS {medida}', 1, false, 30, 'Claude 01/10', '[Probable] un blíster por unidad. Un set x3 entero en uno'),
  ('producto', 'CONTR',  '^(cuadros?|porta|espejo|diploma|multiple)\M', null, 'FILM', 1, false, 40, 'Claude 01/10', '[Adivinando] cuenta unidades contraídas, no metros de film'),
  ('producto', 'MONT',   'c/Vidrio|^(porta|multiple)\M', null, 'VIDRIO {medida}', 1, false, 50, 'Claude 01/10', '[Probable] portas, múltiples y todo lo que dice c/Vidrio'),
  ('producto', 'MONT',   '^(porta|multiple|diploma)\M', null, 'FONDO {medida}', 1, false, 51, 'Claude 01/10', '[Adivinando] el fondo del portarretrato / diploma'),
  ('producto', 'MONT',   '^espejo', null, 'ESPEJO {medida}', 1, false, 52, 'Claude 01/10', '[Probable] el espejo de la medida'),
  ('aro',      'GRAMP',  null, null, 'GRAMPA', 8, false, 60, 'Claude 01/10', '[Adivinando] 8 grampas por aro (2 por esquina)');

-- qué insumos lleva cada producto en cada etapa, resuelto: receta del producto > receta de su grupo > regla (etapa por etapa).
-- Devuelve también las filas '-' (= nada en esa etapa): los consumidores las saltean, pero cuentan como «resuelto».
create or replace view gt.producto_insumo with (security_invoker = true) as
with c as (select codigo, descripcion, medida, gt.grupo_codigo(codigo) grupo from gt.codigos where activo),
niv as (
  select c.codigo producto, e.codigo etapa,
         case when exists (select 1 from gt.insumo_receta r where r.activo and r.nivel = 'producto' and gt.sin0(r.codigo) = gt.sin0(c.codigo) and r.etapa = e.codigo) then 'producto'
              when exists (select 1 from gt.insumo_receta r where r.activo and r.nivel = 'grupo' and r.codigo = c.grupo and r.etapa = e.codigo) then 'grupo'
              else 'regla' end nivel
    from c cross join gt.rubros e where e.activo)
select n.producto, x.insumo, x.cantidad, n.etapa, n.nivel origen, x.receta_de, x.por_pieza
  from niv n join c on c.codigo = n.producto
  join lateral (
    select r.insumo, r.cantidad, r.codigo receta_de, r.por_pieza from gt.insumo_receta r
     where n.nivel = 'producto' and r.activo and r.nivel = 'producto' and gt.sin0(r.codigo) = gt.sin0(n.producto) and r.etapa = n.etapa
    union all
    select r.insumo, r.cantidad, r.codigo, r.por_pieza from gt.insumo_receta r
     where n.nivel = 'grupo' and r.activo and r.nivel = 'grupo' and r.codigo = c.grupo and r.etapa = n.etapa
    union all
    select g.insumo, g.cantidad, 'regla ' || g.id, g.por_pieza from gt.insumo_regla g
     where n.nivel = 'regla' and g.activo and g.ambito = 'producto' and g.etapa = n.etapa
       and (g.patron is null or c.descripcion ~* g.patron) and (g.excluye is null or c.descripcion !~* g.excluye)
  ) x on true;
revoke all on gt.producto_insumo from anon, authenticated;

create or replace view gt.movimientos with (security_invoker = true) as
with cfg as (select coalesce((select c.valor from gt.config c where c.clave = 'stock_pedidos_activo'), '0') = '1' ped_on),
r as (
  select r.id registro_id, r.ts_cliente ts, (r.ts_cliente at time zone 'America/Argentina/Buenos_Aires')::date dia,
         r.empleado_id, r.planta, r.rubro area, nullif(btrim(r.medida), '') medida, r.cantidad, btrim(r.texto) texto, r.detalle
    from gt.registros r
   where r.opcion = 'AREA' and r.ts_inicio is not null and r.cantidad > 0 and coalesce(btrim(r.texto), '') <> ''),
rc as (   -- Corte y Grampeado: su propia lista de códigos
  select r.*, coalesce(cr.codigo, r.texto) codigo, cr.codigo is null fuera, cr.descripcion aro_desc, cr.medida aro_medida
    from r left join gt.codigos_rubro cr on cr.rubro = r.area and gt.sin0(cr.codigo) = gt.sin0(r.texto)
   where r.area in ('CORTE', 'GRAMP')),
rp as (   -- áreas de producto: cajas × UxB
  select r.*, coalesce(c.codigo, r.texto) producto, c.codigo is null fuera, coalesce(gt.es_set3(c.descripcion), false) es_set,
         r.cantidad * coalesce(c.uxb, 1) u, c.medida medida_prod,
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
  union all  -- Encolado, RESPALDO (Thomas 01/10, gt_v141: «lámina encolada es lámina + chapadur»): si ninguna receta ni regla
             -- resolvió insumos para ENCOL, se descuentan igual LÁMINA y CHAPADUR de la medida (un set: una de cada medida)
  select registro_id, ts, dia, empleado_id, planta, area, 'insumo', 'LAM ' || coalesce(pieza, medida_prod, '?'), null, -u, 'ok', nota from rpz
   where area = 'ENCOL' and not exists (select 1 from gt.producto_insumo pi where pi.producto = rpz.producto and pi.etapa = 'ENCOL')
  union all
  select registro_id, ts, dia, empleado_id, planta, area, 'insumo', 'CHAP ' || coalesce(pieza, medida_prod, '?'), null, -u, 'ok', nota from rpz
   where area = 'ENCOL' and not exists (select 1 from gt.producto_insumo pi where pi.producto = rpz.producto and pi.etapa = 'ENCOL')
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
  union all  -- 1.24 Moldurado (Esnaola): + moldura, en metros
  select registro_id, ts, dia, empleado_id, planta, area, 'moldura', texto, null, cantidad, 'ok', null from r where area = 'MOLDU'
  union all  -- 1.24 Lijado: − moldura, + moldura lijada (con «anilina Cedro» / «sin anilina» en medida)
  select registro_id, ts, dia, empleado_id, planta, area, 'moldura', texto, null, -cantidad, 'ok', null from r where area = 'LIJA'
  union all
  select registro_id, ts, dia, empleado_id, planta, area, 'moldura_lijada', texto, gt.detalle_txt(detalle), cantidad, 'ok', null from r where area = 'LIJA'
  union all  -- 1.25 Pintado: + moldura pintada (PAQUETES, con el color en medida)
  select registro_id, ts, dia, empleado_id, planta, area, 'moldura_pintada', texto, gt.detalle_txt(detalle), cantidad, 'ok', null from r where area = 'PINT'
  union all  -- 1.25 Pintado: − moldura lijada sin anilina, en metros = paquetes × metros por paquete (gt.moldura_paquete)
  select r.registro_id, r.ts, r.dia, r.empleado_id, r.planta, r.area, 'moldura_lijada', r.texto, 'sin anilina',
         -(r.cantidad * coalesce(mp.metros_por_paquete, 0)),
         case when mp.metros_por_paquete is null then 'sin receta' else 'ok' end,
         case when mp.metros_por_paquete is null then 'falta cuántos metros trae un paquete de moldura ' || r.texto end
    from r left join gt.moldura_paquete mp on mp.moldura = r.texto where r.area = 'PINT'
  union all  -- gt_v142: − insumos del PRODUCTO en su etapa, UNO POR EVENTO (gancho, blíster, film, vidrio, fondo, espejo…)
  select rp.registro_id, rp.ts, rp.dia, rp.empleado_id, rp.planta, rp.area, 'insumo',
         replace(pi.insumo, '{medida}', coalesce(rp.medida, rp.medida_prod, '?')), null, -(pi.cantidad * rp.u), 'ok', rp.nota
    from rp join gt.producto_insumo pi on pi.producto = rp.producto and pi.etapa = rp.area and not pi.por_pieza and pi.insumo <> '-'
  union all  -- gt_v142: − insumos del producto POR PIEZA (un set x3 sin medida en el evento: uno por cada medida; con medida: sólo ésa)
  select rpz.registro_id, rpz.ts, rpz.dia, rpz.empleado_id, rpz.planta, rpz.area, 'insumo',
         replace(pi.insumo, '{medida}', coalesce(rpz.pieza, rpz.medida, rpz.medida_prod, '?')), null, -(pi.cantidad * rpz.u), 'ok', rpz.nota
    from rpz join gt.producto_insumo pi on pi.producto = rpz.producto and pi.etapa = rpz.area and pi.por_pieza and pi.insumo <> '-'
   where rpz.medida is null or rpz.pieza is null or rpz.pieza = rpz.medida
  union all  -- gt_v142: − insumos del ARO al grampear: receta propia del aro (gt.insumo_receta nivel aro), si no la regla (gt.insumo_regla ambito aro)
  select rc.registro_id, rc.ts, rc.dia, rc.empleado_id, rc.planta, rc.area, 'insumo',
         replace(x.insumo, '{medida}', coalesce(rc.aro_medida, '?')), null, -(x.cantidad * rc.cantidad), 'ok', null
    from rc join lateral (
      select ir.insumo, ir.cantidad from gt.insumo_receta ir
       where ir.activo and ir.nivel = 'aro' and ir.etapa = rc.area and gt.sin0(ir.codigo) = gt.sin0(rc.codigo)
      union all
      select g.insumo, g.cantidad from gt.insumo_regla g
       where g.activo and g.ambito = 'aro' and g.etapa = rc.area
         and (g.patron is null or coalesce(rc.aro_desc, '') ~* g.patron) and (g.excluye is null or coalesce(rc.aro_desc, '') !~* g.excluye)
         and not exists (select 1 from gt.insumo_receta ir where ir.activo and ir.nivel = 'aro' and ir.etapa = rc.area and gt.sin0(ir.codigo) = gt.sin0(rc.codigo))
    ) x on true
   where rc.area = 'GRAMP' and x.insumo <> '-'
)
select * from mov;
revoke all on gt.movimientos from anon, authenticated;

-- qué comprar: lo que pide la demanda de fabricación (a_fabricar × UxB × lo que lleva cada producto, + lo de cada aro ×
-- aros a grampear) menos lo que hay en el depósito 'insumo'. Los nombres de los insumos con medida salen solos.
create or replace view gt.demanda_insumos with (security_invoker = true) as
with prod as (
  select d.codigo producto, greatest(coalesce(d.a_fabricar_cajas, 0), 0) * coalesce(d.uxb, 1) unidades,
         c.medida, coalesce(gt.es_set3(c.descripcion), false) es_set
    from gt.demanda_producto d join gt.codigos c on c.codigo = d.codigo),
nec as (
  select replace(pi.insumo, '{medida}', coalesce(m.medida, '?')) insumo, sum(pi.cantidad * p.unidades) necesarios, count(distinct p.producto) para
    from prod p
    join gt.producto_insumo pi on pi.producto = p.producto and pi.insumo <> '-'
    join lateral (select pz.pieza medida from gt.producto_piezas pz where pi.por_pieza and p.es_set and pz.producto = p.producto
                  union all select p.medida where not (pi.por_pieza and p.es_set)) m on true
   where p.unidades > 0 group by 1
  union all
  select replace(x.insumo, '{medida}', coalesce(a.medida, '?')), sum(x.cantidad * greatest(coalesce(a.a_grampear, 0), 0)), count(distinct a.aro)
    from gt.demanda_aros a
    join lateral (
      select ir.insumo, ir.cantidad from gt.insumo_receta ir
       where ir.activo and ir.nivel = 'aro' and ir.etapa = 'GRAMP' and gt.sin0(ir.codigo) = gt.sin0(a.aro)
      union all
      select g.insumo, g.cantidad from gt.insumo_regla g
       where g.activo and g.ambito = 'aro' and g.etapa = 'GRAMP'
         and (g.patron is null or coalesce(a.descripcion, '') ~* g.patron) and (g.excluye is null or coalesce(a.descripcion, '') !~* g.excluye)
         and not exists (select 1 from gt.insumo_receta ir where ir.activo and ir.nivel = 'aro' and ir.etapa = 'GRAMP' and gt.sin0(ir.codigo) = gt.sin0(a.aro))
    ) x on true
   where x.insumo <> '-' group by 1),
agg as (select insumo, sum(necesarios) necesarios, sum(para) para from nec group by 1),
cat as (
  select codigo insumo, nombre, unidad from gt.insumos where activo
  union all
  select a.insumo,
         case when a.insumo like 'LAM %'    then 'Lámina '   || substr(a.insumo, 5)
              when a.insumo like 'CHAP %'   then 'Chapadur ' || substr(a.insumo, 6)
              when a.insumo like 'BLIS %'   then 'Blíster '  || substr(a.insumo, 6)
              when a.insumo like 'VIDRIO %' then 'Vidrio '   || substr(a.insumo, 8)
              when a.insumo like 'FONDO %'  then 'Fondo '    || substr(a.insumo, 7)
              when a.insumo like 'ESPEJO %' then 'Espejo '   || substr(a.insumo, 8)
              else a.insumo end, 'u'
    from agg a where not exists (select 1 from gt.insumos i where i.codigo = a.insumo))
select c.insumo, c.nombre, c.unidad,
       coalesce(a.necesarios, 0) necesarios,
       coalesce(s.saldo, 0) en_stock, coalesce(s.con_conteo, false) con_conteo,
       greatest(coalesce(a.necesarios, 0) - coalesce(s.saldo, 0), 0) a_comprar,
       a.para productos_o_aros
  from cat c
  left join agg a on a.insumo = c.insumo
  left join gt.stock s on s.deposito = 'insumo' and s.codigo = c.insumo and s.medida is null
 order by 7 desc, 1;
revoke all on gt.demanda_insumos from anon, authenticated;

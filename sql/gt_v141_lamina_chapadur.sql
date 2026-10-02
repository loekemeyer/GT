-- GT gt_v141 (Thomas, 01/10/2026: «Lámina encolada es lámina + chapadur») — Encolado descuenta LÁMINA + CHAPADUR
-- de la medida del producto, solo, sin cargar nada: la etapa Encolado ES pegar la lámina sobre el chapadur, así que el
-- evento del operario alcanza para saber qué se consumió. Códigos: 'LAM 30*40' y 'CHAP 30*40' (la medida de gt.codigos;
-- un set x3: una de cada medida). Reemplaza al depósito genérico 'lamina' de 1.23. Si un producto tiene receta propia
-- de insumos en ENCOL (gt.insumo_receta), ésa manda y lo automático no corre.
--
-- Y para la DEMANDA (qué comprar) hace falta saber qué productos llevan lámina ANTES de fabricarlos:
-- gt.codigos.lleva_lamina (null = sin definir, no se cuenta). Se completa con D36.
--
-- ROLLBACK: \i sql/gt_v140_insumos.sql (la vista con la lámina genérica) · la columna queda, es inocua.

alter table gt.codigos add column if not exists lleva_lamina boolean;
comment on column gt.codigos.lleva_lamina is 'gt_v141: true = en Encolado lleva lámina + chapadur de su medida (cuenta en gt.demanda_insumos). null = sin definir.';

create or replace view gt.movimientos with (security_invoker = true) as
with cfg as (select coalesce((select c.valor from gt.config c where c.clave = 'stock_pedidos_activo'), '0') = '1' ped_on),
r as (
  select r.id registro_id, r.ts_cliente ts, (r.ts_cliente at time zone 'America/Argentina/Buenos_Aires')::date dia,
         r.empleado_id, r.planta, r.rubro area, nullif(btrim(r.medida), '') medida, r.cantidad, btrim(r.texto) texto, r.detalle
    from gt.registros r
   where r.opcion = 'AREA' and r.ts_inicio is not null and r.cantidad > 0 and coalesce(btrim(r.texto), '') <> ''),
rc as (   -- Corte y Grampeado: su propia lista de códigos
  select r.*, coalesce(cr.codigo, r.texto) codigo, cr.codigo is null fuera
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
  union all  -- Encolado (Thomas 01/10, gt_v141: «lámina encolada es lámina + chapadur»): − LÁMINA y − CHAPADUR de la medida
             -- del producto (un set: una de cada medida), salvo que el producto tenga receta propia de insumos en ENCOL
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
  union all  -- D34 (gt_v140): − insumos del PRODUCTO en la etapa que los consume (gt.producto_insumo: producto > grupo)
  select rp.registro_id, rp.ts, rp.dia, rp.empleado_id, rp.planta, rp.area, 'insumo', pi.insumo, null, -(pi.cantidad * rp.u), 'ok', rp.nota
    from rp join gt.producto_insumo pi on pi.producto = rp.producto and pi.etapa = rp.area
  union all  -- D34 (gt_v140): − insumos del ARO (grampas) al grampear
  select rc.registro_id, rc.ts, rc.dia, rc.empleado_id, rc.planta, rc.area, 'insumo', ir.insumo, null, -(ir.cantidad * rc.cantidad), 'ok', null
    from rc join gt.insumo_receta ir on ir.activo and ir.nivel = 'aro' and ir.etapa = rc.area and gt.sin0(ir.codigo) = gt.sin0(rc.codigo)
   where rc.area = 'GRAMP'
)
select * from mov;
revoke all on gt.movimientos from anon, authenticated;

-- qué comprar: lo que pide la demanda de fabricación (a_fabricar × UxB × receta, + lámina y chapadur implícitos de los
-- productos con lleva_lamina, + grampas × aros a grampear) menos lo que hay en el depósito 'insumo'
create or replace view gt.demanda_insumos with (security_invoker = true) as
with prod as (
  select d.codigo producto, greatest(coalesce(d.a_fabricar_cajas, 0), 0) * coalesce(d.uxb, 1) unidades,
         c.medida, coalesce(c.lleva_lamina, false) lleva_lamina, coalesce(gt.es_set3(c.descripcion), false) es_set
    from gt.demanda_producto d join gt.codigos c on c.codigo = d.codigo),
nec as (
  select pi.insumo, sum(pi.cantidad * p.unidades) necesarios, count(distinct p.producto) para
    from prod p join gt.producto_insumo pi on pi.producto = p.producto
   where p.unidades > 0 group by 1
  union all   -- lámina + chapadur implícitos (gt_v141): producto que lleva lámina y no tiene receta propia en ENCOL
  select x.insumo, sum(p.unidades), count(distinct p.producto)
    from prod p
    join lateral (select pz.pieza medida from gt.producto_piezas pz where p.es_set and pz.producto = p.producto
                  union all select p.medida where not p.es_set) m on true
    cross join lateral (values ('LAM ' || coalesce(m.medida, '?')), ('CHAP ' || coalesce(m.medida, '?'))) x(insumo)
   where p.unidades > 0 and p.lleva_lamina
     and not exists (select 1 from gt.producto_insumo pi where pi.producto = p.producto and pi.etapa = 'ENCOL')
   group by 1
  union all
  select ir.insumo, sum(ir.cantidad * greatest(coalesce(a.a_grampear, 0), 0)), count(distinct a.aro)
    from gt.demanda_aros a join gt.insumo_receta ir on ir.activo and ir.nivel = 'aro' and gt.sin0(ir.codigo) = gt.sin0(a.aro)
   group by 1),
agg as (select insumo, sum(necesarios) necesarios, sum(para) para from nec group by 1),
cat as (
  select codigo insumo, nombre, unidad from gt.insumos where activo
  union all
  select a.insumo,
         case when a.insumo like 'LAM %' then 'Lámina ' || substr(a.insumo, 5)
              when a.insumo like 'CHAP %' then 'Chapadur ' || substr(a.insumo, 6) else a.insumo end, 'u'
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

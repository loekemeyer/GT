-- GT v1.25 — gt.movimientos COMPLETA como quedó aplicada (regla: el CREATE entero va en el repo, no sólo el parche).
-- Es la de gt_v123_movimientos.sql + detalle en r + Moldurado y Lijado (1.24) + Pintado (1.25). Equivalente a lo que aplicó el bloque
-- do $mov$ de gt_v124_esnaola_pasos.sql y gt_v125_pintado_paquetes_cubo.sql (verificado el 01/10/2026). Rollback de 1.25: gt_v124_movimientos_vivo.sql.
-- Necesita gt.detalle_txt (gt_v124_esnaola_pasos.sql).

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
)
select * from mov;
revoke all on gt.movimientos from anon, authenticated;

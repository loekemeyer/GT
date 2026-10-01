-- GT v1.25 — Pintado cuenta PAQUETES y el Porta Cubo usa los aros Bco P chicos (Thomas, 01/10/2026).
-- D8: «Pintado: paquetes (depende la moldura, los paquetes van de diferente cantidad por paquete)».
-- D6: «sí, pero se cortan cubo» → los aros 066/067/068 (3P 3/4 Bco P 10*15, 13*18, 15*21) son los del
--     Porta Mold 30mm Cubo 814/815/816. En Corte se cortan como «cubo»: esas piezas NO están en el tablero
--     de Corte (1–156), así que hasta tener sus códigos los aros 066/067/068 siguen «sin receta» de corte.
--
-- Movimientos (gt.movimientos, internos): Pintado + moldura_pintada (paquetes, con el color en medida) y
-- − moldura_lijada «sin anilina» en metros = paquetes × metros por paquete de esa moldura
-- (gt.moldura_paquete). Sin el dato de la moldura, la fila sale «sin receta» con la nota de lo que falta.
--
-- Rollback (lo corre el dueño en el SQL Editor; el conector no deja DROP ni DELETE):
--   delete from gt.receta_aro where producto in ('814','815','816');
--   update gt.rubros set unidad = '—', pide_cantidad = false where codigo = 'PINT';
--   drop table gt.moldura_paquete;  y volver gt.movimientos a sql/gt_v124_movimientos_vivo.sql

-- D6: el Porta Cubo arma con los aros Bco P chicos
insert into gt.receta_aro (producto, pieza, aro, cant, nota) values
  ('814', '10*15', '066', 1, 'Thomas 01/10: el Porta Cubo usa los aros 3P 3/4 Bco P chicos (se cortan cubo)'),
  ('815', '13*18', '067', 1, 'Thomas 01/10: el Porta Cubo usa los aros 3P 3/4 Bco P chicos (se cortan cubo)'),
  ('816', '15*21', '068', 1, 'Thomas 01/10: el Porta Cubo usa los aros 3P 3/4 Bco P chicos (se cortan cubo)');

-- D8: Pintado cuenta paquetes
update gt.rubros set unidad = 'paquetes', pide_cantidad = true where codigo = 'PINT';

-- cuántos metros trae un paquete de cada moldura (vacía hasta que Thomas pase los números)
create table if not exists gt.moldura_paquete (
  moldura            text primary key,     -- como en gt.molduras: 03, 05, 012, 3P 1/2, 3P 3/4, 045, Trav 20mm
  metros_por_paquete numeric not null check (metros_por_paquete > 0),
  nota               text
);
alter table gt.moldura_paquete enable row level security;
revoke all on gt.moldura_paquete from anon, authenticated;

-- gt.movimientos: sobre la definición VIVA (1.24) + Pintado. Parche por texto: falla si no matchea.
do $mov$
declare v text := pg_get_viewdef('gt.movimientos'::regclass, true); n text;
begin
  if v like '%moldura_pintada%' then return; end if;            -- ya aplicado
  n := replace(v, E'WHERE r.area = ''LIJA''::text\n        )\n SELECT registro_id,',
    E'WHERE r.area = ''LIJA''::text\n' ||
    E'        UNION ALL\n         SELECT r.registro_id, r.ts, r.dia, r.empleado_id, r.planta, r.area, ''moldura_pintada''::text, r.texto, gt.detalle_txt(r.detalle), r.cantidad, ''ok''::text, NULL::text\n           FROM r\n          WHERE r.area = ''PINT''::text\n' ||
    E'        UNION ALL\n         SELECT r.registro_id, r.ts, r.dia, r.empleado_id, r.planta, r.area, ''moldura_lijada''::text, r.texto, ''sin anilina''::text,\n            - (r.cantidad * COALESCE(mp.metros_por_paquete, 0::numeric)),\n            CASE WHEN mp.metros_por_paquete IS NULL THEN ''sin receta''::text ELSE ''ok''::text END,\n            CASE WHEN mp.metros_por_paquete IS NULL THEN (''falta cuántos metros trae un paquete de moldura ''::text || r.texto) ELSE NULL::text END\n           FROM r\n             LEFT JOIN gt.moldura_paquete mp ON mp.moldura = r.texto\n          WHERE r.area = ''PINT''::text\n' ||
    E'        )\n SELECT registro_id,');
  if n = v then raise exception 'gt.movimientos: no matcheó el final de mov'; end if;
  execute 'create or replace view gt.movimientos with (security_invoker = true) as ' || n;
end $mov$;
revoke all on gt.movimientos from anon, authenticated;

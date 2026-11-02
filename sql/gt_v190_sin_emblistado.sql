-- gt_v190 (02/11/2026, Angely: D23/D26): ya aplicada en la base. «222, 661, 662 y 220 no se emblistan».
-- Hasta hoy gt.movimientos restaba de Emblistado en CADA Contraído. Esos 4 códigos no pasan por Emblistado, así que cada Contraído
-- suyo dejaba el stock de Emblistado en negativo (661 -18 y 662 -7 el 08/10, 220 y 222 -4 el 26/10; el conteo del 29/10 los puso en 0).
-- Cambio: gt.codigos.sin_emblistado (boolean, falso por defecto), verdadero en 220, 222, 661 y 662, y la rama «Contraído resta Emblistado»
-- de gt.movimientos agrega AND NOT rp.sin_embl. El Contraído de esos códigos sigue sumando Contraído, descontando FILM y caja armada.
-- Si otro código tampoco se emblista: UPDATE gt.codigos SET sin_emblistado = true WHERE codigo = '...';  (no hace falta tocar la vista).
-- Resultado medido: 2.692 -> 2.688 movimientos (salen los 4 de Emblistado), stock de Emblistado de los 4 = 0, security_invoker conservado.
-- Para deshacer: UPDATE gt.codigos SET sin_emblistado = false (los 4) y volver a crear la vista sin «AND NOT rp.sin_embl»
-- (la columna se queda: DROP COLUMN pide confirmar). Sentencia única y auto-verificada: si un control falla, se deshace todo.
do $d23$
declare
  v text; n int; antes bigint; despues bigint;
  a1 text := 'c.medida AS medida_prod,';
  b1 text := 'c.medida AS medida_prod, COALESCE(c.sin_emblistado, false) AS sin_embl,';
  a2 text := 'FROM rp WHERE rp.area = ''CONTR''::text UNION ALL SELECT rp.registro_id, rp.ts, rp.dia, rp.empleado_id, rp.planta, rp.area, CASE WHEN';
  b2 text := 'FROM rp WHERE rp.area = ''CONTR''::text AND NOT rp.sin_embl UNION ALL SELECT rp.registro_id, rp.ts, rp.dia, rp.empleado_id, rp.planta, rp.area, CASE WHEN';
begin
  select count(*) into antes from gt.movimientos;
  alter table gt.codigos add column sin_emblistado boolean not null default false;
  update gt.codigos set sin_emblistado = true where codigo in ('222','220','661','662');
  get diagnostics n = row_count;
  if n <> 4 then raise exception 'se esperaban 4 códigos y son %', n; end if;
  v := regexp_replace(pg_get_viewdef('gt.movimientos'::regclass, true), '\s+', ' ', 'g');
  if (length(v) - length(replace(v, a1, ''))) / length(a1) <> 1
     or (length(v) - length(replace(v, a2, ''))) / length(a2) <> 1 then
    raise exception 'el ancla no aparece exactamente una vez en la vista viva';
  end if;
  execute 'create or replace view gt.movimientos with (security_invoker = true) as ' || replace(replace(v, a1, b1), a2, b2);
  select count(*) into despues from gt.movimientos;
  if antes - despues <> 4 then raise exception 'filas antes % y después %: tenían que bajar 4', antes, despues; end if;
  if exists (select 1 from gt.movimientos where deposito = 'emblistado' and area = 'CONTR' and codigo in ('222','220','661','662')) then
    raise exception 'quedaron filas de Emblistado de esos 4 códigos';
  end if;
end $d23$;

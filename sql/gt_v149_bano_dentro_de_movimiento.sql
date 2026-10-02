-- GT gt_v149 (Elías, 02/10/2026: «y dentro de movimiento también puede ir al baño»).
-- Con Baño DENTRO de un Movimiento que a su vez está dentro de Corte, la pausa a descontarle a Corte es el movimiento
-- entero: el baño ya está adentro. gt_admin_ritmo2 sumaba todas las pausas del tramo y ese baño se restaba dos veces.
-- Ahora sólo cuentan las pausas que no están dentro de otra pausa del mismo tramo. Se parchea la definición VIVA.
-- Ej. probado: Corte 12:00–12:30, Movimiento 12:05–12:25, Baño 12:10–12:15 → Corte neto 10 min (no 5).
-- ROLLBACK: volver a la definición de sql/gt_v147_ingreso_primer_productivo.sql.
do $parche$
declare v text := pg_get_functiondef('public.gt_admin_ritmo2(text,date)'::regprocedure);
  viejo text := 'and p.ts_inicio >= c.ts_inicio and p.ts_cliente <= c.ts_cliente) pz on true';
  nuevo text := 'and p.ts_inicio >= c.ts_inicio and p.ts_cliente <= c.ts_cliente
                            -- gt_v149: una pausa dentro de otra (baño dentro de un movimiento) no se resta dos veces
                            and not exists (select 1 from gt.registros q join gt.rubros qr on qr.codigo = q.rubro and not qr.productivo
                                             where q.empleado_id = p.empleado_id and q.opcion = ''AREA'' and q.ts_inicio is not null
                                               and q.id <> p.id and q.ts_inicio <= p.ts_inicio and q.ts_cliente >= p.ts_cliente
                                               and q.ts_inicio >= c.ts_inicio and q.ts_cliente <= c.ts_cliente)) pz on true';
begin
  if position(viejo in v) = 0 then raise exception 'gt_admin_ritmo2 no tiene la parte de gt_v147: revisar a mano'; end if;
  execute replace(v, viejo, nuevo);
end $parche$;

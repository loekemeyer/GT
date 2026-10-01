-- GT — D12 / D13 (Thomas, 01/10/2026): los pedidos de la página de Tierra Nativa entran solos a gt.pedidos.
--   gt_v136_tn_fdw_lado_gestion (aplicada antes): servidor tn_db + schema gt_tn con las 48 tablas de TN (sólo lectura).
--   gt.sync_pedidos_tn(): copia a gt.pedidos / gt.pedido_items todo pedido de TN desde gt.config.pedidos_tn_desde que
--   no esté todavía, le asigna la NP «TN 0001, 0002…» en orden de llegada (con lock, sin huecos), y marca cancelado
--   lo que la página cancele (si acá no salió todavía). Lo que ya está acá NO se pisa: el estado lo mueve GT.
--   ⚠ Renglones que la página borre después de cargado el pedido no se sacan (no hay DELETE): se avisa a mano.
--   Cron gt-sync-pedidos-tn cada 10 min (minutos 4, 14, 24…: fuera del :00). Cada corrida abre una conexión a TN (~2,4 s).
--   Medido al 01/10: 24 pedidos en la página, todos «pendiente», del 01/04 al 09/09. Con el corte en 2026-09-01 entran
--   2 (TN 0001 = pedido 29 Huang Chun Chieh, TN 0002 = pedido 30 Bazares y Mas). Los 22 anteriores: D28.
-- Rollback (SQL Editor): select cron.unschedule('gt-sync-pedidos-tn'); drop function gt.sync_pedidos_tn();
--   delete from gt.pedido_items; delete from gt.pedidos where origen = 'tn';  update gt.config … pedidos_tn_desde.

insert into gt.config (clave, valor) values ('pedidos_tn_desde', '2026-09-01') on conflict (clave) do nothing;

create or replace function gt.sync_pedidos_tn()
returns table (nuevos int, renglones int, cancelados int, desde date)
language plpgsql security definer set search_path = ''
as $f$
declare
  v_desde  date := coalesce((select c.valor from gt.config c where c.clave = 'pedidos_tn_desde'), '2026-09-01')::date;
  v_nuevos int := 0; v_items int := 0; v_canc int := 0; v_n int;
  o record; v_np int; v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('gt_sync_pedidos_tn'));
  -- 1) pedidos nuevos, en orden de llegada (la NP sigue ese orden)
  for o in
    select p.id, p.created_at, p.status, c.cod_cliente, c.business_name
      from gt_tn.orders p left join gt_tn.customers c on c.id = p.customer_id
     where p.created_at >= v_desde
       and p.status !~* 'cancel'
       and not exists (select 1 from gt.pedidos g where g.origen = 'tn' and g.pedido_ref = p.id::text)
     order by p.created_at, p.id
  loop
    select coalesce(max(substring(g.np from 4)::int), 0) + 1 into v_np from gt.pedidos g where g.np ~ '^TN [0-9]+$';
    insert into gt.pedidos (origen, pedido_ref, np, cliente_cod, cliente, fecha, estado)
    values ('tn', o.id::text, 'TN ' || lpad(v_np::text, 4, '0'), o.cod_cliente::text, o.business_name, o.created_at, 'abierto')
    returning id into v_id;
    insert into gt.pedido_items (pedido_id, codigo, cajas)
    select v_id, pr.cod, sum(i.cajas)
      from gt_tn.order_items i join gt_tn.products pr on pr.id = i.product_id
     where i.order_id = o.id and i.cajas > 0
     group by pr.cod;
    get diagnostics v_n = row_count;
    v_items := v_items + v_n;
    v_nuevos := v_nuevos + 1;
  end loop;
  -- 2) lo que la página cancela se cancela acá, si todavía no salió
  update gt.pedidos g
     set estado = 'cancelado', actualizado_en = now(), nota = concat_ws(' · ', g.nota, 'cancelado en la página')
    from gt_tn.orders p
   where g.origen = 'tn' and g.pedido_ref = p.id::text and p.status ~* 'cancel'
     and g.estado in ('abierto', 'parcial', 'armado');
  get diagnostics v_canc = row_count;
  return query select v_nuevos, v_items, v_canc, v_desde;
end
$f$;
revoke all on function gt.sync_pedidos_tn() from public, anon, authenticated;

select cron.schedule('gt-sync-pedidos-tn', '4-59/10 * * * *', $$select gt.sync_pedidos_tn()$$);

-- Chequeos:
--   select * from gt.sync_pedidos_tn();                       -- qué entró en esta corrida
--   select np, pedido_ref, cliente, fecha::date, estado from gt.pedidos order by np;
--   select * from gt.pedidos_plazo;  select * from gt.demanda_producto;
--   select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'gt-sync-pedidos-tn') order by start_time desc limit 5;

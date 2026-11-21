-- gt_v194 (2/2) — migración de los datos y las dos funciones vivas que numeraban o nombraban la NP (21/11/2026)
-- Antes de esto: backup en zz_backups.gt_ppp_a_programar_v194 / gt_pedidos_v194 / gt_pedido_items_v194 / gt_ppp_entregado_v194.
-- Definiciones VIVAS traídas con pg_get_functiondef el 21/11 antes de reescribirlas.

-- 1) cada fila de la Programación (37, todas con NP de ISIS) pasa a ser un pedido de GT: NP TN 0004…, en orden de llegada.
--    La NP de ISIS queda en np_isis (en el pedido y en la Programación). Sin renglones: el Excel de TN no los traía.
do $m$
declare r record; v_np text; v_id bigint;
begin
  for r in select * from gt.ppp_a_programar where pedido_id is null order by fecha_recep nulls last, np, id loop
    v_np := gt.pedido_np_siguiente();
    insert into gt.pedidos (origen, pedido_ref, np, cliente_cod, cliente, fecha, es_super, estado, nota, oc, np_isis, isis_cargado_en, isis_por)
    values ('isis', r.np::text, v_np, r.cod::text, r.cliente,
            coalesce(r.fecha_recep::timestamp at time zone 'America/Argentina/Buenos_Aires', r.importado_at),
            coalesce(r.cliente, '') ~* 'cencosud|coto|la an[oó]nima|\minc\M',
            case r.estado when 'entregado' then 'entregado' when 'anulado' then 'cancelado' else 'abierto' end,
            'Migrado de la Programación (venía de ISIS, NP ' || r.np || ') el 21/11/2026', r.oc, r.np, r.importado_at, 'migración gt_v194')
    returning id into v_id;
    update gt.ppp_a_programar a set pedido_id = v_id, np_isis = r.np, np = g.np_num
      from gt.pedidos g where g.id = v_id and a.id = r.id;
  end loop;
end $m$;

-- 2) los pedidos de la página de TN que siguen abiertos entran a A Programar (hoy: TN 0003).
select gt.pedido_a_programar(p.id)
  from gt.pedidos p
 where p.origen = 'tn' and p.estado in ('abierto', 'parcial', 'armado')
   and not exists (select 1 from gt.ppp_a_programar a where a.pedido_id = p.id);

-- 3) la sincronización con la página de TN numera con la serie única y le crea la fila de A Programar al pedido nuevo.
CREATE OR REPLACE FUNCTION gt.sync_pedidos_tn()
 RETURNS TABLE(nuevos integer, renglones integer, cancelados integer, desde date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_desde  date := coalesce((select c.valor from gt.config c where c.clave = 'pedidos_tn_desde'), '2026-09-01')::date;
  v_nuevos int := 0; v_items int := 0; v_canc int := 0; v_n int;
  o record; v_np text; v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('gt_sync_pedidos_tn'));
  -- 1) pedidos nuevos, en orden de llegada (la NP sigue ese orden). gt_v194: la NP sale de la serie única de GT
  --    (gt.pedido_np_siguiente, la misma del alta manual y del PDF Krikos) y el pedido entra solo a A Programar.
  for o in
    select p.id, p.created_at, p.status, c.cod_cliente, c.business_name
      from gt_tn.orders p left join gt_tn.customers c on c.id = p.customer_id
     where p.created_at >= v_desde
       and p.status !~* 'cancel'
       and not exists (select 1 from gt.pedidos g where g.origen = 'tn' and g.pedido_ref = p.id::text)
     order by p.created_at, p.id
  loop
    v_np := gt.pedido_np_siguiente();
    insert into gt.pedidos (origen, pedido_ref, np, cliente_cod, cliente, fecha, estado)
    values ('tn', o.id::text, v_np, o.cod_cliente::text, o.business_name, o.created_at, 'abierto')
    returning id into v_id;
    insert into gt.pedido_items (pedido_id, codigo, cajas)
    select v_id, pr.cod, sum(i.cajas)
      from gt_tn.order_items i join gt_tn.products pr on pr.id = i.product_id
     where i.order_id = o.id and i.cajas > 0
     group by pr.cod;
    get diagnostics v_n = row_count;
    v_items := v_items + v_n;
    v_nuevos := v_nuevos + 1;
    perform gt.pedido_a_programar(v_id);
  end loop;
  -- 2) lo que la página cancela se cancela acá, si todavía no salió (el trigger zz_pedido_estado_a_ppp anula su programación)
  update gt.pedidos g
     set estado = 'cancelado', actualizado_en = now(), nota = concat_ws(' · ', g.nota, 'cancelado en la página')
    from gt_tn.orders p
   where g.origen = 'tn' and g.pedido_ref = p.id::text and p.status ~* 'cancel'
     and g.estado in ('abierto', 'parcial', 'armado');
  get diagnostics v_canc = row_count;
  return query select v_nuevos, v_items, v_canc, v_desde;
end
$function$;

-- 4) la tarea de Gabriel nombra la NP de GT (y la de ISIS si ya la tiene) y le dice dónde está la planilla para ISIS.
CREATE OR REPLACE FUNCTION gt.ppp_fact_tarea_sync(p_dia text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_dia date; v_n int; v_lista text; v_task bigint; v_done boolean; v_nombre text; v_nota text;
  v_url constant text := 'https://claude.ai/code/session_01SbdwGigV9g782wM4GRehDg';
begin
  if p_dia is null or p_dia !~ '^\d{4}-\d{2}-\d{2}' then return; end if;
  v_dia := left(p_dia, 10)::date;
  -- gt_v194: la NP es la de GT (TN 0004), y si ya se cargó en ISIS se agrega su número
  select count(*), string_agg('NP ' || case when pedido_id is not null then gt.np_txt(np) else np::text end ||
           coalesce(' ISIS ' || np_isis, '') || ' ' || coalesce(split_part(btrim(cliente), ' ', 1), '') ||
           ' (' || gt.ppp_camion_de(camion, cliente, barrio) || ')', ', ' order by np)
    into v_n, v_lista
    from gt.ppp_a_programar where estado = 'programado' and lista_en is not null and left(entrega_retira, 10) = p_dia;
  select t.task_id, k.done into v_task, v_done from gt.ppp_fact_tarea t left join planify.tasks k on k.id = t.task_id where t.dia = v_dia;
  if v_n = 0 then
    if v_task is not null and not coalesce(v_done, true) then
      update planify.tasks set done = true, updated_at = now(),
        note = 'Ya hecho: las NP del ' || to_char(v_dia, 'DD/MM') || ' que Javier marcó listas ya se entregaron (o se quitaron). Pedido de Tomás Beviglia · cargada por GT (marca de Javier en el celular), sesión ' || v_url
       where id = v_task;
    end if;
    return;
  end if;
  v_nombre := left('GT a facturar ' || to_char(v_dia, 'DD/MM') || ': ' || v_n || ' NP lista' || case when v_n > 1 then 's' else '' end, 60);
  v_nota := 'Falta: cargar en ISIS y facturar para la entrega del ' || to_char(v_dia, 'DD/MM') || ' ' || v_lista ||
            '. Javier las marcó armadas en el celular. El pedido nace en GT: la planilla con los renglones sale del admin de GT (PPP · Programación · tildar · Planilla ISIS) y el número que da ISIS se anota con el botón ISIS de cada NP. Pedido de Tomás Beviglia · cargada por GT (marca de Javier en el celular), sesión ' || v_url;
  if v_task is null or v_done is null then
    insert into planify.tasks (name, type, prio, time, date, note, rec, done, assignment_type, employee_id, department_id,
                               system_generated, broadcast, created_at, updated_at)
    values (v_nombre, 'tarea', 'normal', '09:00', to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD'),
            v_nota, 'none', false, 'employee', 72, null, false, false, now(), now())
    returning id into v_task;
    insert into gt.ppp_fact_tarea (dia, task_id) values (v_dia, v_task)
      on conflict (dia) do update set task_id = excluded.task_id, creado_en = now();
  else
    update planify.tasks set name = v_nombre, note = v_nota, done = false, updated_at = now() where id = v_task;
  end if;
end $function$;

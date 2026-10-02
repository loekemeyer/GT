-- GT — D29 (Thomas, 01/10/2026: «por ahora solo desde el admin»): el armado pedido por pedido se lleva desde admin.html,
-- pestaña 📦 Pedidos. El operario no lo toca (el área Pedidos del celular sigue sin pedir nada).
--   gt_admin_pedidos(pass, cerrados)      → los pedidos abiertos / parciales / armados / cargados con sus renglones (jsonb);
--                                            con p_cerrados también los entregados y cancelados de los últimos 30 días.
--   gt_admin_pedido_armar(pass, id, items, estado, nota)
--                                         → guarda las cajas armadas por renglón (0..pedidas) y recalcula el estado:
--                                            0 armadas = abierto · algunas = parcial · todas = armado. Con p_estado fuerza
--                                            cargado (necesita cajas armadas), entregado (sólo desde cargado) o cancelado.
--                                            Un pedido cargado / entregado / cancelado no deja tocar el armado.
--   Las dos exigen la clave del monitor (gt.pass_ok): con clave mala, lista vacía / {ok:false}. Como las otras del admin,
--   las llama la página con la clave pública: por eso siguen ejecutables para anon (la clave va adentro).
--   ⚠ No mueve stock: el movimiento góndola → pedido queda para cuando el stock esté vivo (stock_pedidos_activo).
-- Rollback (SQL Editor): drop function public.gt_admin_pedidos(text, boolean), public.gt_admin_pedido_armar(text, bigint, jsonb, text, text);

create or replace function public.gt_admin_pedidos(p_pass text, p_cerrados boolean default false)
returns table (id bigint, np text, pedido_ref text, cliente_cod text, cliente text, fecha timestamptz, dias integer, vence date,
               vencido boolean, estado text, es_super boolean, cajas numeric, armadas numeric, pct_armado numeric, nota text,
               actualizado_en timestamptz, items jsonb)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.np, p.pedido_ref, p.cliente_cod, p.cliente, p.fecha,
         ((now() at time zone 'America/Argentina/Buenos_Aires')::date - (p.fecha at time zone 'America/Argentina/Buenos_Aires')::date)::int,
         (p.fecha at time zone 'America/Argentina/Buenos_Aires')::date + p.plazo_dias,
         now() > p.fecha + make_interval(days => p.plazo_dias) and p.estado in ('abierto', 'parcial', 'armado'),
         p.estado, p.es_super,
         coalesce(it.cajas, 0), coalesce(it.armadas, 0), round(100 * coalesce(it.armadas, 0) / nullif(it.cajas, 0)),
         p.nota, p.actualizado_en, coalesce(it.items, '[]'::jsonb)
    from gt.pedidos p
    left join lateral (
      select sum(i.cajas) as cajas, sum(i.cajas_armadas) as armadas,
             jsonb_agg(jsonb_build_object('codigo', i.codigo, 'descripcion', c.descripcion, 'medida', c.medida, 'uxb', c.uxb,
                                          'cajas', i.cajas, 'cajas_armadas', i.cajas_armadas) order by i.codigo) as items
        from gt.pedido_items i left join gt.codigos c on c.codigo = i.codigo
       where i.pedido_id = p.id) it on true
   where gt.pass_ok(p_pass)
     and (p.estado in ('abierto', 'parcial', 'armado', 'cargado')
          or (p_cerrados and p.estado in ('entregado', 'cancelado') and p.actualizado_en >= now() - interval '30 days'))
   order by case p.estado when 'abierto' then 1 when 'parcial' then 1 when 'armado' then 2 when 'cargado' then 3 else 4 end, p.fecha;
$$;

create or replace function public.gt_admin_pedido_armar(p_pass text, p_pedido_id bigint, p_items jsonb default null,
                                                        p_estado text default null, p_nota text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_est text; v_new text; v_cajas numeric; v_arm numeric; r record; v_n int := 0;
begin
  if not gt.pass_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'clave'); end if;
  select estado into v_est from gt.pedidos where id = p_pedido_id for update;
  if v_est is null then return jsonb_build_object('ok', false, 'error', 'no existe el pedido'); end if;
  if p_items is not null and jsonb_typeof(p_items) = 'array' and jsonb_array_length(p_items) > 0 then
    if v_est not in ('abierto', 'parcial', 'armado') then
      return jsonb_build_object('ok', false, 'error', 'el pedido ya está ' || v_est || ': no se cambia el armado');
    end if;
    for r in select x.codigo, x.cajas_armadas from jsonb_to_recordset(p_items) as x(codigo text, cajas_armadas numeric) loop
      update gt.pedido_items i set cajas_armadas = least(greatest(coalesce(r.cajas_armadas, 0), 0), i.cajas)
       where i.pedido_id = p_pedido_id and i.codigo = r.codigo;
      v_n := v_n + 1;
    end loop;
  end if;
  select coalesce(sum(cajas), 0), coalesce(sum(cajas_armadas), 0) into v_cajas, v_arm from gt.pedido_items where pedido_id = p_pedido_id;
  if p_estado is not null then
    if p_estado not in ('abierto', 'parcial', 'armado', 'cargado', 'entregado', 'cancelado') then
      return jsonb_build_object('ok', false, 'error', 'estado inválido');
    end if;
    if p_estado = 'cargado' and v_est not in ('abierto', 'parcial', 'armado') then return jsonb_build_object('ok', false, 'error', 'ya está ' || v_est); end if;
    if p_estado = 'cargado' and v_arm <= 0 then return jsonb_build_object('ok', false, 'error', 'no hay cajas armadas para cargar'); end if;
    if p_estado = 'entregado' and v_est <> 'cargado' then return jsonb_build_object('ok', false, 'error', 'primero se carga el camión'); end if;
    if p_estado = 'cancelado' and v_est = 'entregado' then return jsonb_build_object('ok', false, 'error', 'ya se entregó'); end if;
    if p_estado in ('abierto', 'parcial', 'armado') then   -- volver atrás (de cargado a abierto, por ejemplo): manda lo armado
      v_new := case when v_arm <= 0 then 'abierto' when v_arm < v_cajas then 'parcial' else 'armado' end;
    else v_new := p_estado; end if;
  elsif v_est in ('abierto', 'parcial', 'armado') then
    v_new := case when v_arm <= 0 then 'abierto' when v_arm < v_cajas then 'parcial' else 'armado' end;
  else v_new := v_est; end if;
  update gt.pedidos set estado = v_new, nota = coalesce(p_nota, nota), actualizado_en = now() where id = p_pedido_id;
  return jsonb_build_object('ok', true, 'estado', v_new, 'cajas', v_cajas, 'armadas', v_arm, 'renglones', v_n);
end
$$;

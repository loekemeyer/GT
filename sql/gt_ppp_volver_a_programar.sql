-- PPP · Programación → A Programar: devolver pedidos programados a A Programar (saca la fecha). Tomás G, 05/11/2026.
-- YA APLICADO en hrxfctzncixxqmpfhskv. Complementa gt_admin_ppp_programar (A Programar → Programación / mover de día).

create or replace function public.gt_admin_ppp_a_aprogramar(p_pass text, p_ids bigint[])
returns integer language plpgsql security definer set search_path to '' as $$
declare n integer;
begin
  if not gt.pass_ok(p_pass) then raise exception 'sin permiso'; end if;
  if p_ids is null or array_length(p_ids,1) is null then return 0; end if;
  update gt.ppp_a_programar set estado='a_programar', entrega_retira = null
   where id = any(p_ids);
  get diagnostics n = row_count; return n;
end; $$;

grant execute on function public.gt_admin_ppp_a_aprogramar(text,bigint[]) to anon, authenticated;

-- PPP: mover notas entre estados SIN fecha (a_programar / retenido / cliente_nuevo). Tomás G, 06/11/2026. YA APLICADO.
-- No toca entrega_retira (conserva el vto). Para programar con día va gt_admin_ppp_programar.
create or replace function public.gt_admin_ppp_set_estado(p_pass text, p_ids bigint[], p_estado text)
returns integer language plpgsql security definer set search_path to '' as $$
declare n integer;
begin
  if not gt.pass_ok(p_pass) then raise exception 'sin permiso'; end if;
  if p_estado not in ('a_programar','retenido','cliente_nuevo') then raise exception 'estado invalido'; end if;
  if p_ids is null or array_length(p_ids,1) is null then return 0; end if;
  update gt.ppp_a_programar set estado = p_estado where id = any(p_ids);
  get diagnostics n = row_count; return n;
end; $$;
grant execute on function public.gt_admin_ppp_set_estado(text,bigint[],text) to anon, authenticated;

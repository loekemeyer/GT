-- PPP: anular pedidos de A Programar (estado='anulado'; reversible, no se borra). Tomás G, 11/11/2026. YA APLICADO.
create or replace function public.gt_admin_ppp_anular(p_pass text, p_ids bigint[])
returns integer language plpgsql security definer set search_path to '' as $$
declare n integer;
begin
  if not gt.pass_ok(p_pass) then raise exception 'sin permiso'; end if;
  if p_ids is null or array_length(p_ids,1) is null then return 0; end if;
  update gt.ppp_a_programar set estado='anulado' where id = any(p_ids);
  get diagnostics n = row_count; return n;
end; $$;
grant execute on function public.gt_admin_ppp_anular(text,bigint[]) to anon, authenticated;

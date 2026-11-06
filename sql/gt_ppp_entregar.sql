-- PPP: Programación → Entregados. Inserta en gt.ppp_entregado (fuente='programacion') y marca la nota
-- como entregada (estado='entregado', reversible: no se borra de gt.ppp_a_programar). Tomás G, 06/11/2026. YA APLICADO.
create or replace function public.gt_admin_ppp_entregar(p_pass text, p_ids bigint[])
returns integer language plpgsql security definer set search_path to '' as $$
declare n integer;
begin
  if not gt.pass_ok(p_pass) then raise exception 'sin permiso'; end if;
  if p_ids is null or array_length(p_ids,1) is null then return 0; end if;
  insert into gt.ppp_entregado (np, fecha_arribo, cod, cliente, kg, m3, localidad_expreso, direccion,
                                op, lugar_entrega, fecha_entrega, observacion, oc, fuente, importado_at)
    select np::text, fecha_recep, cod, cliente, kg, m3, barrio, dir_entrega,
           op, barrio, entrega_retira, comentario, oc, 'programacion', now()
      from gt.ppp_a_programar where id = any(p_ids) and estado='programado';
  update gt.ppp_a_programar set estado='entregado' where id = any(p_ids) and estado='programado';
  get diagnostics n = row_count; return n;
end; $$;
grant execute on function public.gt_admin_ppp_entregar(text,bigint[]) to anon, authenticated;

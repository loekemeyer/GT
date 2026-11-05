-- PPP · A Programar → Programación (como GV): seleccionar pedidos y enviarlos con un día. Tomás G, 05/11/2026.
-- YA APLICADO en hrxfctzncixxqmpfhskv. El connector no deja cambiar el retorno de la v1 → lectura con sufijo 2.

-- Lectura v2 de A Programar (devuelve id, para poder seleccionar).
create or replace function public.gt_admin_ppp_a_programar2(p_pass text)
returns table(id bigint, np integer, fecha_recep date, cod integer, cliente text, kg numeric, m3 numeric,
              vend text, dir_entrega text, barrio text, op text, entrega_retira text, rent text, oc text, aviso text, bloque text)
language sql stable security definer set search_path to '' as $$
  select id,np,fecha_recep,cod,cliente,kg,m3,vend,dir_entrega,barrio,op,entrega_retira,rent,oc,aviso,bloque
    from gt.ppp_a_programar where gt.pass_ok(p_pass) and estado='a_programar' order by fecha_recep nulls last, np; $$;

-- Enviar/Mover: setea estado='programado' + la fecha elegida para los ids dados. Sirve para ENVIAR (A Programar -> Programación)
-- y para MOVER DE DÍA un ya programado (sin filtrar por estado). Tomás G, 05/11/2026.
create or replace function public.gt_admin_ppp_programar(p_pass text, p_ids bigint[], p_fecha date)
returns integer language plpgsql security definer set search_path to '' as $$
declare n integer;
begin
  if not gt.pass_ok(p_pass) then raise exception 'sin permiso'; end if;
  if p_fecha is null then raise exception 'falta la fecha'; end if;
  if p_ids is null or array_length(p_ids,1) is null then return 0; end if;
  update gt.ppp_a_programar set estado='programado', entrega_retira = to_char(p_fecha,'YYYY-MM-DD')
   where id = any(p_ids);
  get diagnostics n = row_count; return n;
end; $$;

grant execute on function public.gt_admin_ppp_a_programar2(text) to anon, authenticated;
grant execute on function public.gt_admin_ppp_programar(text,bigint[],date) to anon, authenticated;

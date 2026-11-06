-- PPP: comentario manual por pedido (ícono a la derecha de la card en A Programar). Tomás G, 06/11/2026. YA APLICADO.
alter table gt.ppp_a_programar add column if not exists comentario text;

create or replace function public.gt_admin_ppp_set_comentario(p_pass text, p_id bigint, p_texto text)
returns text language plpgsql security definer set search_path to '' as $$
begin
  if not gt.pass_ok(p_pass) then raise exception 'sin permiso'; end if;
  update gt.ppp_a_programar set comentario = nullif(btrim(coalesce(p_texto,'')),'') where id = p_id;
  return (select comentario from gt.ppp_a_programar where id = p_id);
end; $$;

-- v5 de A Programar: suma comentario (ver gt_ppp_enviar_a_programacion.sql para v2..v4).
create or replace function public.gt_admin_ppp_a_programar5(p_pass text)
returns table(id bigint, np integer, fecha_recep date, cod integer, cliente text, kg numeric, m3 numeric,
              vend text, dir_entrega text, barrio text, op text, entrega_retira text, rent text, oc text, aviso text, bloque text,
              fc_cotizador text, fc_pct_facturado numeric, estado text, comentario text)
language sql stable security definer set search_path to '' as $$
  select id,np,fecha_recep,cod,cliente,kg,m3,vend,dir_entrega,barrio,op,entrega_retira,rent,oc,aviso,bloque,fc_cotizador,fc_pct_facturado,estado,comentario
    from gt.ppp_a_programar
   where gt.pass_ok(p_pass) and estado in ('a_programar','retenido','cliente_nuevo')
   order by fecha_recep nulls last, np; $$;

grant execute on function public.gt_admin_ppp_set_comentario(text,bigint,text) to anon, authenticated;
grant execute on function public.gt_admin_ppp_a_programar5(text) to anon, authenticated;

-- v4 de Programación: suma comentario (mismo ícono también en Programación). Tomás G, 06/11/2026. YA APLICADO.
create or replace function public.gt_admin_ppp_programacion4(p_pass text)
returns table(id bigint, np integer, fecha_recep date, cod integer, cliente text, kg numeric, m3 numeric,
              vend text, dir_entrega text, barrio text, op text, entrega_retira text, rent text, oc text, aviso text, bloque text,
              fc_cotizador text, fc_pct_facturado numeric, comentario text)
language sql stable security definer set search_path to '' as $$
  select id,np,fecha_recep,cod,cliente,kg,m3,vend,dir_entrega,barrio,op,entrega_retira,rent,oc,aviso,bloque,fc_cotizador,fc_pct_facturado,comentario
    from gt.ppp_a_programar where gt.pass_ok(p_pass) and estado='programado' order by entrega_retira nulls last, np; $$;
grant execute on function public.gt_admin_ppp_programacion4(text) to anon, authenticated;

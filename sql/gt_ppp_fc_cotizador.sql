-- PPP · Programación — marcador Factura/Cotizador por pedido (sólo clientes comunes). Tomás G, 05/11/2026.
-- YA APLICADO en hrxfctzncixxqmpfhskv. Se marca desde el front (toggle en las cards de comunes de la pestaña Programación).
-- El connector no deja DROP ni cambiar el tipo de retorno de una función, así que la lectura va con sufijo 2 (convención gt_*2/3).

alter table gt.ppp_a_programar add column if not exists fc_cotizador text;
-- constraint: null (sin marcar) | 'factura' | 'cotizador'
do $$ begin
  if not exists (select 1 from pg_constraint where conname='ppp_fc_cotizador_chk') then
    alter table gt.ppp_a_programar add constraint ppp_fc_cotizador_chk
      check (fc_cotizador is null or fc_cotizador in ('factura','cotizador'));
  end if;
end $$;

-- Lectura v2 de Programación: agrega id (para marcar) y fc_cotizador (estado del marcador).
create or replace function public.gt_admin_ppp_programacion2(p_pass text)
returns table(id bigint, np integer, fecha_recep date, cod integer, cliente text, kg numeric, m3 numeric,
              vend text, dir_entrega text, barrio text, op text, entrega_retira text, rent text, oc text, aviso text, bloque text, fc_cotizador text)
language sql stable security definer set search_path to '' as $$
  select id,np,fecha_recep,cod,cliente,kg,m3,vend,dir_entrega,barrio,op,entrega_retira,rent,oc,aviso,bloque,fc_cotizador
    from gt.ppp_a_programar where gt.pass_ok(p_pass) and estado='programado' order by entrega_retira nulls last, np; $$;

-- Escritura del marcador (gateada por la clave del admin). p_valor null = destildar.
create or replace function public.gt_admin_ppp_set_fc(p_pass text, p_id bigint, p_valor text)
returns text language plpgsql security definer set search_path to '' as $$
begin
  if not gt.pass_ok(p_pass) then raise exception 'sin permiso'; end if;
  if p_valor is not null and p_valor not in ('factura','cotizador') then raise exception 'valor invalido'; end if;
  update gt.ppp_a_programar set fc_cotizador = p_valor where id = p_id;
  return p_valor;
end; $$;

grant execute on function public.gt_admin_ppp_programacion2(text) to anon, authenticated;
grant execute on function public.gt_admin_ppp_set_fc(text,bigint,text) to anon, authenticated;

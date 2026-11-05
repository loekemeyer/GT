-- PPP · Programación — tercera opción "Mixto" (parte facturado, parte no) con %. Tomás G, 05/11/2026.
-- YA APLICADO en hrxfctzncixxqmpfhskv. Extiende el marcador Factura/Cotizador (ver gt_ppp_fc_cotizador.sql).

-- fc_cotizador ahora admite 'mixto'; fc_pct_facturado guarda el % facturado (el resto es no facturado).
alter table gt.ppp_a_programar drop constraint if exists ppp_fc_cotizador_chk;
alter table gt.ppp_a_programar add constraint ppp_fc_cotizador_chk
  check (fc_cotizador is null or fc_cotizador in ('factura','cotizador','mixto'));
alter table gt.ppp_a_programar add column if not exists fc_pct_facturado numeric;
alter table gt.ppp_a_programar add constraint ppp_fc_pct_chk
  check (fc_pct_facturado is null or (fc_pct_facturado >= 0 and fc_pct_facturado <= 100));

-- Lectura v3 de Programación: suma fc_pct_facturado.
create or replace function public.gt_admin_ppp_programacion3(p_pass text)
returns table(id bigint, np integer, fecha_recep date, cod integer, cliente text, kg numeric, m3 numeric,
              vend text, dir_entrega text, barrio text, op text, entrega_retira text, rent text, oc text, aviso text, bloque text,
              fc_cotizador text, fc_pct_facturado numeric)
language sql stable security definer set search_path to '' as $$
  select id,np,fecha_recep,cod,cliente,kg,m3,vend,dir_entrega,barrio,op,entrega_retira,rent,oc,aviso,bloque,fc_cotizador,fc_pct_facturado
    from gt.ppp_a_programar where gt.pass_ok(p_pass) and estado='programado' order by entrega_retira nulls last, np; $$;

-- Escritura v2: factura/cotizador/mixto; si es mixto, guarda el % facturado (si no, lo limpia). null = destildar.
create or replace function public.gt_admin_ppp_set_fc2(p_pass text, p_id bigint, p_valor text, p_pct numeric default null)
returns text language plpgsql security definer set search_path to '' as $$
begin
  if not gt.pass_ok(p_pass) then raise exception 'sin permiso'; end if;
  if p_valor is not null and p_valor not in ('factura','cotizador','mixto') then raise exception 'valor invalido'; end if;
  if p_pct is not null and (p_pct < 0 or p_pct > 100) then raise exception 'porcentaje invalido'; end if;
  update gt.ppp_a_programar
     set fc_cotizador = p_valor,
         fc_pct_facturado = case when p_valor = 'mixto' then p_pct else null end
   where id = p_id;
  return p_valor;
end; $$;

grant execute on function public.gt_admin_ppp_programacion3(text) to anon, authenticated;
grant execute on function public.gt_admin_ppp_set_fc2(text,bigint,text,numeric) to anon, authenticated;

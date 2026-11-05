-- PPP · PDF Krikos — crear un pedido en A Programar desde una OC en PDF (Cencosud/Planexware). Tomás G, 05/11/2026.
-- YA APLICADO en hrxfctzncixxqmpfhskv. El parseo (OC, fecha entrega, CD, ítems) lo hace el front con pdf.js; esta RPC sólo inserta.
alter table gt.ppp_a_programar add column if not exists items jsonb;

create or replace function public.gt_admin_ppp_crear_pedido(p_pass text, p_json jsonb)
returns bigint language plpgsql security definer set search_path to '' as $$
declare v_id bigint;
begin
  if not gt.pass_ok(p_pass) then raise exception 'sin permiso'; end if;
  insert into gt.ppp_a_programar (np, fecha_recep, cod, cliente, kg, m3, barrio, entrega_retira, oc, items, estado, fuente, bloque)
  values ( nullif(p_json->>'np','')::integer,
           nullif(p_json->>'fecha_recep','')::date,
           nullif(p_json->>'cod','')::integer,
           p_json->>'cliente',
           nullif(p_json->>'kg','')::numeric,
           nullif(p_json->>'m3','')::numeric,
           p_json->>'barrio',
           nullif(p_json->>'entrega',''),
           nullif(p_json->>'oc',''),
           p_json->'items',
           'a_programar',
           coalesce(nullif(p_json->>'fuente',''),'pdf_krikos'),
           'PDF Krikos' )
  returning id into v_id;
  return v_id;
end; $$;
grant execute on function public.gt_admin_ppp_crear_pedido(text,jsonb) to anon, authenticated;

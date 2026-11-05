-- PPP — separar "A Programar" de "Programación" (Tomás G, 05/11/2026). YA APLICADO en hrxfctzncixxqmpfhskv.
-- La PLANILLA DIARIA de TN tiene 3 secciones: PEDIDOS A PROGRAMAR (arriba, sin fecha de entrega firme),
-- PENDIENTES DE CONFIRMAR (vacía) y PEDIDOS PROGRAMADOS (abajo, con fecha de entrega). El import de Fase 1
-- los había mezclado en gt.ppp_a_programar. Se separa con un campo estado.

alter table gt.ppp_a_programar add column if not exists estado text not null default 'a_programar';
-- Tag por sección (snapshot del Excel): arriba = NP 3922, 3910, 3923; el resto = programados.
update gt.ppp_a_programar set estado = case when np in (3922,3910,3923) then 'a_programar' else 'programado' end;

-- A Programar = estado='a_programar'
create or replace function public.gt_admin_ppp_a_programar(p_pass text)
returns table(np integer, fecha_recep date, cod integer, cliente text, kg numeric, m3 numeric,
              vend text, dir_entrega text, barrio text, op text, entrega_retira text, rent text, oc text, aviso text, bloque text)
language sql stable security definer set search_path to '' as $$
  select np,fecha_recep,cod,cliente,kg,m3,vend,dir_entrega,barrio,op,entrega_retira,rent,oc,aviso,bloque
    from gt.ppp_a_programar where gt.pass_ok(p_pass) and estado='a_programar' order by fecha_recep nulls last, np; $$;

-- Programación = estado='programado', ordenado por fecha de entrega (entrega_retira)
create or replace function public.gt_admin_ppp_programacion(p_pass text)
returns table(np integer, fecha_recep date, cod integer, cliente text, kg numeric, m3 numeric,
              vend text, dir_entrega text, barrio text, op text, entrega_retira text, rent text, oc text, aviso text, bloque text)
language sql stable security definer set search_path to '' as $$
  select np,fecha_recep,cod,cliente,kg,m3,vend,dir_entrega,barrio,op,entrega_retira,rent,oc,aviso,bloque
    from gt.ppp_a_programar where gt.pass_ok(p_pass) and estado='programado' order by entrega_retira nulls last, np; $$;

grant execute on function public.gt_admin_ppp_a_programar(text) to anon, authenticated;
grant execute on function public.gt_admin_ppp_programacion(text) to anon, authenticated;

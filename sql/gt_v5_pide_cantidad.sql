-- GT v5.0 (01/10/2026, Thomas) — aditivo, sin DROP.
-- Un área con pide_cantidad = false se termina sin preguntar cantidad (Pedidos: armar uno puede
-- llevar mucho y no se quiere perder tiempo contando). gt_botones() reemplaza a gt_botonera()
-- porque cambia lo que devuelve (y un DROP no pasa por el conector).
-- Rollback: alter table gt.rubros drop column pide_cantidad; drop function public.gt_botones();

alter table gt.rubros add column if not exists pide_cantidad boolean not null default true;

create or replace function public.gt_botones()
returns table (codigo text, nombre text, unidad text, orden int, pide_codigo boolean, pide_cantidad boolean)
language sql stable security definer set search_path = '' as $$
  select r.codigo, r.nombre, r.unidad, r.orden, r.pide_codigo, r.pide_cantidad
    from gt.rubros r where r.activo order by r.orden, r.codigo;
$$;
revoke all on function public.gt_botones() from public;
grant execute on function public.gt_botones() to anon, authenticated;

-- ---------- DATOS (con el «sí» del dueño) ----------
-- update gt.rubros set pide_cantidad = false where codigo = 'PED';
-- insert into gt.rubros (codigo, nombre, unidad, orden)
--   values ('GUARD', 'Guardado a góndola', 'cajas guardadas', 10) on conflict (codigo) do nothing;

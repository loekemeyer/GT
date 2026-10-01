-- GT v7.0 (01/10/2026) — APLICADO. Códigos propios de un área, clave (rubro, codigo).
-- Rollback: drop table gt.codigos_rubro; y volver gt_codigos_area() a sólo la primera parte del union.
create table if not exists gt.codigos_rubro (
  rubro text not null references gt.rubros(codigo), codigo text not null, descripcion text, medida text,
  activo boolean not null default true, primary key (rubro, codigo));
alter table gt.codigos_rubro enable row level security;
revoke all on gt.codigos_rubro from anon, authenticated;

create or replace function public.gt_codigos_area()
returns table (codigo text, descripcion text, medida text, rubro text)
language sql stable security definer set search_path = '' as $$
  select c.codigo, c.descripcion, c.medida, a.rubro
    from gt.codigos c join gt.codigo_area a on a.codigo = c.codigo where c.activo
  union all
  select k.codigo, k.descripcion, k.medida, k.rubro from gt.codigos_rubro k where k.activo
  order by 4, 1;
$$;

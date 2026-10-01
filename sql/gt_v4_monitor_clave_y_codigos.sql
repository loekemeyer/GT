-- GT v4.0 (01/10/2026, Thomas) — aditivo, sin DROP.
-- 1) El monitor pide una CLAVE: la valida la base (public.gt_monitor_clave), guardada cifrada (bcrypt)
--    en gt.config, que anon no puede leer. La clave NO va en el repo.
-- 2) Un área puede pedir CÓDIGO al empezar (gt.rubros.pide_codigo; hoy Grampeado).
--    gt.codigos: si tiene filas, el código tiene que estar ahí (del área o sin área); vacía, se acepta cualquiera.
-- Rollback: alter table gt.rubros drop column pide_codigo; drop table gt.config, gt.codigos;
--           drop function public.gt_botonera(), public.gt_codigos(), public.gt_monitor_clave(text);
--           grant execute on function public.gt_clave_actual() to anon, authenticated;

alter table gt.rubros add column if not exists pide_codigo boolean not null default false;

create table if not exists gt.config (clave text primary key, valor text not null);
alter table gt.config enable row level security;

create table if not exists gt.codigos (
  codigo text primary key, descripcion text,
  rubro text references gt.rubros(codigo), activo boolean not null default true);
alter table gt.codigos enable row level security;
revoke all on gt.config, gt.codigos from anon, authenticated;

create or replace function public.gt_botonera()
returns table (codigo text, nombre text, unidad text, orden int, pide_codigo boolean)
language sql stable security definer set search_path = '' as $$
  select r.codigo, r.nombre, r.unidad, r.orden, r.pide_codigo
    from gt.rubros r where r.activo order by r.orden, r.codigo;
$$;

create or replace function public.gt_codigos()
returns table (codigo text, descripcion text, rubro text)
language sql stable security definer set search_path = '' as $$
  select c.codigo, c.descripcion, c.rubro from gt.codigos c where c.activo order by c.codigo;
$$;

create or replace function public.gt_monitor_clave(p_pass text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_hash text;
begin
  select valor into v_hash from gt.config where clave = 'monitor_pass';
  if v_hash is null or p_pass is null or extensions.crypt(p_pass, v_hash) <> v_hash then
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', true,
    'clave', gt.clave_de(floor(extract(epoch from now()) / 60)::bigint),
    'cambia_en_s', 60 - (floor(extract(epoch from now()))::bigint % 60));
end $$;

revoke all on function public.gt_botonera(), public.gt_codigos(), public.gt_monitor_clave(text) from public;
grant execute on function public.gt_botonera(), public.gt_codigos(), public.gt_monitor_clave(text) to anon, authenticated;

-- ---------- DATOS (con el «sí» del dueño) ----------
-- insert into gt.config (clave, valor)
--   values ('monitor_pass', extensions.crypt('<la clave>', extensions.gen_salt('bf')))
--   on conflict (clave) do update set valor = excluded.valor;
-- update gt.rubros set pide_codigo = true where codigo = 'GRAMP';
-- Y recién con el front nuevo publicado: el código ya no se lee sin clave.
-- revoke execute on function public.gt_clave_actual() from anon, authenticated;

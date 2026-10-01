-- GT v3.0 — reemplaza a la v1 (tablas vacías al aplicarlo, 01/10/2026).
-- El operario entra con el CÓDIGO del monitor (cambia cada minuto) + elige su NOMBRE.
-- Etapa 1 (Thomas, 01/10): sólo registra en qué ÁREA empieza y termina, y al terminar cuántas
--   unidades/cajas hizo (gt.rubros.unidad). Eventos: opcion = 'AREA', rubro = el área,
--   apertura ts_inicio NULL, cierre ts_inicio = hora de apertura + cantidad.
-- Etapa 2 (a definir): dentro del área, qué CÓDIGO empezó y cuántas cajas → gt.tareas por rubro.
-- Rollback: drop schema gt cascade; y los drop function de abajo.

drop function if exists public.gt_login(text);
drop function if exists public.gt_tareas();
drop function if exists public.gt_registrar(jsonb);
drop function if exists public.gt_registros_hoy(text);
drop table if exists gt.registros, gt.tareas, gt.operarios cascade;

create schema if not exists gt;
revoke all on schema gt from anon, authenticated;

create table gt.empleados (
  id         bigint generated always as identity primary key,
  nombre     text not null unique,
  legajo     text unique,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

create table gt.rubros (
  codigo  text primary key,
  nombre  text not null,
  unidad  text not null,             -- lo que se cuenta al terminar: 'unidades cortadas', 'cajas encoladas'…
  orden   int not null default 0,
  activo  boolean not null default true
);

-- tipo 'tarea'  = abre y cierra (mide duración) · 'evento' = un toque
create table gt.tareas (
  codigo          text primary key,
  descripcion     text not null,
  tipo            text not null check (tipo in ('tarea','evento')),
  rubro           text references gt.rubros(codigo),
  pide_texto      boolean not null default false,
  etiqueta_texto  text,
  fila            int not null default 1,
  orden           int not null default 0,
  activo          boolean not null default true
);

-- Rubros habilitados por empleado. Un empleado SIN filas acá ve todas las tareas;
-- con filas, ve las de esos rubros + las que no tienen rubro (baño, comida, fin de jornada).
create table gt.empleado_rubro (
  empleado_id  bigint not null references gt.empleados(id) on delete cascade,
  rubro        text   not null references gt.rubros(codigo) on delete cascade,
  primary key (empleado_id, rubro)
);

create table gt.registros (
  id           uuid primary key default gen_random_uuid(),
  client_id    text not null unique,
  empleado_id  bigint not null references gt.empleados(id),
  opcion       text not null,          -- 'AREA' en la etapa 1
  rubro        text references gt.rubros(codigo),
  cantidad     numeric check (cantidad is null or cantidad >= 0),
  descripcion  text,
  texto        text,
  ts_cliente   timestamptz,
  ts_inicio    timestamptz,
  created_at   timestamptz not null default now(),
  dispositivo  text
);
create index gt_registros_emp_ts on gt.registros (empleado_id, ts_cliente);

alter table gt.empleados      enable row level security;
alter table gt.rubros         enable row level security;
alter table gt.tareas         enable row level security;
alter table gt.empleado_rubro enable row level security;
alter table gt.registros      enable row level security;
revoke all on all tables in schema gt from anon, authenticated;

-- ---------- código de ingreso (≡ gv_tv_clave de Virgilio, semilla propia) ----------
-- 4 dígitos, cambia cada 60 s; vale también el del minuto anterior. NO es un candado:
-- el monitor lo lee con la clave pública. Sirve para que se entre estando en la planta.
create or replace function gt.clave_de(p_tramo bigint)
returns text language sql stable security definer set search_path = '' as $$
  select lpad(((('x' || substr(md5((select system_identifier from pg_catalog.pg_control_system())::text
                 || ':gt-clave:' || p_tramo::text), 1, 8))::bit(32)::bigint) % 10000)::text, 4, '0');
$$;
revoke all on function gt.clave_de(bigint) from public, anon, authenticated;

create or replace function public.gt_clave_actual()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'clave', gt.clave_de(floor(extract(epoch from now()) / 60)::bigint),
    'cambia_en_s', 60 - (floor(extract(epoch from now()))::bigint % 60));
$$;

create or replace function public.gt_clave_validar(p_clave text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_t bigint := floor(extract(epoch from now()) / 60)::bigint;
  v_c text := regexp_replace(coalesce(p_clave, ''), '\D', '', 'g');
begin
  if v_c = '' or (v_c <> gt.clave_de(v_t) and v_c <> gt.clave_de(v_t - 1)) then
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', true, 'empleados', coalesce((
    select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre) order by e.nombre)
      from gt.empleados e where e.activo), '[]'::jsonb));
end $$;

-- ---------- botonera, registro e historial ----------
create or replace function public.gt_areas()
returns table (codigo text, nombre text, unidad text, orden int)
language sql stable security definer set search_path = '' as $$
  select r.codigo, r.nombre, r.unidad, r.orden from gt.rubros r where r.activo order by r.orden, r.codigo;
$$;

create or replace function public.gt_tareas(p_empleado bigint)
returns table (codigo text, descripcion text, tipo text, rubro text, pide_texto boolean,
               etiqueta_texto text, fila int, orden int)
language sql stable security definer set search_path = '' as $$
  select t.codigo, t.descripcion, t.tipo, t.rubro, t.pide_texto, t.etiqueta_texto, t.fila, t.orden
    from gt.tareas t
    left join gt.rubros r on r.codigo = t.rubro
   where t.activo and (t.rubro is null or r.activo)
     and (t.rubro is null
          or not exists (select 1 from gt.empleado_rubro x where x.empleado_id = p_empleado)
          or exists (select 1 from gt.empleado_rubro x where x.empleado_id = p_empleado and x.rubro = t.rubro))
   order by t.fila, t.orden, t.codigo;
$$;

-- Lote de la cola offline; contesta FILA POR FILA qué entró y qué se rechazó.
create or replace function public.gt_registrar(p_filas jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  f jsonb; ok jsonb := '[]'::jsonb; rech jsonb := '[]'::jsonb; v_cid text; v_emp bigint;
begin
  for f in select * from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb)) loop
    v_cid := f->>'client_id';
    v_emp := case when (f->>'empleado_id') ~ '^\d+$' then (f->>'empleado_id')::bigint end;
    if v_cid is null or v_cid = '' then
      rech := rech || jsonb_build_object('client_id', null, 'motivo', 'sin client_id');
    elsif v_emp is null or not exists (select 1 from gt.empleados e where e.activo and e.id = v_emp) then
      rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', 'empleado inexistente o inactivo');
    elsif f->>'opcion' = 'AREA' and not exists (select 1 from gt.rubros r where r.codigo = f->>'rubro') then
      rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', 'área inexistente');
    elsif f->>'opcion' <> 'AREA' and not exists (select 1 from gt.tareas t where t.codigo = f->>'opcion') then
      rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', 'tarea inexistente');
    elsif (f->>'cantidad') is not null and (f->>'cantidad') !~ '^\d+(\.\d+)?$' then
      rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', 'cantidad inválida');
    else
      insert into gt.registros (client_id, empleado_id, opcion, rubro, cantidad, descripcion, texto, ts_cliente, ts_inicio, dispositivo)
      values (v_cid, v_emp, f->>'opcion', nullif(f->>'rubro',''), (f->>'cantidad')::numeric, f->>'descripcion', nullif(f->>'texto',''),
              (f->>'ts_cliente')::timestamptz, nullif(f->>'ts_inicio','')::timestamptz, f->>'dispositivo')
      on conflict (client_id) do nothing;
      ok := ok || to_jsonb(v_cid);
    end if;
  end loop;
  return jsonb_build_object('ok', ok, 'rechazados', rech);
end $$;

create or replace function public.gt_registros_hoy(p_empleado bigint)
returns table (client_id text, opcion text, rubro text, cantidad numeric, descripcion text, texto text,
               ts_cliente timestamptz, ts_inicio timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.client_id, r.opcion, r.rubro, r.cantidad, r.descripcion, r.texto, r.ts_cliente, r.ts_inicio
    from gt.registros r
   where r.empleado_id = p_empleado
     and r.ts_cliente >= (date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires')
                          at time zone 'America/Argentina/Buenos_Aires')
   order by r.ts_cliente;
$$;

revoke all on function public.gt_clave_actual(), public.gt_clave_validar(text), public.gt_areas(), public.gt_tareas(bigint),
                       public.gt_registrar(jsonb), public.gt_registros_hoy(bigint) from public;
grant execute on function public.gt_clave_actual(), public.gt_clave_validar(text), public.gt_areas(), public.gt_tareas(bigint),
                          public.gt_registrar(jsonb), public.gt_registros_hoy(bigint) to anon, authenticated;

-- ---------- DATOS INICIALES (con el «sí» del dueño) ----------
insert into gt.rubros (codigo, nombre, unidad, orden) values
  ('CORTE',  'Corte',      'unidades cortadas',          1),
  ('GRAMP',  'Grampeado',  'unidades grampeadas',        2),
  ('ENCOL',  'Encolado',   'cajas encoladas',            3),
  ('MONT',   'Montaje',    'cajas fabricadas',           4),
  ('GANCHO', 'Gancho',     'cajas puestas de gancho',    5),
  ('EMBL',   'Emblistado', 'cajas emblistadas',          6),
  ('CONTR',  'Contraído',  'cajas contraídas',           7),
  ('PED',    'Pedidos',    'pedidos armados',            8),
  ('DECO',   'Deco',       'unidades fabricadas',        9)
on conflict (codigo) do nothing;

insert into gt.empleados (nombre) values
  ('Javier Burgos'),('Lautaro Durante'),('Federico Realini'),('Juan Gimenez'),('Luis Luna'),
  ('Dario Mendez'),('Ximena Ortiz'),('Walter Saucedo'),('David Galarza')
on conflict (nombre) do nothing;

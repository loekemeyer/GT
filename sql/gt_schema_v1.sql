-- GT v1.0 — schema propio de la planta GT (proyecto Supabase hrxfctzncixxqmpfhskv).
-- Mismo formato de evento que public."Registros_Produccion_Virgilio":
--   apertura de una tarea = fila con ts_inicio NULL; cierre = fila con ts_inicio = hora de apertura.
-- El celular NO lee el schema gt: entra sólo por las RPC public.gt_* (SECURITY DEFINER).
-- Rollback: drop schema gt cascade; drop function public.gt_login(text), public.gt_tareas(),
--           public.gt_registrar(jsonb), public.gt_registros_hoy(text);

create schema if not exists gt;
revoke all on schema gt from anon, authenticated;

create table if not exists gt.operarios (
  legajo     text primary key,
  nombre     text not null,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

-- tipo 'tarea'  = abre y cierra (mide duración, como EP/TP de Virgilio)
-- tipo 'evento' = un solo toque (como Fin de jornada)
create table if not exists gt.tareas (
  codigo          text primary key,
  descripcion     text not null,
  tipo            text not null check (tipo in ('tarea','evento')),
  pide_texto      boolean not null default false,
  etiqueta_texto  text,
  fila            int not null default 1,
  orden           int not null default 0,
  activo          boolean not null default true
);

create table if not exists gt.registros (
  id           uuid primary key default gen_random_uuid(),
  client_id    text not null unique,
  legajo       text not null,
  opcion       text not null,
  descripcion  text,
  texto        text,
  ts_cliente   timestamptz,
  ts_inicio    timestamptz,
  created_at   timestamptz not null default now(),
  dispositivo  text
);
create index if not exists gt_registros_legajo_ts on gt.registros (legajo, ts_cliente);

alter table gt.operarios enable row level security;
alter table gt.tareas    enable row level security;
alter table gt.registros enable row level security;
revoke all on all tables in schema gt from anon, authenticated;

-- ---------- RPC ----------
create or replace function public.gt_login(p_legajo text)
returns table (legajo text, nombre text)
language sql stable security definer set search_path = '' as $$
  select o.legajo, o.nombre from gt.operarios o
   where o.activo and o.legajo = btrim(p_legajo);
$$;

create or replace function public.gt_tareas()
returns table (codigo text, descripcion text, tipo text, pide_texto boolean,
               etiqueta_texto text, fila int, orden int)
language sql stable security definer set search_path = '' as $$
  select t.codigo, t.descripcion, t.tipo, t.pide_texto, t.etiqueta_texto, t.fila, t.orden
    from gt.tareas t where t.activo order by t.fila, t.orden, t.codigo;
$$;

-- Recibe un lote de la cola offline. Devuelve qué entró (o ya estaba) y qué se rechazó,
-- FILA POR FILA: una fila mala no traba al resto (lección v25.20 de Virgilio).
create or replace function public.gt_registrar(p_filas jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  f jsonb; ok jsonb := '[]'::jsonb; rech jsonb := '[]'::jsonb; v_cid text;
begin
  for f in select * from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb)) loop
    v_cid := f->>'client_id';
    if v_cid is null or v_cid = '' then
      rech := rech || jsonb_build_object('client_id', null, 'motivo', 'sin client_id');
    elsif not exists (select 1 from gt.operarios o where o.activo and o.legajo = f->>'legajo') then
      rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', 'legajo inexistente o inactivo');
    elsif not exists (select 1 from gt.tareas t where t.codigo = f->>'opcion') then
      rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', 'tarea inexistente');
    else
      insert into gt.registros (client_id, legajo, opcion, descripcion, texto, ts_cliente, ts_inicio, dispositivo)
      values (v_cid, f->>'legajo', f->>'opcion', f->>'descripcion', nullif(f->>'texto',''),
              (f->>'ts_cliente')::timestamptz, nullif(f->>'ts_inicio','')::timestamptz, f->>'dispositivo')
      on conflict (client_id) do nothing;
      ok := ok || to_jsonb(v_cid);
    end if;
  end loop;
  return jsonb_build_object('ok', ok, 'rechazados', rech);
end $$;

create or replace function public.gt_registros_hoy(p_legajo text)
returns table (client_id text, opcion text, descripcion text, texto text,
               ts_cliente timestamptz, ts_inicio timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.client_id, r.opcion, r.descripcion, r.texto, r.ts_cliente, r.ts_inicio
    from gt.registros r
   where r.legajo = btrim(p_legajo)
     and r.ts_cliente >= (date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires')
                          at time zone 'America/Argentina/Buenos_Aires')
   order by r.ts_cliente;
$$;

revoke all on function public.gt_login(text), public.gt_tareas(),
                       public.gt_registrar(jsonb), public.gt_registros_hoy(text) from public;
grant execute on function public.gt_login(text), public.gt_tareas(),
                          public.gt_registrar(jsonb), public.gt_registros_hoy(text) to anon, authenticated;

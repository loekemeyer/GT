-- gt_v193 (Angely, 18/11/2026): marcar empleados de vacaciones desde Admin > Empleados.
-- Aplicado por MCP (migración gt_vacaciones_v170). Anular no borra: anulada = true.

create table if not exists gt.empleado_vacaciones (
  id bigint generated always as identity primary key,
  empleado_id bigint not null references gt.empleados(id),
  desde date not null,
  hasta date not null,
  anulada boolean not null default false,
  creado_en timestamptz not null default now(),
  anulada_en timestamptz,
  constraint empleado_vacaciones_rango check (desde <= hasta)
);
alter table gt.empleado_vacaciones enable row level security;   -- sin policies: sólo por las RPC security definer
create index if not exists empleado_vacaciones_emp on gt.empleado_vacaciones (empleado_id, desde, hasta) where not anulada;

create or replace function gt.de_vacaciones(p_emp bigint, p_dia date)
 returns boolean language sql stable security definer set search_path to ''
as $f$
  select exists (select 1 from gt.empleado_vacaciones v
                  where v.empleado_id = p_emp and not v.anulada and p_dia between v.desde and v.hasta);
$f$;

create or replace function public.gt_admin_vacaciones(p_pass text)
 returns table(id bigint, empleado_id bigint, desde date, hasta date)
 language sql stable security definer set search_path to ''
as $f$
  select v.id, v.empleado_id, v.desde, v.hasta
    from gt.empleado_vacaciones v
   where gt.pass_ok(p_pass) and not v.anulada
     and v.hasta >= (now() at time zone 'America/Argentina/Buenos_Aires')::date - 30
   order by v.empleado_id, v.desde;
$f$;

create or replace function public.gt_admin_vacacion_guardar(p_pass text, p_emp bigint, p_desde date, p_hasta date)
 returns jsonb language plpgsql security definer set search_path to ''
as $f$
declare v_nombre text; v_id bigint;
begin
  if not gt.pass_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'clave'); end if;
  select nombre into v_nombre from gt.empleados where id = p_emp and activo and not prueba;
  if v_nombre is null then return jsonb_build_object('ok', false, 'error', 'empleado', 'mensaje', 'El empleado no existe o está de baja'); end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta then
    return jsonb_build_object('ok', false, 'error', 'fechas', 'mensaje', 'La fecha desde tiene que ser igual o anterior a la fecha hasta'); end if;
  if p_hasta - p_desde > 60 then
    return jsonb_build_object('ok', false, 'error', 'fechas', 'mensaje', 'Más de 60 días: revisá las fechas'); end if;
  if exists (select 1 from gt.empleado_vacaciones v where v.empleado_id = p_emp and not v.anulada
              and v.desde <= p_hasta and v.hasta >= p_desde) then
    return jsonb_build_object('ok', false, 'error', 'solapa', 'mensaje', 'Ya tiene vacaciones cargadas en esas fechas'); end if;
  insert into gt.empleado_vacaciones (empleado_id, desde, hasta) values (p_emp, p_desde, p_hasta) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'nombre', v_nombre, 'desde', p_desde, 'hasta', p_hasta);
end $f$;

create or replace function public.gt_admin_vacacion_anular(p_pass text, p_id bigint)
 returns jsonb language plpgsql security definer set search_path to ''
as $f$
declare v_emp bigint;
begin
  if not gt.pass_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'clave'); end if;
  update gt.empleado_vacaciones set anulada = true, anulada_en = now() where id = p_id and not anulada returning empleado_id into v_emp;
  if not found then return jsonb_build_object('ok', false, 'error', 'sin_cambio', 'mensaje', 'No existe o ya estaba anulada'); end if;
  return jsonb_build_object('ok', true, 'id', p_id);
end $f$;

-- public.gt_admin_asistencia4(p_pass, p_dia): copia exacta de gt_admin_asistencia3 con una columna más al final,
--   vacaciones boolean = gt.de_vacaciones(e.id, par.d). Definición viva: pg_get_functiondef('public.gt_admin_asistencia4(text,date)'::regprocedure).

-- gt.alerta_llegada: al where de «pri» se le sumó  and not gt.de_vacaciones(e.id, v_hoy)  (sobre la definición viva).

revoke all on function gt.de_vacaciones(bigint, date) from public, anon, authenticated;
grant execute on function public.gt_admin_vacaciones(text), public.gt_admin_vacacion_guardar(text,bigint,date,date),
  public.gt_admin_vacacion_anular(text,bigint), public.gt_admin_asistencia4(text,date) to anon, authenticated;

-- gt_v191 (18/11/2026): el admin de GT se entra con el CÓDIGO DE PLANIFY (como Gestión Virgilio).
-- Pedido: «si entro con Google quiero que me pida la clave de Planify como en Gestión Virgilio y que se me abra el admin
-- … si entrás a admin o con mail que te pida la clave temporal que brinda Planify».
--
-- Cómo:
--  1. Panel nuevo `gt-admin` en accesos.paneles: el código vivo de Planify («🔑 Código admin») identifica a la persona y
--     el permiso al panel se maneja desde el Admin Maestro, igual que gestion-virgilio / gp2-admin.
--  2. gt_admin_identificar(p_codigo, p_email): valida el código contra el panel y, con permiso, devuelve un TOKEN de sesión
--     (dura accesos.ident_duracion('gt-admin'), hoy 8 h). En la base se guarda sólo el sha256.
--  3. gt.pass_ok acepta ese token además de la clave del monitor → TODAS las gt_admin_* (que reciben p_pass) andan con el
--     token sin tocar ninguna. gt_monitor_clave pasa a usar gt.pass_ok (era el único que miraba el hash por su cuenta).
--     La clave del monitor sigue valiendo: la TV la pone el lunes y no puede pedir un código de Planify cada 8 h.
--  4. gt_google_llave devuelve `prueba: true` cuando el mail es el de la Persona de Prueba: con eso (o con la clave de
--     vista, o con un mail que no es de ningún operario) el celular manda al admin en vez de entrar a la botonera.
--     Un encargado con clave personal (Darío) sigue entrando a su botonera como antes.

insert into accesos.paneles (id, repo, nombre, activo)
values ('gt-admin', 'loekemeyer/gt', 'Admin de GT (Producción GT)', true)
on conflict (id) do nothing;

-- permisos iniciales: quienes vienen pidiendo cosas del admin de GT. El resto se da desde el Admin Maestro de Planify.
insert into accesos.permisos (employee_id, panel_id, otorgado_por)
select x, 'gt-admin', 'claude gt_v191' from unnest(array[3, 22, 16, 1]::bigint[]) x
on conflict do nothing;

create table if not exists gt.admin_sesiones (
  id bigserial primary key,
  hash text not null unique,
  employee_id bigint,
  nombre text,
  email text,
  creado_en timestamptz not null default now(),
  vence_en timestamptz not null
);
alter table gt.admin_sesiones enable row level security;   -- sin políticas: sólo las funciones security definer

create or replace function public.gt_admin_identificar(p_codigo text, p_email text default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare r jsonb; v_tok text; v_vence timestamptz := now() + accesos.ident_duracion('gt-admin');
begin
  r := accesos.identificar_vivo('gt-admin', p_codigo);
  if not coalesce((r ->> 'ok')::boolean, false) then
    return jsonb_build_object('ok', false, 'motivo', coalesce(r ->> 'motivo', 'Código incorrecto o vencido.'));
  end if;
  if not coalesce((r ->> 'permiso')::boolean, true) then
    return jsonb_build_object('ok', false, 'nombre', r ->> 'nombre',
      'motivo', coalesce(r ->> 'nombre', 'Esa persona') || ' no tiene permiso al Admin de GT. Se da desde el Admin Maestro de Planify.');
  end if;
  v_tok := 'pl.' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into gt.admin_sesiones (hash, employee_id, nombre, email, vence_en)
  values (encode(extensions.digest(v_tok, 'sha256'), 'hex'), (r ->> 'employee_id')::bigint, r ->> 'nombre',
          left(lower(nullif(btrim(p_email), '')), 120), v_vence);
  return jsonb_build_object('ok', true, 'token', v_tok, 'nombre', r ->> 'nombre',
    'resta_s', floor(extract(epoch from v_vence - now()))::int);
end $function$;
revoke all on function public.gt_admin_identificar(text, text) from public;
grant execute on function public.gt_admin_identificar(text, text) to anon, authenticated;

create or replace function gt.pass_ok(p_pass text)
returns boolean language sql stable security definer set search_path to '' as $function$
  select p_pass is not null and (
    coalesce((select extensions.crypt(p_pass, valor) = valor from gt.config where clave = 'monitor_pass'), false)
    -- gt_v191: o el token que dio gt_admin_identificar (código de Planify), mientras no venza
    or (p_pass like 'pl.%' and exists (select 1 from gt.admin_sesiones s
         where s.hash = encode(extensions.digest(p_pass, 'sha256'), 'hex') and s.vence_en > now())));
$function$;

create or replace function public.gt_monitor_clave(p_pass text)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_hash text;
begin
  select valor into v_hash from gt.config where clave = 'monitor_pass';
  -- sin clave configurada el monitor muestra el código (como la v3), para no dejar a nadie afuera
  -- gt_v191: la clave del monitor o el token de Planify (gt.pass_ok)
  if v_hash is not null and not gt.pass_ok(p_pass) then
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', true, 'sin_clave', v_hash is null,
    'clave', gt.clave_de(floor(extract(epoch from now()) / 60)::bigint),
    'cambia_en_s', 60 - (floor(extract(epoch from now()))::bigint % 60));
end $function$;

create or replace function public.gt_google_llave()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_mail text := lower(coalesce(auth.jwt()->>'email','')); v_k gt.clave_personal; v_vista text; v_prueba boolean;
begin
  if v_mail = '' then return jsonb_build_object('ok', false, 'motivo', 'sin sesión'); end if;
  -- gt_v183: o la persona de prueba (inactiva a propósito, entra en modo vista)
  select * into v_k from gt.clave_personal k where lower(k.email) = v_mail and k.activo
     and exists (select 1 from gt.empleados e where e.id = k.empleado_id and (e.activo or e.prueba)) limit 1;
  if found then
    -- gt_v191: la persona de prueba no es un operario: el celular la manda al admin (código de Planify)
    select coalesce(e.prueba, false) into v_prueba from gt.empleados e where e.id = v_k.empleado_id;
    return jsonb_build_object('ok', true, 'llave', v_k.clave, 'prueba', coalesce(v_prueba, false), 'email', v_mail);
  end if;
  -- gt_v181: los mails de gt.config.google_vista_mails (separados por coma) entran con la clave de vista: no graban
  if v_mail = any (select lower(trim(m)) from unnest(string_to_array(coalesce((select valor from gt.config where clave = 'google_vista_mails'), ''), ',')) m) then
    select valor into v_vista from gt.config where clave = 'clave_vista';
    if coalesce(v_vista, '') <> '' then return jsonb_build_object('ok', true, 'llave', v_vista, 'vista', true, 'email', v_mail); end if;
  end if;
  return jsonb_build_object('ok', false, 'motivo', 'mail no habilitado', 'email', v_mail);
end $function$;

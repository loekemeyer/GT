-- GT v1.59 / gt_v168 — entrar al admin para CONSULTAR (Asistencia, Producción, Pedidos, Rendimiento) no avisa
-- «🔐 abrieron el monitor fuera de horario» (pedido del 08/10/2026: «solo queremos chequear la asistencia del día,
-- así que no es una llegada tarde»).
-- Medido el 08/10: desde el lunes 05/10 salieron 5 avisos de ésos (lun 08:00 y 12:11, mar 12:07, mié 10:04, jue 10:36),
-- todos desde PC con Windows y ninguno en la ventana: alguien mirando el admin, no el código.
--
-- Qué cambia:
-- 1) gt.monitor_ingresos.pestana: desde qué pestaña se tipeó la clave ('monitor', 'asis', 'prod', 'ped', 'rend').
--    Las filas viejas quedan en null y cuentan como 'monitor' (así se las trató al grabarlas).
-- 2) public.gt_monitor_login2(pass, dispositivo, navegador, pestana): igual que gt_monitor_login, pero con una pestaña
--    que no es 'monitor' NO avisa (ni fuera de horario ni «desde OTRO equipo»), no fija «el equipo de siempre» y no
--    cuenta como «el monitor se abrió el lunes». El ingreso se graba igual.
--    El código no se ve sin avisar: si después se pasa a la pestaña Monitor, admin.html llama de nuevo con 'monitor'.
-- 3) public.gt_monitor_login (la de 3 argumentos, la que llaman los admin.html viejos) = login2 con 'monitor': igual
--    que antes. Es función nueva y no un 4.º argumento porque dos firmas que se pisan confunden a la API y el conector
--    no deja el DROP.
-- 4) gt.alerta_monitor_lunes: sólo cuenta ingresos desde el Monitor.
--
-- ⚠ No es un candado (ya no lo era): con la clave, gt_monitor_clave devuelve el código sin dejar rastro. El aviso
--   cubre la pantalla del monitor, no la API.
-- Rollback: sql/gt_v168_rollback.sql (las dos definiciones vivas del 08/10, antes de este cambio).

alter table gt.monitor_ingresos add column if not exists pestana text;
comment on column gt.monitor_ingresos.pestana is
  'desde qué pestaña del admin se tipeó la clave (monitor, asis, prod, ped, rend). null = antes de gt_v168, cuenta como monitor';

create or replace function public.gt_monitor_login2(p_pass text, p_dispositivo text default null,
  p_navegador text default null, p_pestana text default 'monitor')
 returns jsonb language plpgsql volatile security definer set search_path to ''
as $function$
declare
  v_ok boolean := gt.pass_ok(p_pass);
  v_ar timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  v_dow int := coalesce((select valor from gt.config where clave = 'monitor_login_dow'), '1')::int;
  v_desde time := coalesce((select valor from gt.config where clave = 'monitor_login_desde'), '07:00')::time;
  v_hasta time := coalesce((select valor from gt.config where clave = 'monitor_login_hasta'), '08:00')::time;
  v_chat text := (select valor from gt.config where clave = 'telegram_chat');
  v_pestana text := left(coalesce(nullif(btrim(p_pestana), ''), 'monitor'), 20);
  v_mon boolean := v_pestana = 'monitor';
  v_en boolean; v_id bigint; v_habitual text;
  v_dias text[] := array['lun','mar','mié','jue','vie','sáb','dom'];
begin
  v_en := extract(isodow from v_ar) = v_dow and v_ar::time >= v_desde and v_ar::time <= v_hasta;
  -- v1.11: el equipo de siempre = el del último ingreso BUENO y EN HORARIO anterior a éste
  -- gt_v168: sólo los del Monitor (mirar la asistencia desde el celular no cambia «el de siempre»)
  select dispositivo into v_habitual from gt.monitor_ingresos
   where ok and en_horario and dispositivo is not null and coalesce(pestana, 'monitor') = 'monitor'
   order by ts desc limit 1;
  insert into gt.monitor_ingresos (ok, en_horario, dispositivo, navegador, pestana)
  values (v_ok, case when v_ok then v_en end, left(p_dispositivo, 60), left(p_navegador, 200), v_pestana)
  returning id into v_id;
  -- gt_v168: consultar Asistencia / Producción / Pedidos / Rendimiento no es abrir el monitor: no avisa
  if v_ok and v_mon and not v_en then
    perform public.tg_enqueue(
      '🔐 GT — abrieron el monitor con la clave fuera de horario' || E'\n' ||
      v_dias[extract(isodow from v_ar)::int] || ' ' || to_char(v_ar, 'DD/MM HH24:MI') ||
      ' (se espera ' || v_dias[v_dow] || ' ' || to_char(v_desde, 'HH24:MI') || '–' || to_char(v_hasta, 'HH24:MI') || ')' ||
      coalesce(E'\nEquipo: ' || left(p_dispositivo, 8), '') ||
      coalesce(E'\n' || left(p_navegador, 120), ''),
      'gt-monitor-login-' || v_id, coalesce(v_chat, '-1004379879565'));
  elsif v_ok and v_mon and v_en and v_habitual is not null and v_habitual is distinct from left(p_dispositivo, 60) then
    perform public.tg_enqueue(
      '🔐 GT — abrieron el monitor en horario pero desde OTRO equipo' || E'\n' ||
      v_dias[extract(isodow from v_ar)::int] || ' ' || to_char(v_ar, 'DD/MM HH24:MI') ||
      E'\nEquipo: ' || coalesce(left(p_dispositivo, 8), '¿?') || ' (el de siempre: ' || left(v_habitual, 8) || ')' ||
      coalesce(E'\n' || left(p_navegador, 120), ''),
      'gt-monitor-login-' || v_id, coalesce(v_chat, '-1004379879565'));
  end if;
  return jsonb_build_object('ok', v_ok, 'en_horario', v_en, 'pestana', v_pestana);
end $function$;
revoke all on function public.gt_monitor_login2(text, text, text, text) from public;
grant execute on function public.gt_monitor_login2(text, text, text, text) to anon, authenticated;

-- la de 3 argumentos (admin.html anterior a la 1.59): siempre es abrir el monitor, como hasta hoy
create or replace function public.gt_monitor_login(p_pass text, p_dispositivo text default null, p_navegador text default null)
 returns jsonb language plpgsql volatile security definer set search_path to ''
as $function$
begin
  return public.gt_monitor_login2(p_pass, p_dispositivo, p_navegador, 'monitor');
end $function$;

create or replace function gt.alerta_monitor_lunes(p_enviar boolean default true)
 returns text language plpgsql security definer set search_path to ''
as $function$
declare
  v_ar timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  v_hoy date := v_ar::date;
  v_dow int := coalesce((select valor from gt.config where clave = 'monitor_login_dow'), '1')::int;
  v_desde time := coalesce((select valor from gt.config where clave = 'monitor_login_desde'), '07:00')::time;
  v_hasta time := coalesce((select valor from gt.config where clave = 'monitor_login_hasta'), '08:00')::time;
  v_chat text := (select valor from gt.config where clave = 'telegram_chat');
  v_msg text;
begin
  if extract(isodow from v_hoy) <> v_dow or public.gv_es_feriado(v_hoy) or v_ar::time < v_hasta then return null; end if;
  -- gt_v168: mirar la asistencia en la ventana no cuenta como abrir el monitor
  if exists (select 1 from gt.monitor_ingresos where ok and en_horario and coalesce(pestana, 'monitor') = 'monitor'
              and ts >= (v_hoy::timestamp at time zone 'America/Argentina/Buenos_Aires')) then return null; end if;
  v_msg := '⚠️ GT — ' || to_char(v_hoy, 'DD/MM') || ': nadie abrió el monitor con la clave entre las ' ||
           to_char(v_desde, 'HH24:MI') || ' y las ' || to_char(v_hasta, 'HH24:MI');
  if p_enviar then perform public.tg_enqueue(v_msg, 'gt-monitor-lunes-' || v_hoy::text, coalesce(v_chat, '-1004379879565')); end if;
  return v_msg;
end $function$;

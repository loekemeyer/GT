-- Rollback de gt_v168: vuelve gt_monitor_login y gt.alerta_monitor_lunes a como estaban el 08/10/2026 (definición viva
-- leída antes del cambio) y le saca el permiso a gt_monitor_login2 (el conector no deja el DROP).
-- La columna gt.monitor_ingresos.pestana puede quedar: nadie más la lee.
-- ⚠ Con esto, admin.html 1.59 cae a gt_monitor_login (3 argumentos) y vuelve a avisar desde cualquier pestaña.

revoke execute on function public.gt_monitor_login2(text, text, text, text) from anon, authenticated;

create or replace function public.gt_monitor_login(p_pass text, p_dispositivo text default null, p_navegador text default null)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_ok boolean := gt.pass_ok(p_pass);
  v_ar timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  v_dow int := coalesce((select valor from gt.config where clave = 'monitor_login_dow'), '1')::int;
  v_desde time := coalesce((select valor from gt.config where clave = 'monitor_login_desde'), '07:00')::time;
  v_hasta time := coalesce((select valor from gt.config where clave = 'monitor_login_hasta'), '08:00')::time;
  v_chat text := (select valor from gt.config where clave = 'telegram_chat');
  v_en boolean; v_id bigint; v_habitual text;
  v_dias text[] := array['lun','mar','mié','jue','vie','sáb','dom'];
begin
  v_en := extract(isodow from v_ar) = v_dow and v_ar::time >= v_desde and v_ar::time <= v_hasta;
  -- v1.11: el equipo de siempre = el del último ingreso BUENO y EN HORARIO anterior a éste
  select dispositivo into v_habitual from gt.monitor_ingresos
   where ok and en_horario and dispositivo is not null order by ts desc limit 1;
  insert into gt.monitor_ingresos (ok, en_horario, dispositivo, navegador)
  values (v_ok, case when v_ok then v_en end, left(p_dispositivo, 60), left(p_navegador, 200))
  returning id into v_id;
  if v_ok and not v_en then
    perform public.tg_enqueue(
      '🔐 GT — abrieron el monitor con la clave fuera de horario' || E'\n' ||
      v_dias[extract(isodow from v_ar)::int] || ' ' || to_char(v_ar, 'DD/MM HH24:MI') ||
      ' (se espera ' || v_dias[v_dow] || ' ' || to_char(v_desde, 'HH24:MI') || '–' || to_char(v_hasta, 'HH24:MI') || ')' ||
      coalesce(E'\nEquipo: ' || left(p_dispositivo, 8), '') ||
      coalesce(E'\n' || left(p_navegador, 120), ''),
      'gt-monitor-login-' || v_id, coalesce(v_chat, '-1004379879565'));
  elsif v_ok and v_en and v_habitual is not null and v_habitual is distinct from left(p_dispositivo, 60) then
    perform public.tg_enqueue(
      '🔐 GT — abrieron el monitor en horario pero desde OTRO equipo' || E'\n' ||
      v_dias[extract(isodow from v_ar)::int] || ' ' || to_char(v_ar, 'DD/MM HH24:MI') ||
      E'\nEquipo: ' || coalesce(left(p_dispositivo, 8), '¿?') || ' (el de siempre: ' || left(v_habitual, 8) || ')' ||
      coalesce(E'\n' || left(p_navegador, 120), ''),
      'gt-monitor-login-' || v_id, coalesce(v_chat, '-1004379879565'));
  end if;
  return jsonb_build_object('ok', v_ok, 'en_horario', v_en);
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
  if exists (select 1 from gt.monitor_ingresos where ok and en_horario
              and ts >= (v_hoy::timestamp at time zone 'America/Argentina/Buenos_Aires')) then return null; end if;
  v_msg := '⚠️ GT — ' || to_char(v_hoy, 'DD/MM') || ': nadie abrió el monitor con la clave entre las ' ||
           to_char(v_desde, 'HH24:MI') || ' y las ' || to_char(v_hasta, 'HH24:MI');
  if p_enviar then perform public.tg_enqueue(v_msg, 'gt-monitor-lunes-' || v_hoy::text, coalesce(v_chat, '-1004379879565')); end if;
  return v_msg;
end $function$;

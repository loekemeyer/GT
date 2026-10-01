-- GT v1.6 — APLICADO el 2026-10-01. Thomas: «todos los lunes ~7:30 un operario (Javier) entra en la PC
-- y pone la clave 151515. Si en otro momento lo abren con la clave → alerta por Telegram».
-- Cada vez que alguien TIPEA la clave en admin.html se llama gt_monitor_login (la lectura del código
-- cada minuto sigue por gt_monitor_clave y no cuenta como ingreso). Fuera de la ventana → «GT Avisos».
-- Ventana (editable con un insert en gt.config, sin deploy; sin fila vale el default):
--   monitor_login_dow   '1'      (isodow: 1 = lunes)
--   monitor_login_desde '07:00'
--   monitor_login_hasta '08:00'
-- Rollback: revoke execute on function public.gt_monitor_login(text,text,text) from anon, authenticated;

create table if not exists gt.monitor_ingresos (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  ok boolean not null,
  en_horario boolean,
  dispositivo text,
  navegador text
);
alter table gt.monitor_ingresos enable row level security;
revoke all on gt.monitor_ingresos from anon, authenticated;

create or replace function public.gt_monitor_login(p_pass text, p_dispositivo text default null, p_navegador text default null)
 returns jsonb language plpgsql volatile security definer set search_path to ''
as $function$
declare
  v_ok boolean := gt.pass_ok(p_pass);
  v_ar timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  v_dow int := coalesce((select valor from gt.config where clave = 'monitor_login_dow'), '1')::int;
  v_desde time := coalesce((select valor from gt.config where clave = 'monitor_login_desde'), '07:00')::time;
  v_hasta time := coalesce((select valor from gt.config where clave = 'monitor_login_hasta'), '08:00')::time;
  v_chat text := (select valor from gt.config where clave = 'telegram_chat');
  v_en boolean; v_id bigint;
  v_dias text[] := array['lun','mar','mié','jue','vie','sáb','dom'];
begin
  v_en := extract(isodow from v_ar) = v_dow and v_ar::time >= v_desde and v_ar::time <= v_hasta;
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
  end if;
  return jsonb_build_object('ok', v_ok, 'en_horario', v_en);
end $function$;
revoke all on function public.gt_monitor_login(text, text, text) from public;
grant execute on function public.gt_monitor_login(text, text, text) to anon, authenticated;

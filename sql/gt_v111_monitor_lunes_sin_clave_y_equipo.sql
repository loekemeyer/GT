-- GT v1.11 — APLICADO el 2026-10-01 (Thomas, D27).
-- 1) Lunes 08:01 (cron gt-alerta-monitor-lunes '1 11 * * 1' UTC): si nadie abrió el monitor con la clave en
--    la ventana (lun 07:00–08:00), «⚠️ GT — dd/mm: nadie abrió el monitor con la clave…». Feriado: no avisa.
-- 2) gt_monitor_login: además del aviso fuera de horario (v1.6), avisa si se abre EN horario pero desde un
--    equipo distinto al del último ingreso bueno en horario («el de siempre»). El primero que entra fija el equipo.
-- Probado en transacción abortada: PC-DEPOSITO-1 sin aviso, CELU-JAVIER-9 → «desde OTRO equipo (el de siempre:
-- PC-DEPOS)»; sin ingreso → mensaje del lunes; con ingreso → nada.
-- Definición viva: select pg_get_functiondef('public.gt_monitor_login(text,text,text)'::regprocedure);
--                  select pg_get_functiondef('gt.alerta_monitor_lunes(boolean)'::regprocedure);
-- Rollback del cron: select cron.unschedule('gt-alerta-monitor-lunes');

-- GT v1.12 — APLICADO el 2026-10-01 con el «sí» de Thomas (D29): Recibir mercadería no pregunta Insumo / Moldura.
update gt.rubros set pide_codigo = false where codigo = 'RECIB';
-- verificado: RECIB pide_codigo=false, pide_cantidad=true, unidad 'unidades recibidas'. Rollback: = true.

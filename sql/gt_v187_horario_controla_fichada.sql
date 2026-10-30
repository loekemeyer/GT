-- gt_v187 (30/10/2026): el horario que se carga en el módulo 👥 Empleados CONTROLA la fichada (Angely: D16 «sí»).
-- 1) gt.alerta_llegada (cron 08:05 «ocho» y 10:30 «resumen»): medía a TODOS contra la hora de entrada general (08:00) y no conocía los francos.
--    Ahora cada uno se mide contra SU entrada del día (gt.horario_dia > gt.horario_empleado > gt.config) y quien tiene el día libre
--    (gt.horario_dia.libre) no figura. Sólo entran a la lista los que ya pasaron SU hora de entrada (uno que entra a las 14:00 no sale a las 08:05).
--    Para quien entra a la hora general el mensaje es IDÉNTICO al de antes (probado contra la definición vieja con los datos de hoy en los dos modos).
--    A quien entra a otra hora el renglón le suma « (entra HH:MM)».
-- 2) public.gt_admin_asistencia3: lo mismo que gt_admin_asistencia2 más la columna libre, para que Asistencia diga «Franco» en vez de «No vino».
-- Sobre la definición viva (pg_get_functiondef) del 30/10/2026. Rollback: volver a correr el create or replace de gt.alerta_llegada de sql/gt_v147_ingreso_primer_productivo.sql
-- (o dejar el horario de todos en 08:00 y sin francos: el aviso sale igual que antes).
-- Sin punto y coma dentro de textos ni comentarios (el conector parte el pedido por esa marca).
create or replace function gt.alerta_llegada(p_modo text, p_enviar boolean default true)
returns text
language plpgsql security definer set search_path = ''
as $function$
declare
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_lim timestamptz;
  v_tol interval := make_interval(mins => coalesce((select valor from gt.config where clave = 'tolerancia_min'), '5')::int);
  v_chat text;
  v_tarde text; v_sin text; v_noarranca text; v_arranque text; v_msg text;
begin
  if extract(isodow from v_hoy) > 5 or public.gv_es_feriado(v_hoy) then return null; end if;
  v_lim := (v_hoy + coalesce((select valor from gt.config where clave = 'hora_entrada'), '08:00')::time)
           at time zone 'America/Argentina/Buenos_Aires';
  v_chat := (select valor from gt.config where clave = 'telegram_chat');

  -- gt_v147 (Elías): llegada = INGRESO (el código del monitor, sin él el primer registro). Aparte, el PRIMER TRABAJO PRODUCTIVO (área con
  -- gt.rubros.productivo), que tiene que empezar a la hora de entrada: más de la tolerancia, avisa.
  -- gt_v187: la hora de entrada es la de CADA uno (lim) y el día libre no cuenta. v_lim queda para el título del mensaje.
  with pri as (
    select e.nombre,
           ((v_hoy + coalesce(hd.entrada, h.entrada, coalesce((select valor from gt.config where clave = 'hora_entrada'), '08:00')::time))
              at time zone 'America/Argentina/Buenos_Aires') as lim,
           min(r.ts_cliente) primero,
           min(r.ts_cliente) filter (where r.opcion = 'AREA' and r.ts_inicio is null and coalesce(ru.productivo, true)) prod
      from gt.empleados e
      left join gt.horario_empleado h on h.empleado_id = e.id
      left join gt.horario_dia hd on hd.empleado_id = e.id and hd.dow = extract(isodow from v_hoy)
      left join gt.registros r on r.empleado_id = e.id
       and r.ts_cliente >= (v_hoy::timestamp at time zone 'America/Argentina/Buenos_Aires')
      left join gt.rubros ru on ru.codigo = r.rubro
     where e.activo and not coalesce(hd.libre, false)
     group by e.nombre, hd.entrada, h.entrada)
  select string_agg('• ' || nombre || ' — ' || to_char(primero at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') ||
                    case when primero <= lim + v_tol then ' (dentro de la tolerancia)' else '' end ||
                    case when lim <> v_lim then ' (entra ' || to_char(lim at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') || ')' else '' end,
                    E'\n' order by primero)
           filter (where primero > lim),
         string_agg('• ' || nombre ||
                    case when lim <> v_lim then ' (entra ' || to_char(lim at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') || ')' else '' end,
                    E'\n' order by nombre) filter (where primero is null),
         string_agg('• ' || nombre || ' — ingresó ' || to_char(primero at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') ||
                    case when lim <> v_lim then ' (entra ' || to_char(lim at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') || ')' else '' end,
                    E'\n' order by primero)
           filter (where primero <= lim and prod is null),
         string_agg('• ' || nombre || ' — ' ||
                    case when prod is null then 'no empezó a trabajar'
                         else 'empezó ' || to_char(prod at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') ||
                              ' (' || round(extract(epoch from prod - lim) / 60)::int || ' min tarde)' end ||
                    ' · ingresó ' || to_char(primero at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') ||
                    case when lim <> v_lim then ' (entra ' || to_char(lim at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') || ')' else '' end,
                    E'\n' order by prod nulls last, nombre)
           filter (where primero is not null and (prod is null or prod > lim + v_tol))
    into v_tarde, v_sin, v_noarranca, v_arranque from pri
   where lim <= now();

  if p_modo = 'ocho' then
    if v_sin is null and v_tarde is null and v_noarranca is null then return null; end if;
    v_msg := '⏰ GT — a las ' || to_char(v_lim at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') || ':' ||
             coalesce(E'\n\nNo habían ingresado:' || E'\n' || concat_ws(E'\n', v_sin, v_tarde), '') ||
             coalesce(E'\n\nIngresaron pero no empezaron a trabajar:' || E'\n' || v_noarranca, '');
  else
    if v_tarde is null and v_sin is null and v_arranque is null then return null; end if;
    v_msg := '⏰ GT — llegadas tarde ' || to_char(v_hoy, 'DD/MM') ||
             coalesce(E'\n\nIngresaron después de las ' || to_char(v_lim at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') || ':' || E'\n' || v_tarde, '') ||
             coalesce(E'\n\nEmpezaron a trabajar después de las ' || to_char((v_lim + v_tol) at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') || ':' || E'\n' || v_arranque, '') ||
             coalesce(E'\n\nSin ningún registro todavía:' || E'\n' || v_sin, '');
  end if;

  if p_enviar then
    perform public.tg_enqueue(v_msg, 'gt-llegada-' || p_modo || '-' || v_hoy::text, coalesce(v_chat, '-1004379879565'));
  end if;
  return v_msg;
end $function$;

create or replace function public.gt_admin_asistencia3(p_pass text, p_dia date default null)
returns table (empleado text, legajo text, entrada timestamp, entrada_prevista timestamp, almuerzo_sale timestamp, almuerzo_vuelve timestamp,
               almuerzo_desde timestamp, almuerzo_hasta timestamp, flexible boolean, fin timestamp, salida_prevista timestamp, area_abierta boolean,
               termino boolean, tolerancia_min integer, con_codigo boolean, productivo timestamp, productivo_area text, libre boolean)
language sql stable security definer set search_path = ''
as $function$
  with par as (select coalesce(p_dia, (now() at time zone 'America/Argentina/Buenos_Aires')::date) d,
                      coalesce((select valor from gt.config where clave = 'hora_entrada'), '08:00')::time g_en,
                      coalesce((select valor from gt.config where clave = 'tolerancia_min'), '5')::int tol),
  dia as (select r.* from gt.registros r, par
           where r.ts_cliente >= par.d::timestamp at time zone 'America/Argentina/Buenos_Aires'
             and r.ts_cliente <  (par.d + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),
  pri as (select empleado_id, min(ts_cliente) primero, bool_or(opcion = 'INGRESO') con_codigo from dia group by 1),
  prod as (select distinct on (x.empleado_id) x.empleado_id, x.ts_cliente, ru.nombre area
             from dia x join gt.rubros ru on ru.codigo = x.rubro
            where x.opcion = 'AREA' and x.ts_inicio is null and ru.productivo
            order by x.empleado_id, x.ts_cliente)
  select e.nombre, e.legajo, p.primero at time zone 'America/Argentina/Buenos_Aires',
         par.d + coalesce(hd.entrada, h.entrada, par.g_en),
         j.sale, j.vuelve, j.ad, j.ah, coalesce(j.flex, h.almuerzo_flexible, false), j.fin,
         coalesce(j.sa, par.d + coalesce(hd.salida, h.salida, coalesce((select valor from gt.config where clave = 'hora_salida'), '17:30')::time)),
         coalesce(j.area_abierta, false), coalesce(j.termino, false), par.tol,
         coalesce(p.con_codigo, false), pr.ts_cliente at time zone 'America/Argentina/Buenos_Aires', pr.area,
         coalesce(hd.libre, false)
    from par, gt.empleados e
    left join pri p on p.empleado_id = e.id
    left join prod pr on pr.empleado_id = e.id
    left join gt.horario_empleado h on h.empleado_id = e.id
    left join gt.horario_dia hd on hd.empleado_id = e.id and hd.dow = extract(isodow from (select d from par))
    left join gt.jornada_estado((select d from par)) j on j.nombre = e.nombre
   where e.activo and gt.pass_ok(p_pass)
   order by gt.legajo_num(e.legajo) nulls last, e.nombre;
$function$;

revoke all on function public.gt_admin_asistencia3(text, date) from public;
grant execute on function public.gt_admin_asistencia3(text, date) to anon, authenticated;

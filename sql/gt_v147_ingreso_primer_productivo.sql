-- GT gt_v147 (Elías, 02/10/2026): «una cosa es el horario de ingreso, que tiene que estar dado por cuando ponen el código,
-- y otra el horario del primer mensaje productivo. No puede haber una demora mayor en eso. En general llegan antes de
-- las 8 porque entran a desayunar, pero el primer mensaje productivo tiene que comenzar a las 8.»
--
-- · INGRESO: el celular (1.33) graba un evento opcion = 'INGRESO' cuando el operario elige su nombre después del código
--   (no al recargar). gt_registrar sólo acepta un evento que no es AREA si existe en gt.tareas: va su fila, como FIN.
-- · PRIMER PRODUCTIVO: el primer «Empecé» de un área productiva. gt.rubros.productivo = false en las pausas (Almuerzo,
--   Movimientos, Baño); Recibir mercadería y Pedidos cuentan como trabajo. Marcar otra pausa es un update.
-- · gt_admin_asistencia2 = la 1 + con_codigo, productivo (hora) y productivo_area. «Entrada» sigue siendo el primer
--   evento del día, que con el INGRESO es la hora del código (y en días anteriores, el primer registro).
-- · gt.alerta_llegada (08:05 y 10:30): separa a quien no ingresó de quien ingresó pero no arrancó a trabajar, con la
--   demora del primer productivo contra la hora de entrada.
-- · gt.jornada_estado: «terminó el día» no mira el INGRESO, y «área abierta» = una apertura sin su cierre (1.33: Baño y
--   Movimiento pueden ir DENTRO de un área abierta).
-- · gt_admin_ritmo2: a cada tramo se le restan las pausas que caen dentro (Elías: corte de 12:00 a 12:30 con baño de 12:15
--   a 12:30 = 15 min de corte).
-- ROLLBACK: el celular deja de mandar INGRESO con la versión anterior; alerta_llegada y jornada_estado se vuelven a la
-- definición de la cabecera de sql/gt_v15_admin_produccion_asistencia.sql y gt_v114 (o se quita el filtro); la columna
-- productivo y la función 2 quedan inocuas.

insert into gt.tareas (codigo, descripcion, tipo, rubro, pide_texto, etiqueta_texto, fila, orden, activo)
values ('INGRESO', 'Ingresó con el código del monitor', 'evento', null, false, null, 1, 0, true)
on conflict do nothing;

alter table gt.rubros add column if not exists productivo boolean not null default true;
comment on column gt.rubros.productivo is 'gt_v147 (Elías 02/10): false = pausa (no cuenta como primer trabajo productivo del día). Almuerzo, Movimientos, Baño.';
update gt.rubros set productivo = false where codigo in ('ALMU', 'MOVIM', 'BANO');

create or replace function public.gt_admin_asistencia2(p_pass text, p_dia date default null)
 returns table(empleado text, legajo text, entrada timestamp, entrada_prevista timestamp, almuerzo_sale timestamp,
   almuerzo_vuelve timestamp, almuerzo_desde timestamp, almuerzo_hasta timestamp, flexible boolean, fin timestamp,
   salida_prevista timestamp, area_abierta boolean, termino boolean, tolerancia_min integer,
   con_codigo boolean, productivo timestamp, productivo_area text)
 language sql stable security definer set search_path to ''
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
         coalesce(p.con_codigo, false), pr.ts_cliente at time zone 'America/Argentina/Buenos_Aires', pr.area
    from par, gt.empleados e
    left join pri p on p.empleado_id = e.id
    left join prod pr on pr.empleado_id = e.id
    left join gt.horario_empleado h on h.empleado_id = e.id
    left join gt.horario_dia hd on hd.empleado_id = e.id and hd.dow = extract(isodow from (select d from par))
    left join gt.jornada_estado((select d from par)) j on j.nombre = e.nombre
   where e.activo and gt.pass_ok(p_pass)
   order by gt.legajo_num(e.legajo) nulls last, e.nombre;
$function$;
revoke all on function public.gt_admin_asistencia2(text, date) from public;
grant execute on function public.gt_admin_asistencia2(text, date) to anon, authenticated, service_role;

create or replace function gt.alerta_llegada(p_modo text, p_enviar boolean default true)
 returns text language plpgsql security definer set search_path to ''
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

  -- gt_v147 (Elías): llegada = INGRESO (el código del monitor; sin él, el primer registro). Aparte, el PRIMER TRABAJO
  -- PRODUCTIVO (área con gt.rubros.productivo), que tiene que empezar a la hora de entrada: más de la tolerancia, avisa.
  with pri as (
    select e.nombre, min(r.ts_cliente) primero,
           min(r.ts_cliente) filter (where r.opcion = 'AREA' and r.ts_inicio is null and coalesce(ru.productivo, true)) prod
      from gt.empleados e
      left join gt.registros r on r.empleado_id = e.id
       and r.ts_cliente >= (v_hoy::timestamp at time zone 'America/Argentina/Buenos_Aires')
      left join gt.rubros ru on ru.codigo = r.rubro
     where e.activo group by e.nombre)
  select string_agg('• ' || nombre || ' — ' || to_char(primero at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') ||
                    case when primero <= v_lim + v_tol then ' (dentro de la tolerancia)' else '' end, E'\n' order by primero)
           filter (where primero > v_lim),
         string_agg('• ' || nombre, E'\n' order by nombre) filter (where primero is null),
         -- a las 08:05: ingresaron a tiempo y todavía no empezaron a trabajar
         string_agg('• ' || nombre || ' — ingresó ' || to_char(primero at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI'), E'\n' order by primero)
           filter (where primero <= v_lim and prod is null),
         -- a las 10:30: todos los que empezaron a trabajar pasada la tolerancia (o no empezaron)
         string_agg('• ' || nombre || ' — ' ||
                    case when prod is null then 'no empezó a trabajar'
                         else 'empezó ' || to_char(prod at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') ||
                              ' (' || round(extract(epoch from prod - v_lim) / 60)::int || ' min tarde)' end ||
                    ' · ingresó ' || to_char(primero at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI'),
                    E'\n' order by prod nulls last, nombre)
           filter (where primero is not null and (prod is null or prod > v_lim + v_tol))
    into v_tarde, v_sin, v_noarranca, v_arranque from pri;

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

-- gt.jornada_estado: el «último evento» (terminó el día) no mira el INGRESO, y «área abierta» pasa a ser una apertura
-- sin su cierre: con Baño o Movimiento DENTRO de un área (1.33) el último evento puede ser el cierre de la pausa con el
-- área todavía abierta.
create or replace function gt.jornada_estado(p_dia date default null)
 returns table(nombre text, flex boolean, ad timestamp, ah timestamp, sa timestamp, sale timestamp, vuelve timestamp,
               fin timestamp, area_abierta boolean, termino boolean)
 language sql stable security definer set search_path to ''
as $function$
  with par as (
    select coalesce(p_dia, (now() at time zone 'America/Argentina/Buenos_Aires')::date) d,
           coalesce(p_dia, (now() at time zone 'America/Argentina/Buenos_Aires')::date)::timestamp at time zone 'America/Argentina/Buenos_Aires' ini,
           coalesce((select valor from gt.config where clave = 'almuerzo_desde'), '12:00')::time g_ad,
           coalesce((select valor from gt.config where clave = 'almuerzo_hasta'), '13:00')::time g_ah,
           coalesce((select valor from gt.config where clave = 'hora_salida'), '17:30')::time g_sa),
  hoy as (select r.* from gt.registros r, par where r.ts_cliente >= par.ini and r.ts_cliente < par.ini + interval '1 day'),
  pres as (select distinct empleado_id from hoy),
  alm as (select empleado_id, min(ts_cliente) filter (where ts_inicio is null) sale,
                 max(ts_cliente) filter (where ts_inicio is not null) vuelve
            from hoy where rubro = 'ALMU' group by 1),
  fin as (select empleado_id, max(ts_cliente) fin from hoy where opcion = 'FIN' group by 1),
  ult as (select distinct on (empleado_id) empleado_id, opcion, ts_inicio, rubro from hoy where opcion <> 'INGRESO' order by empleado_id, ts_cliente desc),
  abi as (select distinct a.empleado_id from hoy a
           where a.opcion = 'AREA' and a.ts_inicio is null and a.rubro <> 'ALMU'
             and not exists (select 1 from hoy c where c.empleado_id = a.empleado_id and c.rubro = a.rubro
                                                   and c.opcion = 'AREA' and c.ts_inicio = a.ts_cliente))
  select e.nombre, coalesce(h.almuerzo_flexible, false),
         case when coalesce(hd.sin_almuerzo, false) then null else par.d + coalesce(hd.almuerzo_desde, h.almuerzo_desde, par.g_ad) end,
         case when coalesce(hd.sin_almuerzo, false) then null else par.d + coalesce(hd.almuerzo_hasta, h.almuerzo_hasta, par.g_ah) end,
         par.d + coalesce(hd.salida, h.salida, par.g_sa),
         al.sale at time zone 'America/Argentina/Buenos_Aires', al.vuelve at time zone 'America/Argentina/Buenos_Aires',
         f.fin at time zone 'America/Argentina/Buenos_Aires',
         ab.empleado_id is not null,
         coalesce(u.opcion = 'FIN', false)
    from par, pres p join gt.empleados e on e.id = p.empleado_id
    left join gt.horario_empleado h on h.empleado_id = e.id
    left join gt.horario_dia hd on hd.empleado_id = e.id and hd.dow = extract(isodow from (select d from par))
    left join alm al on al.empleado_id = e.id
    left join fin f on f.empleado_id = e.id
    left join ult u on u.empleado_id = e.id
    left join abi ab on ab.empleado_id = e.id
   where e.activo;
$function$;

-- gt_admin_ritmo2 (Elías: «el tiempo que estuviste en baño o movimiento no tiene que contar para lo que estabas
-- haciendo: corte de 12 a 12:30 con baño de 12:15 a 12:30 son 15 minutos de corte»): a cada tramo se le restan las
-- pausas (áreas con gt.rubros.productivo = false) del mismo operario que caen dentro; los 2 min mínimos (D35), netos.
create or replace function public.gt_admin_ritmo2(p_pass text, p_dia date default null)
 returns table(empleado text, legajo text, area text, rubro text, grupo text, codigos text, unidad text, hecho numeric,
               horas numeric, por_hora numeric, prom_grupo numeric, tramos integer)
 language sql stable security definer set search_path to ''
as $function$
  with par as (select coalesce(p_dia, (now() at time zone 'America/Argentina/Buenos_Aires')::date) d),
  base as (
    select c.empleado_id, c.rubro, (c.ts_cliente at time zone 'America/Argentina/Buenos_Aires')::date dia,
           upper(btrim(c.texto)) || coalesce(' (' || c.medida || ')', '') cod,
           case when exists (select 1 from gt.codigo_area ca where ca.rubro = c.rubro)
                then coalesce(gt.familia(c.rubro, c.texto, c.medida), 'Código ' || upper(btrim(c.texto))) end grp,
           (extract(epoch from c.ts_cliente - c.ts_inicio) - coalesce(pz.seg, 0)) / 3600.0 h,
           case when ru.unidad ilike 'cajas%' and co.uxb is not null then c.cantidad * co.uxb else c.cantidad end v,
           case when ru.unidad ilike 'cajas%' and co.uxb is not null then 'unidades' else ru.unidad end u
      from gt.registros c
      join gt.rubros ru on ru.codigo = c.rubro
      left join gt.codigos co on upper(co.codigo) = upper(btrim(c.texto))
      -- gt_v147: las pausas (Baño, Movimiento) dentro del tramo no cuentan
      left join lateral (select sum(extract(epoch from p.ts_cliente - p.ts_inicio)) seg
                           from gt.registros p join gt.rubros pr on pr.codigo = p.rubro and not pr.productivo
                          where p.empleado_id = c.empleado_id and p.opcion = 'AREA' and p.ts_inicio is not null
                            and p.ts_inicio >= c.ts_inicio and p.ts_cliente <= c.ts_cliente) pz on true
     where c.opcion = 'AREA' and c.rubro <> 'ALMU' and c.ts_inicio is not null and c.cantidad is not null
       and extract(epoch from c.ts_cliente - c.ts_inicio) - coalesce(pz.seg, 0) >= 120
       and c.ts_cliente >= ((select d from par) - 28)::timestamp at time zone 'America/Argentina/Buenos_Aires'
       and c.ts_cliente <  ((select d from par) + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),
  prom as (select rubro, grp, u, sum(v) / nullif(sum(h), 0) ph from base, par where dia < par.d group by 1, 2, 3),
  hoy as (select empleado_id, rubro, grp, u, string_agg(distinct cod, ', ') cods, sum(v) v, sum(h) h, count(*)::int n
            from base, par where dia = par.d group by 1, 2, 3, 4)
  select e.nombre, e.legajo, ru.nombre, x.rubro, x.grp, x.cods, x.u, round(x.v, 2), round(x.h::numeric, 2),
         case when x.h >= 0.25 then round((x.v / x.h)::numeric, 1) end,
         round(p.ph::numeric, 1), x.n
    from hoy x join gt.empleados e on e.id = x.empleado_id join gt.rubros ru on ru.codigo = x.rubro
    left join prom p on p.rubro = x.rubro and p.u = x.u and p.grp is not distinct from x.grp
   where gt.pass_ok(p_pass)
   order by gt.legajo_num(e.legajo) nulls last, e.nombre, ru.orden, x.grp;
$function$;

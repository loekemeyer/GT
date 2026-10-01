-- GT v1.14 — APLICADO el 2026-10-01 (Thomas, «sí las 3»: D33, D34, D35).

-- ============ D33: celular nuevo / celular compartido ============
-- Cada evento trae el id del celular (gt.registros.dispositivo, lo genera la app una vez por celular).
-- Avisa a «GT Avisos»: (a) un operario que ya tenía días anteriores entra desde un celular que nunca usó;
-- (b) un mismo celular usado HOY por 2 o más operarios. Un aviso por caso (dedup).
create or replace function gt.trg_alerta_dispositivo()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
declare
  v_ini timestamptz := date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires';
  v_chat text := coalesce((select valor from gt.config where clave = 'telegram_chat'), '-1004379879565');
  v_nom text := (select nombre from gt.empleados where id = new.empleado_id);
  v_antes text; v_lista text; v_ids text;
begin
  -- (a) celular nuevo para este operario
  if exists (select 1 from gt.registros r where r.empleado_id = new.empleado_id and r.ts_cliente < v_ini and r.dispositivo is not null)
     and not exists (select 1 from gt.registros r where r.empleado_id = new.empleado_id and r.dispositivo = new.dispositivo and r.id <> new.id) then
    select string_agg(distinct left(r.dispositivo, 8), ', ') into v_antes
      from gt.registros r where r.empleado_id = new.empleado_id and r.dispositivo is not null and r.id <> new.id
       and r.dispositivo not like 'sistema%';
    perform public.tg_enqueue('📱 GT — ' || v_nom || ' entró desde un celular NUEVO (' ||
      to_char(new.ts_cliente at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') || ')' ||
      E'\nCelular: ' || left(new.dispositivo, 8) || coalesce(E'\nHasta hoy usaba: ' || v_antes, ''),
      'gt-disp-nuevo-' || new.empleado_id || '-' || new.dispositivo, v_chat);
  end if;
  -- (b) mismo celular, 2+ operarios hoy
  if exists (select 1 from gt.registros r where r.dispositivo = new.dispositivo and r.ts_cliente >= v_ini and r.empleado_id <> new.empleado_id) then
    select string_agg(e.nombre || ' (' || to_char(x.primero at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') || ')', ', ' order by x.primero),
           string_agg(x.empleado_id::text, '-' order by x.empleado_id)
      into v_lista, v_ids
      from (select r.empleado_id, min(r.ts_cliente) primero from gt.registros r
             where r.dispositivo = new.dispositivo and r.ts_cliente >= v_ini group by 1) x
      join gt.empleados e on e.id = x.empleado_id;
    perform public.tg_enqueue('📱 GT — un mismo celular usado hoy por varios operarios: ' || v_lista ||
      E'\nCelular: ' || left(new.dispositivo, 8),
      'gt-disp-compartido-' || new.dispositivo || '-' || to_char(v_ini at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') || '-' || v_ids, v_chat);
  end if;
  return null;
end $function$;
revoke all on function gt.trg_alerta_dispositivo() from public, anon, authenticated;
create trigger gt_alerta_dispositivo after insert on gt.registros
  for each row when (new.dispositivo is not null and new.dispositivo not like 'sistema%')
  execute function gt.trg_alerta_dispositivo();

-- ============ D34: cerrar solo lo que quedó abierto ============
-- Lun-vie 18:30 AR (cron gt-cierre-automatico '30 21 * * 1-5' UTC): cada área abierta de hoy se cierra a la
-- hora de salida de ese operario (o a la de apertura si abrió después), SIN cantidad, con
-- dispositivo = 'sistema:cierre'. Avisa la lista. Si después llega el cierre real del celular (cola offline),
-- el del sistema pasa a opcion 'AREAX' y deja de contar.
create or replace function gt.cierre_automatico(p_enviar boolean default true)
 returns text language plpgsql security definer set search_path to ''
as $function$
declare
  v_d date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_ini timestamptz := v_d::timestamp at time zone 'America/Argentina/Buenos_Aires';
  v_sa time := coalesce((select valor from gt.config where clave = 'hora_salida'), '17:30')::time;
  v_chat text := coalesce((select valor from gt.config where clave = 'telegram_chat'), '-1004379879565');
  r record; v_cierre timestamptz; v_lista text := '';
begin
  for r in
    select a.*, e.nombre, ru.nombre area,
           ((v_d + coalesce(hd.salida, h.salida, v_sa)) at time zone 'America/Argentina/Buenos_Aires') salida
      from gt.registros a
      join gt.empleados e on e.id = a.empleado_id
      left join gt.rubros ru on ru.codigo = a.rubro
      left join gt.horario_empleado h on h.empleado_id = a.empleado_id
      left join gt.horario_dia hd on hd.empleado_id = a.empleado_id and hd.dow = extract(isodow from v_d)
     where a.opcion = 'AREA' and a.ts_inicio is null and a.ts_cliente >= v_ini
       and not exists (select 1 from gt.registros c where c.empleado_id = a.empleado_id and c.rubro = a.rubro
                         and c.opcion = 'AREA' and c.ts_inicio = a.ts_cliente)
     order by e.nombre
  loop
    v_cierre := least(now(), greatest(r.ts_cliente, r.salida));
    insert into gt.registros (client_id, empleado_id, opcion, rubro, cantidad, descripcion, texto, ts_cliente, ts_inicio, dispositivo)
    values ('auto-cierre-' || r.id, r.empleado_id, 'AREA', r.rubro, null, 'Cerrado por el sistema (no tocó Terminé)',
            r.texto, v_cierre, r.ts_cliente, 'sistema:cierre')
    on conflict (client_id) do nothing;
    v_lista := v_lista || E'\n• ' || r.nombre || ' — ' || coalesce(r.area, r.rubro) || coalesce(' · ' || r.texto, '') ||
               ' desde ' || to_char(r.ts_cliente at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') ||
               ' (cerrado ' || to_char(v_cierre at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') || ', sin cantidad)';
  end loop;
  if v_lista = '' then return null; end if;
  v_lista := '🔒 GT — cerré solo lo que quedó abierto ' || to_char(v_d, 'DD/MM') || ':' || v_lista;
  if p_enviar then perform public.tg_enqueue(v_lista, 'gt-cierre-auto-' || v_d::text, v_chat); end if;
  return v_lista;
end $function$;
revoke all on function gt.cierre_automatico(boolean) from public, anon, authenticated;

create or replace function gt.trg_cierre_real_reemplaza()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
begin
  update gt.registros s set opcion = 'AREAX'
   where s.dispositivo = 'sistema:cierre' and s.opcion = 'AREA'
     and s.empleado_id = new.empleado_id and s.rubro = new.rubro and s.ts_inicio = new.ts_inicio;
  return new;
end $function$;
revoke all on function gt.trg_cierre_real_reemplaza() from public, anon, authenticated;
create trigger gt_cierre_real_reemplaza before insert on gt.registros
  for each row when (new.opcion = 'AREA' and new.ts_inicio is not null and coalesce(new.dispositivo, '') not like 'sistema%')
  execute function gt.trg_cierre_real_reemplaza();

select cron.schedule('gt-cierre-automatico', '30 21 * * 1-5', 'select gt.cierre_automatico()');

-- ============ Producción del admin con la marca «cerrado solo» ============
create or replace function public.gt_admin_produccion2(p_pass text, p_dia date default null)
 returns table(empleado text, area text, rubro text, codigo text, descripcion text, desde timestamptz, hasta timestamptz,
               cantidad numeric, unidad text, uxb integer, unidades numeric, auto boolean)
 language sql stable security definer set search_path to ''
as $function$
  with par as (select coalesce(p_dia, (now() at time zone 'America/Argentina/Buenos_Aires')::date) d),
  hoy as (select r.* from gt.registros r, par
           where r.opcion = 'AREA' and r.rubro <> 'ALMU'
             and r.ts_cliente >= par.d::timestamp at time zone 'America/Argentina/Buenos_Aires'
             and r.ts_cliente <  (par.d + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),
  tramos as (
    select c.empleado_id, c.rubro, c.texto, c.ts_inicio desde, c.ts_cliente hasta, c.cantidad, c.dispositivo = 'sistema:cierre' auto
      from hoy c where c.ts_inicio is not null
    union all
    select a.empleado_id, a.rubro, a.texto, a.ts_cliente, null, null, false from hoy a
     where a.ts_inicio is null
       and not exists (select 1 from hoy c where c.empleado_id = a.empleado_id and c.rubro = a.rubro and c.ts_inicio = a.ts_cliente))
  select e.nombre, ru.nombre, t.rubro, t.texto, coalesce(cr.descripcion, co.descripcion), t.desde, t.hasta, t.cantidad, ru.unidad, co.uxb,
         case when ru.unidad ilike 'cajas%' and co.uxb is not null then t.cantidad * co.uxb end, coalesce(t.auto, false)
    from tramos t join gt.empleados e on e.id = t.empleado_id join gt.rubros ru on ru.codigo = t.rubro
    left join gt.codigos co on upper(co.codigo) = upper(btrim(t.texto))
    left join gt.codigos_rubro cr on cr.rubro = t.rubro and upper(cr.codigo) = upper(btrim(t.texto))
   where gt.pass_ok(p_pass)
   order by gt.legajo_num(e.legajo) nulls last, e.nombre, t.desde;
$function$;
revoke all on function public.gt_admin_produccion2(text, date) from public;
grant execute on function public.gt_admin_produccion2(text, date) to anon, authenticated;

-- ============ D35: ritmo por operario ============
-- Por operario y área, en el día: lo hecho (en UNIDADES si el área cuenta cajas y el código tiene UxB; si no,
-- en la unidad del área), las horas de los tramos con cantidad y el ritmo por hora; al lado, el ritmo
-- promedio del ÁREA (todos los operarios) en las 4 semanas anteriores al día.
create or replace function public.gt_admin_ritmo(p_pass text, p_dia date default null)
 returns table(empleado text, legajo text, area text, rubro text, unidad text, hecho numeric, horas numeric,
               por_hora numeric, prom_area numeric, tramos int)
 language sql stable security definer set search_path to ''
as $function$
  with par as (select coalesce(p_dia, (now() at time zone 'America/Argentina/Buenos_Aires')::date) d),
  base as (
    select c.empleado_id, c.rubro, (c.ts_cliente at time zone 'America/Argentina/Buenos_Aires')::date dia,
           extract(epoch from c.ts_cliente - c.ts_inicio) / 3600.0 h,
           case when ru.unidad ilike 'cajas%' and co.uxb is not null then c.cantidad * co.uxb else c.cantidad end v,
           case when ru.unidad ilike 'cajas%' and co.uxb is not null then 'unidades' else ru.unidad end u
      from gt.registros c
      join gt.rubros ru on ru.codigo = c.rubro
      left join gt.codigos co on upper(co.codigo) = upper(btrim(c.texto))
     where c.opcion = 'AREA' and c.rubro <> 'ALMU' and c.ts_inicio is not null and c.cantidad is not null
       and c.ts_cliente - c.ts_inicio >= interval '2 minutes'   -- un toque de segundos no es un ritmo
       and c.ts_cliente >= ((select d from par) - 28)::timestamp at time zone 'America/Argentina/Buenos_Aires'
       and c.ts_cliente <  ((select d from par) + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),
  prom as (select rubro, u, sum(v) / nullif(sum(h), 0) ph from base, par where dia < par.d group by 1, 2),
  hoy as (select empleado_id, rubro, u, sum(v) v, sum(h) h, count(*)::int n from base, par where dia = par.d group by 1, 2, 3)
  select e.nombre, e.legajo, ru.nombre, x.rubro, x.u, round(x.v, 2), round(x.h::numeric, 2),
         case when x.h >= 0.25 then round((x.v / x.h)::numeric, 1) end   -- menos de 15 min: no se informa, round(p.ph::numeric, 1), x.n
    from hoy x join gt.empleados e on e.id = x.empleado_id join gt.rubros ru on ru.codigo = x.rubro
    left join prom p on p.rubro = x.rubro and p.u = x.u
   where gt.pass_ok(p_pass)
   order by gt.legajo_num(e.legajo) nulls last, e.nombre, ru.orden;
$function$;
revoke all on function public.gt_admin_ritmo(text, date) from public;
grant execute on function public.gt_admin_ritmo(text, date) to anon, authenticated;

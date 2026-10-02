-- GT gt_v151 (Elías, 02/10/2026, D45: «se puede hacer que uno ponga y le aparezca al otro como pregunta: Vas a hacer
-- (tarea) con (persona) · Sí / No»). Encolado y Contraído se hacen de a dos.
-- · Quien empieza elige con quién: su apertura lleva detalle.pareja = 'con <Nombre>'. El trigger gt_pareja_invita deja
--   la invitación en gt.parejas (pendiente).
-- · El celular del compañero pregunta cada 15 s (gt_parejas_pendientes) y muestra «¿Vas a hacer Encolado · 173 con Luis?».
--   Sí → gt_pareja_responder(…, true) y le abre el mismo código, con detalle.pareja = 'con Luis' y detalle._invitado = id
--   (no carga cajas al terminar). No → rechazada, no se abre nada. Una invitación vence a los 20 min sin respuesta.
-- · Probado en transacción abortada: Javier invita a Lautaro en Encolado · 173 → pendiente, Lautaro la ve («Cuadro Mold 03
--   Grafic Work») · llega la apertura de Lautaro con _invitado → aceptada, y no se crea otra invitación de vuelta.
-- · gt.detalle_txt no muestra las claves que empiezan con «_» (el _invitado).
-- · gt_admin_rendimiento: el tramo con cajas de quien invitó cuenta también para el compañero que aceptó (mismo número:
--   lo que tarda la pareja por unidad; el «×2 en mano de obra» es D47).
-- ROLLBACK: la app 1.39 deja de mandar «pareja»; sin eso no se crean invitaciones. La tabla y las funciones quedan inocuas.

create table if not exists gt.parejas (
  id bigint generated always as identity primary key,
  client_id text unique,                 -- la apertura de quien invita
  de_id bigint not null references gt.empleados (id),
  para_id bigint not null references gt.empleados (id),
  rubro text not null, texto text, medida text, planta text,
  ts timestamptz not null,               -- la hora de esa apertura (con ella se encuentra su cierre)
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada')),
  respondida timestamptz,
  creada timestamptz not null default now());
alter table gt.parejas enable row level security;
revoke all on gt.parejas from anon, authenticated;
comment on table gt.parejas is 'gt_v151 (D45, Elías): invitaciones de pareja en Encolado / Contraído. Pendiente → aceptada / rechazada; vence a los 20 min.';

create or replace function gt.trg_pareja_invita() returns trigger
language plpgsql security definer set search_path to '' as $function$
declare v_para bigint;
begin
  select e.id into v_para from gt.empleados e
   where e.activo and e.nombre = btrim(regexp_replace(new.detalle->>'pareja', '^con\s+', ''));
  if v_para is not null and v_para <> new.empleado_id then
    insert into gt.parejas (client_id, de_id, para_id, rubro, texto, medida, planta, ts)
    values (new.client_id, new.empleado_id, v_para, new.rubro, new.texto, new.medida, new.planta, new.ts_cliente)
    on conflict (client_id) do nothing;
  end if;
  return null;
exception when others then
  return null;   -- una invitación que no se pudo crear nunca frena el registro
end $function$;
create or replace trigger gt_pareja_invita after insert on gt.registros for each row
  when (new.opcion = 'AREA' and new.ts_inicio is null and new.detalle ? 'pareja' and not (new.detalle ? '_invitado'))
  execute function gt.trg_pareja_invita();

create or replace function public.gt_parejas_pendientes(p_empleado bigint) returns json
language sql stable security definer set search_path to '' as $function$
  select coalesce(json_agg(json_build_object('id', p.id, 'de', e.nombre, 'rubro', p.rubro, 'area', r.nombre, 'texto', p.texto,
           'descripcion', coalesce(c.descripcion, k.descripcion), 'medida', p.medida, 'medida_cod', coalesce(c.medida, k.medida),
           'planta', p.planta, 'ts', p.ts) order by p.ts), '[]'::json)
    from gt.parejas p join gt.empleados e on e.id = p.de_id join gt.rubros r on r.codigo = p.rubro
    left join gt.codigos c on upper(c.codigo) = upper(btrim(p.texto))
    left join gt.codigos_rubro k on k.rubro = p.rubro and upper(k.codigo) = upper(btrim(p.texto))
   where p.para_id = p_empleado and p.estado = 'pendiente' and p.creada > now() - interval '20 minutes';
$function$;

create or replace function public.gt_pareja_responder(p_id bigint, p_empleado bigint, p_si boolean) returns json
language plpgsql security definer set search_path to '' as $function$
declare n int;
begin
  update gt.parejas set estado = case when p_si then 'aceptada' else 'rechazada' end, respondida = now()
   where id = p_id and para_id = p_empleado and estado = 'pendiente';
  get diagnostics n = row_count;
  return json_build_object('ok', n = 1);
end $function$;

-- La apertura del compañero (detalle._invitado) deja la invitación aceptada: así cuenta aunque el celular haya contestado
-- sin red (la apertura llega con la cola). El «No» sí va por gt_pareja_responder.
create or replace function gt.trg_pareja_acepta() returns trigger
language plpgsql security definer set search_path to '' as $function$
begin
  update gt.parejas set estado = 'aceptada', respondida = coalesce(respondida, new.ts_cliente)
   where id = case when (new.detalle->>'_invitado') ~ '^\d+$' then (new.detalle->>'_invitado')::bigint end
     and para_id = new.empleado_id and estado <> 'aceptada';
  return null;
exception when others then
  return null;
end $function$;
create or replace trigger gt_pareja_acepta after insert on gt.registros for each row
  when (new.opcion = 'AREA' and new.ts_inicio is null and new.detalle ? '_invitado')
  execute function gt.trg_pareja_acepta();

revoke all on function public.gt_parejas_pendientes(bigint) from public;
revoke all on function public.gt_pareja_responder(bigint, bigint, boolean) from public;
grant execute on function public.gt_parejas_pendientes(bigint) to anon, authenticated, service_role;
grant execute on function public.gt_pareja_responder(bigint, bigint, boolean) to anon, authenticated, service_role;

create or replace function gt.detalle_txt(d jsonb) returns text
language sql immutable set search_path to '' as $function$
  select case when d is null or d = '{}'::jsonb then null
              when d->>'anilina' = 'No' then 'sin anilina'
              when d->>'anilina' = 'Sí' then 'anilina ' || coalesce(d->>'color', '?')
              -- gt_v151: las claves con «_» son internas (el _invitado de una pareja)
              else (select string_agg(j.v, ' · ') from jsonb_each_text(d) j(k, v) where j.k !~ '^_') end
$function$;

create or replace function public.gt_admin_rendimiento(p_pass text, p_desde date default null, p_hasta date default null)
returns json language sql stable security definer set search_path to '' as $function$
  with par as (select coalesce(p_hasta, (now() at time zone 'America/Argentina/Buenos_Aires')::date) h,
                      coalesce(p_desde, coalesce(p_hasta, (now() at time zone 'America/Argentina/Buenos_Aires')::date) - 27) d),
  base as (
    select c.empleado_id, c.rubro, c.ts_inicio ini,
           coalesce(gt.variable_rendimiento(c.rubro, c.texto, c.medida),
                    case when coalesce(btrim(c.texto), '') = '' then 'Sin código' else 'Código ' || upper(btrim(c.texto)) end) variable,
           extract(epoch from c.ts_cliente - c.ts_inicio) - coalesce(pz.seg, 0) seg,
           case when ru.unidad ilike 'cajas%' and co.uxb is not null then c.cantidad * co.uxb else c.cantidad end u
      from gt.registros c
      join gt.rubros ru on ru.codigo = c.rubro
      left join gt.codigos co on upper(co.codigo) = upper(btrim(c.texto))
      left join lateral (select sum(extract(epoch from p.ts_cliente - p.ts_inicio)) seg
                           from gt.registros p join gt.rubros pr on pr.codigo = p.rubro and not pr.productivo
                          where p.empleado_id = c.empleado_id and p.opcion = 'AREA' and p.ts_inicio is not null
                            and p.ts_inicio >= c.ts_inicio and p.ts_cliente <= c.ts_cliente
                            and not exists (select 1 from gt.registros q join gt.rubros qr on qr.codigo = q.rubro and not qr.productivo
                                             where q.empleado_id = p.empleado_id and q.opcion = 'AREA' and q.ts_inicio is not null
                                               and q.id <> p.id and q.ts_inicio <= p.ts_inicio and q.ts_cliente >= p.ts_cliente
                                               and q.ts_inicio >= c.ts_inicio and q.ts_cliente <= c.ts_cliente)) pz on true
     where c.opcion = 'AREA' and c.ts_inicio is not null and c.cantidad is not null and c.cantidad > 0
       and c.rubro in ('CORTE', 'GRAMP', 'ENCOL', 'MONT', 'GANCHO', 'EMBL', 'CONTR')
       and c.ts_cliente >= (select d from par)::timestamp at time zone 'America/Argentina/Buenos_Aires'
       and c.ts_cliente <  ((select h from par) + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),
  -- gt_v151 (D45): el tramo de quien invitó cuenta también para el compañero que aceptó
  tr as (select empleado_id, rubro, variable, seg, u from base
         union all
         select pa.para_id, b.rubro, b.variable, b.seg, b.u
           from base b join gt.parejas pa on pa.de_id = b.empleado_id and pa.rubro = b.rubro and pa.ts = b.ini and pa.estado = 'aceptada'),
  ag as (
    select ru.nombre area, ru.codigo rubro, ru.orden, t.variable, e.nombre empleado, e.legajo,
           sum(t.u) unidades, round(sum(t.seg)) segundos, count(*)::int tramos
      from tr t join gt.empleados e on e.id = t.empleado_id join gt.rubros ru on ru.codigo = t.rubro
     where t.seg >= 120
     group by 1, 2, 3, 4, 5, 6)
  select case when gt.pass_ok(p_pass) then
    json_build_object('desde', (select d from par), 'hasta', (select h from par),
      'filas', coalesce((select json_agg(ag order by ag.orden, ag.variable, gt.legajo_num(ag.legajo) nulls last, ag.empleado) from ag), '[]'::json))
  end
$function$;

-- gt_v152 (1.40, Elías: «entró directo sin preguntar por acompañante»): la lista de compañeros sale de la base en cada
-- entrada, no sólo al poner el código (una sesión del día abierta antes de la 1.39 no la tenía y arrancaba solo).
create or replace function public.gt_companeros(p_empleado bigint) returns json
language sql stable security definer set search_path to '' as $function$
  select case when exists (select 1 from gt.empleados x where x.id = p_empleado and x.activo) then
    coalesce((select json_agg(json_build_object('id', e.id, 'nombre', e.nombre,
              'plantas', coalesce((select json_agg(ep.planta order by ep.planta) from gt.empleado_planta ep
                                    join gt.plantas p on p.codigo = ep.planta and p.activo where ep.empleado_id = e.id),
                                  json_build_array(gt.planta_principal())))
              order by gt.legajo_num(e.legajo) nulls last, e.nombre)
       from gt.empleados e where e.activo and e.id <> p_empleado), '[]'::json)
  else '[]'::json end
$function$;
revoke all on function public.gt_companeros(bigint) from public;
grant execute on function public.gt_companeros(bigint) to anon, authenticated, service_role;

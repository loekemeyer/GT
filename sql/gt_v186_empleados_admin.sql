-- ⚠ BORRADOR SIN APLICAR (30/10/2026): el conector de Supabase pidió una confirmación (por los delete que hay dentro de las funciones) y no hubo respuesta. Nada de esto está en la base todavía.
-- gt_v186 (30/10/2026): módulo «👥 Empleados» del admin: alta, baja y horario por día (Angely, 30/10/2026).
--   «agregues un módulo para ingresar o dar de baja a los empleados… no solo ingresar sus datos sino también su horario, para que el
--    programa pueda controlar su fichada»
-- Todo escribe en las tablas que ya existían: gt.empleados (nombre, legajo, activo), gt.empleado_planta (plantas), gt.horario_dia (un renglón por
-- día de la semana, dow 1 = lunes a 7 = domingo) y gt.horario_empleado (almuerzo flexible). Mandan en este orden (gt.jornada_estado, Asistencia, cierre
-- automático): horario del día > horario del empleado > gt.config (08:00 · almuerzo 12:00-13:00 · 17:30 · tolerancia 5).
-- Nuevo: gt.horario_dia.libre (el día de franco: no se espera que fiche) y gt.empleados.baja_en (cuándo se dio de baja).
-- La BAJA no borra nada: activo = false. El historial (registros, producción, ritmo) queda, y el empleado deja de salir en «¿Sos…?», en Asistencia y en los avisos.
-- Las funciones exigen la clave del monitor (gt.pass_ok), como el resto del admin.
--   gt_admin_empleados(p_pass, p_bajas)      lista (con su horario) · las personas de prueba no salen
--   gt_admin_horario_general(p_pass)         el horario general (gt.config) y las plantas, para prellenar el formulario
--   gt_admin_empleado_guardar(...)           alta (p_id null) o cambio; reemplaza plantas y horario completos
--   gt_admin_empleado_baja(p_pass, id, activo) baja (false) o reactivación (true)
-- Rollback: alter table gt.horario_dia drop column libre · alter table gt.empleados drop column baja_en · drop function de las 4 (SQL Editor: el conector no deja DROP).
-- Sin punto y coma dentro de textos ni comentarios (el conector parte el pedido por esa marca).
alter table gt.horario_dia add column if not exists libre boolean not null default false;
alter table gt.empleados add column if not exists baja_en timestamptz;

create or replace function public.gt_admin_empleados(p_pass text, p_bajas boolean default true)
returns table (id bigint, nombre text, legajo text, activo boolean, baja_en timestamptz, plantas text[], flexible boolean, con_horario boolean, horario jsonb)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.nombre, e.legajo, e.activo, e.baja_en,
         coalesce((select array_agg(p.planta order by p.planta) from gt.empleado_planta p where p.empleado_id = e.id), '{}'::text[]),
         coalesce(h.almuerzo_flexible, false),
         exists (select 1 from gt.horario_dia d where d.empleado_id = e.id),
         coalesce((select jsonb_agg(jsonb_build_object('dow', d.dow, 'libre', d.libre, 'entrada', to_char(d.entrada, 'HH24:MI'),
                                                       'almuerzo_desde', to_char(d.almuerzo_desde, 'HH24:MI'), 'almuerzo_hasta', to_char(d.almuerzo_hasta, 'HH24:MI'),
                                                       'sin_almuerzo', d.sin_almuerzo, 'salida', to_char(d.salida, 'HH24:MI')) order by d.dow)
                     from gt.horario_dia d where d.empleado_id = e.id), '[]'::jsonb)
    from gt.empleados e
    left join gt.horario_empleado h on h.empleado_id = e.id
   where gt.pass_ok(p_pass) and not e.prueba and (e.activo or p_bajas)
   order by e.activo desc, gt.legajo_num(e.legajo) nulls last, e.nombre;
$$;

create or replace function public.gt_admin_horario_general(p_pass text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when not gt.pass_ok(p_pass) then jsonb_build_object('ok', false) else jsonb_build_object(
    'ok', true,
    'entrada', coalesce((select valor from gt.config where clave = 'hora_entrada'), '08:00'),
    'almuerzo_desde', coalesce((select valor from gt.config where clave = 'almuerzo_desde'), '12:00'),
    'almuerzo_hasta', coalesce((select valor from gt.config where clave = 'almuerzo_hasta'), '13:00'),
    'salida', coalesce((select valor from gt.config where clave = 'hora_salida'), '17:30'),
    'tolerancia_min', coalesce((select valor from gt.config where clave = 'tolerancia_min'), '5')::int,
    'principal', gt.planta_principal(),
    'plantas', coalesce((select jsonb_agg(jsonb_build_object('codigo', p.codigo, 'nombre', p.nombre) order by p.orden, p.codigo) from gt.plantas p where p.activo), '[]'::jsonb)) end;
$$;

create or replace function public.gt_admin_empleado_guardar(p_pass text, p_id bigint, p_nombre text, p_legajo text,
                                                              p_plantas text[], p_flexible boolean, p_horario jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_id bigint := p_id;
  v_nombre text := regexp_replace(btrim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  v_legajo text := nullif(btrim(coalesce(p_legajo, '')), '');
  v_pr text := gt.planta_principal();
  v_flex boolean := coalesce(p_flexible, false);
  v_pl text[] := coalesce(p_plantas, array[]::text[]);
  v_dias text[] := array['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  d jsonb; v_dow int; v_libre boolean; v_ent time; v_sal time; v_ad time; v_ah time; v_sin boolean;
  v_vistos int[] := '{}'; v_trab int := 0;
begin
  if not gt.pass_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'clave'); end if;
  if v_nombre = '' then return jsonb_build_object('ok', false, 'error', 'nombre', 'mensaje', 'Falta el nombre'); end if;
  if jsonb_typeof(p_horario) is distinct from 'array' then return jsonb_build_object('ok', false, 'error', 'horario', 'mensaje', 'Falta el horario'); end if;
  begin
    for d in select value from jsonb_array_elements(p_horario) loop
      v_dow := (d->>'dow')::int;
      if v_dow is null or v_dow not between 1 and 7 or v_dow = any(v_vistos) then
        return jsonb_build_object('ok', false, 'error', 'horario', 'mensaje', 'Día repetido o inválido');
      end if;
      v_vistos := v_vistos || v_dow;
      v_libre := coalesce((d->>'libre')::boolean, false);
      continue when v_libre;
      v_ent := nullif(d->>'entrada', '')::time; v_sal := nullif(d->>'salida', '')::time;
      v_ad := nullif(d->>'almuerzo_desde', '')::time; v_ah := nullif(d->>'almuerzo_hasta', '')::time;
      v_sin := coalesce((d->>'sin_almuerzo')::boolean, false);
      if v_ent is null or v_sal is null or v_ent >= v_sal then
        return jsonb_build_object('ok', false, 'error', 'horario', 'mensaje', 'El ' || v_dias[v_dow] || ': la entrada tiene que ser antes que la salida');
      end if;
      if not v_sin and not v_flex and (v_ad is null or v_ah is null or not (v_ent < v_ad and v_ad < v_ah and v_ah < v_sal)) then
        return jsonb_build_object('ok', false, 'error', 'horario', 'mensaje', 'El ' || v_dias[v_dow] || ': el almuerzo tiene que quedar entre la entrada y la salida');
      end if;
      v_trab := v_trab + 1;
    end loop;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'formato', 'mensaje', 'Hay una hora mal escrita');
  end;
  if v_trab = 0 then return jsonb_build_object('ok', false, 'error', 'horario', 'mensaje', 'Tiene que trabajar al menos un día'); end if;
  if exists (select 1 from unnest(v_pl) x where not exists (select 1 from gt.plantas p where p.codigo = x and p.activo)) then
    return jsonb_build_object('ok', false, 'error', 'plantas', 'mensaje', 'Planta inexistente');
  end if;
  begin
    if v_id is null then
      insert into gt.empleados (nombre, legajo) values (v_nombre, v_legajo) returning id into v_id;
    else
      update gt.empleados set nombre = v_nombre, legajo = v_legajo where id = v_id and not prueba;
      if not found then return jsonb_build_object('ok', false, 'error', 'no_existe', 'mensaje', 'No existe ese empleado'); end if;
    end if;
  exception when unique_violation then
    if v_legajo is not null and exists (select 1 from gt.empleados e where e.legajo = v_legajo and e.id is distinct from v_id) then
      return jsonb_build_object('ok', false, 'error', 'legajo', 'mensaje', 'Ese legajo ya lo tiene otra persona');
    end if;
    return jsonb_build_object('ok', false, 'error', 'nombre', 'mensaje', 'Ya hay alguien con ese nombre');
  end;
  delete from gt.empleado_planta where empleado_id = v_id;
  if cardinality(v_pl) > 0 and v_pl is distinct from array[v_pr] then
    insert into gt.empleado_planta (empleado_id, planta) select v_id, x from unnest(v_pl) x group by x;
  end if;
  insert into gt.horario_empleado (empleado_id, almuerzo_flexible, nota)
  values (v_id, v_flex, 'Cargado desde el admin ' || to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY'))
  on conflict (empleado_id) do update set almuerzo_flexible = excluded.almuerzo_flexible;
  delete from gt.horario_dia where empleado_id = v_id;
  insert into gt.horario_dia (empleado_id, dow, entrada, almuerzo_desde, almuerzo_hasta, salida, sin_almuerzo, nota, libre)
  select v_id, (x->>'dow')::int,
         case when l.lib then null else nullif(x->>'entrada', '')::time end,
         case when l.lib or l.sin or v_flex then null else nullif(x->>'almuerzo_desde', '')::time end,
         case when l.lib or l.sin or v_flex then null else nullif(x->>'almuerzo_hasta', '')::time end,
         case when l.lib then null else nullif(x->>'salida', '')::time end,
         (not l.lib) and l.sin,
         'Admin GT ' || to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY'),
         l.lib
    from jsonb_array_elements(p_horario) x
   cross join lateral (select coalesce((x->>'libre')::boolean, false) as lib, coalesce((x->>'sin_almuerzo')::boolean, false) as sin) l;
  return jsonb_build_object('ok', true, 'id', v_id, 'nombre', v_nombre);
end $$;

create or replace function public.gt_admin_empleado_baja(p_pass text, p_id bigint, p_activo boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_nombre text;
begin
  if not gt.pass_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'clave'); end if;
  update gt.empleados set activo = coalesce(p_activo, false), baja_en = case when coalesce(p_activo, false) then null else now() end
   where id = p_id and not prueba and activo is distinct from coalesce(p_activo, false)
   returning nombre into v_nombre;
  if not found then return jsonb_build_object('ok', false, 'error', 'sin_cambio', 'mensaje', 'No existe o ya estaba así'); end if;
  return jsonb_build_object('ok', true, 'id', p_id, 'nombre', v_nombre, 'activo', coalesce(p_activo, false));
end $$;

revoke all on function public.gt_admin_empleados(text, boolean) from public;
revoke all on function public.gt_admin_horario_general(text) from public;
revoke all on function public.gt_admin_empleado_guardar(text, bigint, text, text, text[], boolean, jsonb) from public;
revoke all on function public.gt_admin_empleado_baja(text, bigint, boolean) from public;
grant execute on function public.gt_admin_empleados(text, boolean) to anon, authenticated;
grant execute on function public.gt_admin_horario_general(text) to anon, authenticated;
grant execute on function public.gt_admin_empleado_guardar(text, bigint, text, text, text[], boolean, jsonb) to anon, authenticated;
grant execute on function public.gt_admin_empleado_baja(text, bigint, boolean) to anon, authenticated;

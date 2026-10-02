-- GT gt_v155 (1.45, Elías, 02/10/2026): «vamos a cambiar cómo se hacen las tareas de a 2. Uno inicia la tarea y al otro, al
-- entrar en Encolado, ya le aparece la que inició el compañero y se une. Las unidades las pone el que empezó la tarea y se le
-- notifica que él tiene que poner las unidades (o lo que corresponda de esa tarea)».
-- Reemplaza el «¿Con quién?» y la invitación Sí / No de gt_v151 (1.39). La pareja queda igual en gt.parejas (aceptada, una
-- por tramo) y el que se suma lleva detalle._invitado: el Rendimiento repartido por tiempo (gt_v153) no cambia.
-- Probado en transacción abortada: Ximena empieza Encolado 173 → a Walter le aparece («Ximena Ortiz · 173 Cuadro Mold 03
-- Grafic Work 10*30»), también con Ximena en el baño · Walter se suma → pareja aceptada, _invitado en su apertura, «con Walter
-- Saucedo» en la de Ximena, sin invitación vieja · a Luis ya no le aparece · aviso a Ximena «Walter Saucedo · Encolado ·
-- 173» · cerrado el tramo, ni avisos ni para sumarse.
-- ROLLBACK: la app 1.44 vuelve a «¿Con quién?»; estas funciones y el trigger quedan inocuos (sin _une no hacen nada).

-- 1) lo que se está haciendo en un área y se puede sumar uno: aperturas de hoy de otros, sin cierre, que no son de un
--    compañero que se sumó y que todavía no tienen compañero
create or replace function public.gt_pareja_abiertos(p_empleado bigint, p_rubro text) returns json
language sql stable security definer set search_path to '' as $function$
  select coalesce(json_agg(json_build_object('client_id', a.client_id, 'de', e.nombre, 'empleado_id', a.empleado_id, 'rubro', a.rubro,
           'texto', a.texto, 'medida', a.medida, 'descripcion', c.descripcion, 'medida_cod', c.medida, 'planta', a.planta, 'ts', a.ts_cliente)
           order by a.ts_cliente desc), '[]'::json)
    from gt.registros a
    join gt.empleados e on e.id = a.empleado_id and e.activo
    left join gt.codigos c on upper(c.codigo) = upper(btrim(a.texto))
   where exists (select 1 from gt.empleados x where x.id = p_empleado and x.activo)
     and a.opcion = 'AREA' and a.ts_inicio is null and a.rubro = p_rubro and a.empleado_id <> p_empleado
     and a.ts_cliente >= ((now() at time zone 'America/Argentina/Buenos_Aires')::date)::timestamp at time zone 'America/Argentina/Buenos_Aires'
     and not (coalesce(a.detalle, '{}'::jsonb) ?| array['_une', '_invitado'])
     and not exists (select 1 from gt.registros k where k.empleado_id = a.empleado_id and k.rubro = a.rubro
                       and k.ts_inicio = a.ts_cliente and k.opcion in ('AREA', 'AREAX'))
     and not exists (select 1 from gt.registros n where n.empleado_id = a.empleado_id and n.ts_cliente > a.ts_cliente
                       and (n.opcion = 'FIN' or (n.opcion = 'AREA' and n.ts_inicio is null
                            and n.rubro in (select r.codigo from gt.rubros r where r.productivo))))
     and not exists (select 1 from gt.parejas p where p.client_id = a.client_id and p.estado = 'aceptada')
$function$;

-- 2) el que se suma manda su apertura con detalle._une = client_id de la apertura del que empezó. La base deja la pareja
--    aceptada, le pone a esa apertura _invitado (lo que lee gt_admin_rendimiento) y a la del que empezó «pareja = con <nombre>»
create or replace function gt.trg_pareja_une() returns trigger
language plpgsql security definer set search_path to '' as $function$
declare l record; v_id bigint; v_nom text;
begin
  select * into l from gt.registros where client_id = new.detalle->>'_une' and opcion = 'AREA' and ts_inicio is null;
  if not found or l.empleado_id = new.empleado_id then return null; end if;
  insert into gt.parejas (client_id, de_id, para_id, rubro, texto, medida, planta, ts, estado, respondida)
  values (l.client_id, l.empleado_id, new.empleado_id, l.rubro, l.texto, l.medida, l.planta, l.ts_cliente, 'aceptada', new.ts_cliente)
  on conflict (client_id) do nothing returning id into v_id;
  if v_id is null then return null; end if;
  select nombre into v_nom from gt.empleados where id = new.empleado_id;
  update gt.registros set detalle = coalesce(detalle, '{}'::jsonb) || jsonb_build_object('_invitado', v_id) where id = new.id;
  update gt.registros set detalle = coalesce(detalle, '{}'::jsonb) || jsonb_build_object('pareja', 'con ' || v_nom) where id = l.id;
  return null;
exception when others then
  return null;
end $function$;
create or replace trigger gt_pareja_une after insert on gt.registros for each row
  when (new.opcion = 'AREA' and new.ts_inicio is null and new.detalle ? '_une')
  execute function gt.trg_pareja_une();

-- la invitación vieja (1.39) no sale de la apertura del que se suma
create or replace trigger gt_pareja_invita after insert on gt.registros for each row
  when (new.opcion = 'AREA' and new.ts_inicio is null and new.detalle ? 'pareja' and not (new.detalle ? '_invitado') and not (new.detalle ? '_une'))
  execute function gt.trg_pareja_invita();

-- 3) al que empezó: quién se le sumó, mientras su tramo sigue abierto (el celular avisa una vez)
create or replace function public.gt_pareja_avisos(p_empleado bigint) returns json
language sql stable security definer set search_path to '' as $function$
  select coalesce(json_agg(json_build_object('id', p.id, 'client_id', p.client_id, 'quien', e.nombre, 'rubro', p.rubro, 'area', r.nombre,
           'texto', p.texto, 'unidad', r.unidad, 'pide_cantidad', r.pide_cantidad) order by p.id), '[]'::json)
    from gt.parejas p join gt.empleados e on e.id = p.para_id join gt.rubros r on r.codigo = p.rubro
   where p.de_id = p_empleado and p.estado = 'aceptada' and p.creada > now() - interval '14 hours'
     and not exists (select 1 from gt.registros k where k.empleado_id = p.de_id and k.rubro = p.rubro
                       and k.ts_inicio = p.ts and k.opcion in ('AREA', 'AREAX'))
$function$;

revoke all on function public.gt_pareja_abiertos(bigint, text) from public;
revoke all on function public.gt_pareja_avisos(bigint) from public;
grant execute on function public.gt_pareja_abiertos(bigint, text) to anon, authenticated, service_role;
grant execute on function public.gt_pareja_avisos(bigint) to anon, authenticated, service_role;

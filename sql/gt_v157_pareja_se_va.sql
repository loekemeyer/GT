-- GT gt_v157 (Elías, 02/10/2026: D58 «sí»): cuando uno de los dos se va, se le avisa al otro, y si se fue el que se sumó,
-- otro compañero (o el mismo de vuelta) se puede sumar a ese tramo. Uno por vez.
-- · gt.parejas deja de ser «un compañero por tramo» (se saca la restricción única de client_id): cada vez que alguien se
--   suma es una fila. gt.pareja_adentro(id) = el que se sumó sigue en el tramo (su apertura sin cierre y sin otra cosa
--   productiva después).
-- · gt.trg_pareja_une: uno por vez (si hay alguien adentro, no se suma otro) y no a un tramo que ya terminó. La apertura del
--   que empezó dice «con Walter Saucedo y Luis Luna» si pasaron dos.
-- · public.gt_pareja_abiertos: vuelve a ofrecer el tramo cuando el que estaba se fue.
-- · public.gt_pareja_avisos2(empleado): lo que el celular revisa cada 5 s, en una llamada. «sumados»: al que empezó, quién
--   se le sumó y si ya se fue (se_fue). «terminados»: al que se sumó, que el que empezó ya terminó (fin, cantidad) y, si
--   arrancó otro tramo al que se puede sumar, «sigue». gt_pareja_avisos queda para los celulares con la 1.47.
-- · public.gt_admin_rendimiento: con más de un compañero en el tramo, las unidades se reparten entre los tres según el
--   tiempo de cada uno (antes el que empezó salía dos veces).
-- · gt.trg_pareja_invita (el «¿Con quién?» de la 1.39, sin uso desde la 1.45): «on conflict do nothing» sin la columna,
--   porque la restricción ya no está.
-- ROLLBACK: alter table gt.parejas add constraint parejas_client_id_key unique (client_id) (sólo si no hay dos filas con
--   el mismo client_id) · y las funciones de sql/gt_v155_pareja_unirse.sql y sql/gt_v153_rendimiento_pareja_por_tiempo.sql.

alter table gt.parejas drop constraint if exists parejas_client_id_key;
create index if not exists parejas_client_id_idx on gt.parejas (client_id);

CREATE OR REPLACE FUNCTION gt.pareja_adentro(p_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from gt.parejas p
      join gt.registros j on j.empleado_id = p.para_id and j.opcion = 'AREA' and j.ts_inicio is null
                         and j.detalle->>'_invitado' = p.id::text
     where p.id = p_id and p.estado = 'aceptada'
       and not exists (select 1 from gt.registros k where k.empleado_id = j.empleado_id and k.rubro = j.rubro
                         and k.ts_inicio = j.ts_cliente and k.opcion in ('AREA', 'AREAX'))
       and not exists (select 1 from gt.registros n where n.empleado_id = j.empleado_id and n.ts_cliente > j.ts_cliente
                         and (n.opcion = 'FIN' or (n.opcion = 'AREA' and n.ts_inicio is null
                              and n.rubro in (select r.codigo from gt.rubros r where r.productivo)))));
$function$;
revoke all on function gt.pareja_adentro(bigint) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION gt.trg_pareja_une()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare l record; v_id bigint; v_nom text;
begin
  select * into l from gt.registros where client_id = new.detalle->>'_une' and opcion = 'AREA' and ts_inicio is null;
  if not found or l.empleado_id = new.empleado_id then return null; end if;
  -- gt_v157: no a un tramo que ya había terminado cuando se sumó
  if exists (select 1 from gt.registros k where k.empleado_id = l.empleado_id and k.rubro = l.rubro and k.ts_inicio = l.ts_cliente
               and k.opcion in ('AREA', 'AREAX') and k.ts_cliente <= new.ts_cliente) then return null; end if;
  -- gt_v157 (D58): uno por vez. Si el que estaba se fue, se puede sumar otro (o el mismo de vuelta)
  perform pg_advisory_xact_lock(hashtext('gt.parejas ' || l.client_id));
  if exists (select 1 from gt.parejas p where p.client_id = l.client_id and gt.pareja_adentro(p.id)) then return null; end if;
  insert into gt.parejas (client_id, de_id, para_id, rubro, texto, medida, planta, ts, estado, respondida)
  values (l.client_id, l.empleado_id, new.empleado_id, l.rubro, l.texto, l.medida, l.planta, l.ts_cliente, 'aceptada', new.ts_cliente)
  returning id into v_id;
  update gt.registros set detalle = coalesce(detalle, '{}'::jsonb) || jsonb_build_object('_invitado', v_id) where id = new.id;
  select 'con ' || string_agg(s.nombre, ' y ' order by s.primero) into v_nom
    from (select e.nombre, min(p.id) primero from gt.parejas p join gt.empleados e on e.id = p.para_id
           where p.client_id = l.client_id and p.estado = 'aceptada' group by e.nombre) s;
  update gt.registros set detalle = coalesce(detalle, '{}'::jsonb) || jsonb_build_object('pareja', v_nom) where id = l.id;
  return null;
exception when others then
  return null;
end $function$;

CREATE OR REPLACE FUNCTION gt.trg_pareja_invita()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_para bigint;
begin
  select e.id into v_para from gt.empleados e
   where e.activo and e.nombre = btrim(regexp_replace(new.detalle->>'pareja', '^con\s+', ''));
  if v_para is not null and v_para <> new.empleado_id then
    insert into gt.parejas (client_id, de_id, para_id, rubro, texto, medida, planta, ts)
    values (new.client_id, new.empleado_id, v_para, new.rubro, new.texto, new.medida, new.planta, new.ts_cliente)
    on conflict do nothing;
  end if;
  return null;
exception when others then
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.gt_pareja_abiertos(p_empleado bigint, p_rubro text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
     -- gt_v157 (D58): sólo mientras el compañero que se sumó sigue adentro; si se fue, se vuelve a ofrecer
     and not exists (select 1 from gt.parejas p where p.client_id = a.client_id and gt.pareja_adentro(p.id))
$function$;

CREATE OR REPLACE FUNCTION public.gt_pareja_avisos2(p_empleado bigint)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with suyos as (   -- al que empezó: quién se le sumó a un tramo que sigue abierto, y si ya se fue
    select p.id, p.client_id, e.nombre quien, p.rubro, r.nombre area, p.texto, r.unidad, r.pide_cantidad, j.ts_cliente desde,
           (select min(k.ts_cliente) from gt.registros k where k.empleado_id = j.empleado_id and k.rubro = j.rubro
              and k.ts_inicio = j.ts_cliente and k.opcion in ('AREA', 'AREAX')) se_fue
      from gt.parejas p
      join gt.empleados e on e.id = p.para_id
      join gt.rubros r on r.codigo = p.rubro
      left join lateral (select x.* from gt.registros x where x.empleado_id = p.para_id and x.opcion = 'AREA' and x.ts_inicio is null
                           and x.detalle->>'_invitado' = p.id::text order by x.ts_cliente limit 1) j on true
     where p.de_id = p_empleado and p.estado = 'aceptada' and p.creada > now() - interval '14 hours'
       and not exists (select 1 from gt.registros k where k.empleado_id = p.de_id and k.rubro = p.rubro
                         and k.ts_inicio = p.ts and k.opcion in ('AREA', 'AREAX'))),
  ajenos as (       -- al que se sumó: el que empezó ya terminó y él sigue adentro
    select p.id, p.client_id une, j.client_id mio, e.nombre de, p.de_id, p.rubro, r.nombre area, p.texto, r.unidad, r.pide_cantidad,
           k.ts_cliente fin, k.cantidad
      from gt.parejas p
      join gt.empleados e on e.id = p.de_id
      join gt.rubros r on r.codigo = p.rubro
      join gt.registros j on j.empleado_id = p.para_id and j.opcion = 'AREA' and j.ts_inicio is null and j.detalle->>'_invitado' = p.id::text
      join lateral (select x.ts_cliente, x.cantidad from gt.registros x where x.empleado_id = p.de_id and x.rubro = p.rubro
                      and x.ts_inicio = p.ts and x.opcion = 'AREA' order by x.ts_cliente limit 1) k on true
     where p.para_id = p_empleado and p.estado = 'aceptada' and p.creada > now() - interval '14 hours'
       and not exists (select 1 from gt.registros c where c.empleado_id = j.empleado_id and c.rubro = j.rubro
                         and c.ts_inicio = j.ts_cliente and c.opcion in ('AREA', 'AREAX')))
  select json_build_object(
    'sumados', coalesce((select json_agg(json_build_object('id', s.id, 'client_id', s.client_id, 'quien', s.quien, 'rubro', s.rubro,
                 'area', s.area, 'texto', s.texto, 'unidad', s.unidad, 'pide_cantidad', s.pide_cantidad, 'desde', s.desde, 'se_fue', s.se_fue)
                 order by s.id) from suyos s), '[]'::json),
    'terminados', coalesce((select json_agg(json_build_object('id', a.id, 'une', a.une, 'mio', a.mio, 'de', a.de, 'rubro', a.rubro,
                 'area', a.area, 'texto', a.texto, 'unidad', a.unidad, 'pide_cantidad', a.pide_cantidad, 'fin', a.fin, 'cantidad', a.cantidad,
                 -- si el que empezó arrancó otro tramo en la misma área y se puede sumar, para ofrecerle seguir con él
                 'sigue', (select x from json_array_elements(public.gt_pareja_abiertos(p_empleado, a.rubro)) x
                            where (x->>'empleado_id')::bigint = a.de_id and (x->>'ts')::timestamptz >= a.fin - interval '5 seconds'
                            order by (x->>'ts')::timestamptz limit 1))
                 order by a.id) from ajenos a), '[]'::json));
$function$;
grant execute on function public.gt_pareja_avisos2(bigint) to anon, authenticated;

-- el Rendimiento con más de un compañero en el tramo (parcheado sobre la definición VIVA)
do $aplica$
declare d text; n int;
begin
  d := pg_get_functiondef('public.gt_admin_rendimiento(text,date,date)'::regprocedure);
  n := (select count(*) from regexp_matches(d, 'from base b left join comp c on c\.id = b\.id', 'g'));
  if n <> 1 then raise exception 'trozo 1: % veces', n; end if;
  n := (select count(*) from regexp_matches(d, 'b\.u \* c\.seg / \(b\.seg \+ c\.seg\)\s+from base b join comp c on c\.id = b\.id', 'g'));
  if n <> 1 then raise exception 'trozo 2: % veces', n; end if;
  d := regexp_replace(d, 'from base b left join comp c on c\.id = b\.id',
         'from base b left join (select id, sum(seg) seg from comp group by id) c on c.id = b.id');
  d := regexp_replace(d, 'b\.u \* c\.seg / \(b\.seg \+ c\.seg\)\s+from base b join comp c on c\.id = b\.id',
         E'b.u * c.seg / (b.seg + t.seg)\n      from base b join comp c on c.id = b.id\n      join (select id, sum(seg) seg from comp group by id) t on t.id = b.id');
  execute d;
end $aplica$;
comment on function public.gt_admin_rendimiento(text,date,date) is 'gt_v157 (D58): con más de un compañero en el tramo (uno se fue y se sumó otro), las unidades se reparten entre todos según el tiempo de cada uno.';

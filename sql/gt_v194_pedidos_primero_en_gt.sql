-- gt_v194 — EL PEDIDO NACE EN GT y después va a ISIS (Thomas Loekemeyer, 20/11/2026)
-- «que dejen de ser pedidos considerados de ISIS … como el cambio que hicimos en Gestión Virgilio … primero el pedido va a
-- Gestión Virgilio y después va a ISIS. Lo mismo tenemos que hacer en GT.»
--
-- Modelo: UN pedido = una fila de gt.pedidos (NP de GT «TN 0001…», la serie que ya usaba la página de TN) con sus renglones
-- en gt.pedido_items (cajas pedidas y armadas). La Programación (gt.ppp_a_programar) es la logística de ESE pedido
-- (pedido_id, día, barrio, camión, m³, «lista para facturar») y su columna `np` pasa a ser el NÚMERO de la NP de GT.
-- El número de ISIS es un dato que se completa DESPUÉS (gt.pedidos.np_isis / gt.ppp_a_programar.np_isis).
--
-- Partes: (0) backup en zz_backups (gt_*_v194, RLS prendida, aplicado aparte) · (1) columnas · (2) helpers · (3) triggers de
-- estado pedido ↔ programación · (4) faltante · (5) RPC del admin · (6) migración de los datos (gt_v194_migrar_datos.sql).
-- Rollback: los backups gt_ppp_a_programar_v194 / gt_pedidos_v194 / gt_pedido_items_v194 / gt_ppp_entregado_v194 tienen
-- todo como estaba el 21/11/2026 antes del cambio. Las funciones viejas (…5) siguen existiendo y el admin cae a ellas.

-- (1) columnas -----------------------------------------------------------------------------------------------------------
alter table gt.pedidos
  add column if not exists np_num integer generated always as (case when np ~ '^TN [0-9]+$' then substring(np from 4)::int end) stored,
  add column if not exists np_isis integer,
  add column if not exists isis_cargado_en timestamptz,
  add column if not exists isis_por text,
  add column if not exists oc text;
create unique index if not exists pedidos_np_num_key on gt.pedidos (np_num);
alter table gt.pedido_items
  add column if not exists descripcion text,
  add column if not exists uxb integer;
alter table gt.ppp_a_programar
  add column if not exists pedido_id bigint references gt.pedidos(id),
  add column if not exists np_isis integer;
create unique index if not exists ppp_a_programar_pedido_key on gt.ppp_a_programar (pedido_id) where pedido_id is not null;
comment on column gt.ppp_a_programar.np is 'gt_v194: número de la NP de GT (gt.pedidos.np_num, se muestra «TN 0004»). Antes del 21/11/2026 era la NP de ISIS, que pasó a np_isis.';
comment on column gt.ppp_a_programar.np_isis is 'gt_v194: NP de ISIS, se completa cuando el pedido se carga en ISIS (después de armarlo).';
comment on column gt.pedidos.np_isis is 'gt_v194: NP de ISIS, se completa cuando el pedido se carga en ISIS.';

-- (2) helpers ------------------------------------------------------------------------------------------------------------
create or replace function gt.np_txt(p integer) returns text language sql immutable
as $$ select case when p is null then null else 'TN ' || lpad(p::text, 4, '0') end $$;

-- La NP siguiente de GT, una sola serie para todos los orígenes (página TN, PDF Krikos, alta manual, migrados de ISIS).
create or replace function gt.pedido_np_siguiente() returns text language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtext('gt_pedido_np'));
  return gt.np_txt(coalesce((select max(np_num) from gt.pedidos), 0) + 1);
end $$;

create or replace function gt.admin_nombre(p_pass text) returns text language sql stable security definer set search_path = gt, public
as $$
  select coalesce((select s.nombre from gt.admin_sesiones s
                    where p_pass like 'pl.%' and s.hash = encode(extensions.digest(p_pass, 'sha256'), 'hex') and s.vence_en > now()
                    order by s.creado_en desc limit 1), 'monitor')
$$;

-- Le crea al pedido su fila de Programación (A Programar). Idempotente: si ya tiene, devuelve esa.
create or replace function gt.pedido_a_programar(p_pedido_id bigint, p_json jsonb default '{}'::jsonb) returns bigint
language plpgsql security definer set search_path = gt, public
as $$
declare v_id bigint; p gt.pedidos%rowtype;
begin
  select * into p from gt.pedidos where id = p_pedido_id;
  if p.id is null then return null; end if;
  select a.id into v_id from gt.ppp_a_programar a where a.pedido_id = p_pedido_id;
  if v_id is not null then return v_id; end if;
  insert into gt.ppp_a_programar (pedido_id, np, np_isis, fecha_recep, cod, cliente, kg, m3, vend, dir_entrega, barrio,
                                  entrega_retira, oc, comentario, estado, fuente, bloque, importado_at)
  values (p.id, p.np_num, p.np_isis, (coalesce(p.fecha, now()) at time zone 'America/Argentina/Buenos_Aires')::date,
          case when btrim(p.cliente_cod) ~ '^[0-9]{1,9}$' then btrim(p.cliente_cod)::int end, p.cliente,
          nullif(p_json->>'kg', '')::numeric, nullif(p_json->>'m3', '')::numeric, nullif(p_json->>'vend', ''),
          nullif(p_json->>'dir_entrega', ''), nullif(p_json->>'barrio', ''), nullif(p_json->>'entrega', ''),
          coalesce(nullif(p_json->>'oc', ''), p.oc), nullif(p_json->>'comentario', ''),
          'a_programar', p.origen,
          case p.origen when 'tn' then 'Página TN' when 'krikos' then 'PDF Krikos' when 'manual' then 'Alta manual' else p.origen end,
          now())
  returning id into v_id;
  return v_id;
end $$;

-- (3) estado pedido ↔ programación ---------------------------------------------------------------------------------------
-- Programación → pedido: entregado / anulado se reflejan en el pedido (y reactivar un anulado lo reabre).
create or replace function gt.ppp_estado_a_pedido_trg() returns trigger language plpgsql security definer set search_path = gt, public
as $$
begin
  if new.pedido_id is null then return new; end if;
  begin
    if new.estado = 'entregado' then
      update gt.pedidos set estado = 'entregado', actualizado_en = now()
       where id = new.pedido_id and estado not in ('entregado', 'cancelado');
    elsif new.estado = 'anulado' then
      update gt.pedidos set estado = 'cancelado', actualizado_en = now(), nota = concat_ws(' · ', nota, 'anulado en la Programación')
       where id = new.pedido_id and estado not in ('entregado', 'cancelado');
    elsif old.estado in ('anulado', 'entregado') then
      update gt.pedidos g set actualizado_en = now(),
             estado = (select case when coalesce(sum(i.cajas_armadas), 0) <= 0 then 'abierto'
                                   when sum(i.cajas_armadas) < sum(i.cajas) then 'parcial' else 'armado' end
                         from gt.pedido_items i where i.pedido_id = g.id)
       where g.id = new.pedido_id and g.estado in ('cancelado', 'entregado');
    end if;
  exception when others then
    raise warning 'gt.ppp_estado_a_pedido_trg: %', sqlerrm;
  end;
  return new;
end $$;
create or replace trigger zz_ppp_estado_a_pedido after update of estado on gt.ppp_a_programar
  for each row when (old.estado is distinct from new.estado) execute function gt.ppp_estado_a_pedido_trg();

-- Pedido → programación: cancelar anula la programación · entregar desde 📦 Pedidos la pasa a Entregados.
create or replace function gt.pedido_estado_a_ppp_trg() returns trigger language plpgsql security definer set search_path = gt, public
as $$
begin
  begin
    if new.estado = 'cancelado' then
      update gt.ppp_a_programar set estado = 'anulado' where pedido_id = new.id and estado not in ('anulado', 'entregado');
    elsif new.estado = 'entregado' then
      insert into gt.ppp_entregado (np, fecha_arribo, cod, cliente, kg, m3, localidad_expreso, direccion,
                                    op, lugar_entrega, fecha_entrega, observacion, oc, fuente, importado_at)
      select gt.np_txt(a.np), a.fecha_recep, a.cod, a.cliente, a.kg, a.m3, a.barrio, a.dir_entrega,
             a.op, a.barrio, a.entrega_retira, a.comentario, a.oc, 'programacion', now()
        from gt.ppp_a_programar a where a.pedido_id = new.id and a.estado not in ('anulado', 'entregado');
      update gt.ppp_a_programar set estado = 'entregado' where pedido_id = new.id and estado not in ('anulado', 'entregado');
    end if;
  exception when others then
    raise warning 'gt.pedido_estado_a_ppp_trg: %', sqlerrm;
  end;
  return new;
end $$;
create or replace trigger zz_pedido_estado_a_ppp after update of estado on gt.pedidos
  for each row when (old.estado is distinct from new.estado) execute function gt.pedido_estado_a_ppp_trg();

-- (4) faltante (para la futura Orden de Producción) -----------------------------------------------------------------------
create or replace view gt.pedido_faltante with (security_invoker = true) as
select p.id as pedido_id, p.np, p.np_isis, p.origen, p.cliente, p.estado,
       (p.fecha at time zone 'America/Argentina/Buenos_Aires')::date as fecha,
       left(a.entrega_retira, 10) as entrega, a.estado as ppp_estado,
       i.codigo, coalesce(c.descripcion, i.descripcion) as descripcion, coalesce(c.uxb, i.uxb) as uxb,
       i.cajas as pedidas, i.cajas_armadas as armadas, greatest(i.cajas - i.cajas_armadas, 0) as faltan,
       c.codigo is not null as es_de_gt
  from gt.pedidos p
  join gt.pedido_items i on i.pedido_id = p.id
  left join gt.codigos c on c.codigo = i.codigo
  left join gt.ppp_a_programar a on a.pedido_id = p.id
 where p.estado in ('abierto', 'parcial', 'armado');

create or replace view gt.faltante_producto with (security_invoker = true) as
select f.codigo, max(f.descripcion) as descripcion, max(f.uxb) as uxb, bool_or(f.es_de_gt) as es_de_gt,
       sum(f.faltan) as faltan_cajas, count(distinct f.pedido_id) filter (where f.faltan > 0) as pedidos,
       min(f.entrega) filter (where f.faltan > 0) as primera_entrega,
       string_agg(f.np || ' (' || f.faltan || ')', ', ' order by f.entrega nulls last, f.np) filter (where f.faltan > 0) as detalle
  from gt.pedido_faltante f
 group by f.codigo
having sum(f.faltan) > 0;
revoke all on gt.pedido_faltante, gt.faltante_producto from public, anon, authenticated;

-- (5) RPC del admin ------------------------------------------------------------------------------------------------------
-- Alta de un pedido EN GT (manual o PDF Krikos): NP de GT, renglones y su fila en A Programar. Sin ISIS.
create or replace function public.gt_admin_pedido_crear(p_pass text, p_json jsonb) returns jsonb
language plpgsql security definer set search_path = gt, public
as $$
declare v_origen text; v_ref text; v_np text; v_id bigint; v_ppp bigint; v_cli text; v_n int; v_otro text; v_fecha timestamptz;
begin
  if not gt.pass_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'clave'); end if;
  v_origen := coalesce(nullif(p_json->>'origen', ''), case when p_json->>'fuente' = 'pdf_krikos' then 'krikos' else 'manual' end);
  if v_origen not in ('manual', 'krikos') then v_origen := 'manual'; end if;
  v_cli := nullif(btrim(coalesce(p_json->>'cliente', '')), '');
  if v_cli is null then return jsonb_build_object('ok', false, 'error', 'falta el cliente'); end if;
  select count(*) into v_n
    from jsonb_array_elements(case when jsonb_typeof(p_json->'items') = 'array' then p_json->'items' else '[]'::jsonb end) x
   where nullif(btrim(coalesce(x->>'codigo', x->>'cod', '')), '') is not null and coalesce(nullif(x->>'cajas', '')::numeric, 0) > 0;
  if v_origen = 'manual' and v_n = 0 then return jsonb_build_object('ok', false, 'error', 'cargá al menos un renglón con código y cajas'); end if;
  v_ref := case when v_origen = 'krikos' then nullif(regexp_replace(coalesce(p_json->>'oc', ''), '\D', '', 'g'), '') end;
  if v_ref is not null then
    select np into v_otro from gt.pedidos where origen = 'krikos' and pedido_ref = v_ref;
    if v_otro is not null then return jsonb_build_object('ok', false, 'error', 'esa OC ya está cargada como ' || v_otro); end if;
  end if;
  v_fecha := coalesce(nullif(p_json->>'fecha_recep', '')::date::timestamp at time zone 'America/Argentina/Buenos_Aires', now());
  v_np := gt.pedido_np_siguiente();
  insert into gt.pedidos (origen, pedido_ref, np, cliente_cod, cliente, fecha, es_super, estado, nota, oc)
  values (v_origen, coalesce(v_ref, v_np), v_np, nullif(btrim(coalesce(p_json->>'cod', '')), ''), v_cli, v_fecha,
          v_cli ~* 'cencosud|coto|la an[oó]nima|\minc\M', 'abierto', nullif(btrim(coalesce(p_json->>'nota', '')), ''),
          nullif(btrim(coalesce(p_json->>'oc', '')), ''))
  returning id into v_id;
  insert into gt.pedido_items (pedido_id, codigo, cajas, descripcion, uxb)
  select v_id, cod, sum(cajas), max(descr), max(uxb)
    from (select btrim(coalesce(x->>'codigo', x->>'cod')) as cod, nullif(x->>'cajas', '')::numeric as cajas,
                 nullif(btrim(coalesce(x->>'descripcion', x->>'desc', '')), '') as descr,
                 case when coalesce(x->>'uxb', '') ~ '^[0-9]{1,6}$' then (x->>'uxb')::int end as uxb
            from jsonb_array_elements(case when jsonb_typeof(p_json->'items') = 'array' then p_json->'items' else '[]'::jsonb end) x) r
   where nullif(cod, '') is not null and coalesce(cajas, 0) > 0
   group by cod;
  get diagnostics v_n = row_count;
  v_ppp := gt.pedido_a_programar(v_id, p_json);
  return jsonb_build_object('ok', true, 'id', v_id, 'np', v_np, 'ppp_id', v_ppp, 'renglones', v_n);
end $$;

-- El alta vieja del PDF Krikos (la llamaba el admin hasta 1.73): ahora crea el pedido EN GT y devuelve el id de A Programar.
create or replace function public.gt_admin_ppp_crear_pedido(p_pass text, p_json jsonb) returns bigint
language plpgsql security definer set search_path = gt, public
as $$
declare r jsonb;
begin
  if not gt.pass_ok(p_pass) then raise exception 'sin permiso'; end if;
  r := public.gt_admin_pedido_crear(p_pass, p_json || jsonb_build_object('origen', 'krikos'));
  if not coalesce((r->>'ok')::boolean, false) then raise exception '%', r->>'error'; end if;
  return (r->>'ppp_id')::bigint;
end $$;

-- Agregar o corregir un renglón de un pedido abierto (sirve para completar los migrados de ISIS, que vinieron sin renglones).
create or replace function public.gt_admin_pedido_renglon(p_pass text, p_pedido_id bigint, p_codigo text, p_cajas numeric) returns jsonb
language plpgsql security definer set search_path = gt, public
as $$
declare v_est text; v_cod text := btrim(coalesce(p_codigo, ''));
begin
  if not gt.pass_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'clave'); end if;
  select estado into v_est from gt.pedidos where id = p_pedido_id for update;
  if v_est is null then return jsonb_build_object('ok', false, 'error', 'no existe el pedido'); end if;
  if v_est not in ('abierto', 'parcial', 'armado') then return jsonb_build_object('ok', false, 'error', 'el pedido ya está ' || v_est); end if;
  if v_cod = '' or coalesce(p_cajas, 0) <= 0 then return jsonb_build_object('ok', false, 'error', 'código y cajas (más de 0)'); end if;
  insert into gt.pedido_items (pedido_id, codigo, cajas) values (p_pedido_id, v_cod, p_cajas)
  on conflict (pedido_id, codigo) do update set cajas = excluded.cajas, cajas_armadas = least(gt.pedido_items.cajas_armadas, excluded.cajas);
  return public.gt_admin_pedido_armar(p_pass, p_pedido_id, null, null, null);
end $$;

-- Anotar el número de ISIS cuando el pedido se cargó en ISIS (null = borrarlo).
create or replace function public.gt_admin_pedido_isis(p_pass text, p_pedido_id bigint, p_np_isis integer) returns jsonb
language plpgsql security definer set search_path = gt, public
as $$
declare v_np text;
begin
  if not gt.pass_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'clave'); end if;
  if p_np_isis is not null and p_np_isis <= 0 then return jsonb_build_object('ok', false, 'error', 'número de ISIS inválido'); end if;
  update gt.pedidos set np_isis = p_np_isis, actualizado_en = now(),
         isis_cargado_en = case when p_np_isis is null then null else now() end,
         isis_por = case when p_np_isis is null then null else gt.admin_nombre(p_pass) end
   where id = p_pedido_id returning np into v_np;
  if v_np is null then return jsonb_build_object('ok', false, 'error', 'no existe el pedido'); end if;
  update gt.ppp_a_programar set np_isis = p_np_isis where pedido_id = p_pedido_id;
  return jsonb_build_object('ok', true, 'np', v_np, 'np_isis', p_np_isis);
end $$;

-- 📦 Pedidos con NP de GT, ISIS, programación y faltante por renglón.
create or replace function public.gt_admin_pedidos2(p_pass text, p_cerrados boolean)
returns table(id bigint, np text, origen text, pedido_ref text, cliente_cod text, cliente text, fecha timestamptz, dias integer,
              vence date, vencido boolean, estado text, es_super boolean, cajas numeric, armadas numeric, faltan numeric,
              pct_armado numeric, nota text, oc text, np_isis integer, isis_cargado_en timestamptz, isis_por text,
              ppp_id bigint, ppp_estado text, entrega text, lista_en timestamptz, actualizado_en timestamptz, items jsonb)
language sql stable security definer set search_path = gt, public
as $$
  select p.id, p.np, p.origen, p.pedido_ref, p.cliente_cod, p.cliente, p.fecha,
         ((now() at time zone 'America/Argentina/Buenos_Aires')::date - (p.fecha at time zone 'America/Argentina/Buenos_Aires')::date)::int,
         (p.fecha at time zone 'America/Argentina/Buenos_Aires')::date + p.plazo_dias,
         now() > p.fecha + make_interval(days => p.plazo_dias) and p.estado in ('abierto', 'parcial', 'armado'),
         p.estado, p.es_super,
         coalesce(it.cajas, 0), coalesce(it.armadas, 0), coalesce(it.faltan, 0),
         round(100 * coalesce(it.armadas, 0) / nullif(it.cajas, 0)),
         p.nota, p.oc, p.np_isis, p.isis_cargado_en, p.isis_por,
         a.id, a.estado, left(a.entrega_retira, 10), a.lista_en, p.actualizado_en, coalesce(it.items, '[]'::jsonb)
    from gt.pedidos p
    left join gt.ppp_a_programar a on a.pedido_id = p.id
    left join lateral (
      select sum(i.cajas) as cajas, sum(i.cajas_armadas) as armadas, sum(greatest(i.cajas - i.cajas_armadas, 0)) as faltan,
             jsonb_agg(jsonb_build_object('codigo', i.codigo, 'descripcion', coalesce(c.descripcion, i.descripcion), 'medida', c.medida,
                                          'uxb', coalesce(c.uxb, i.uxb), 'cajas', i.cajas, 'cajas_armadas', i.cajas_armadas,
                                          'faltan', greatest(i.cajas - i.cajas_armadas, 0), 'de_gt', c.codigo is not null) order by i.codigo) as items
        from gt.pedido_items i left join gt.codigos c on c.codigo = i.codigo
       where i.pedido_id = p.id) it on true
   where gt.pass_ok(p_pass)
     and (p.estado in ('abierto', 'parcial', 'armado', 'cargado')
          or (p_cerrados and p.estado in ('entregado', 'cancelado') and p.actualizado_en >= now() - interval '30 days'))
   order by case p.estado when 'abierto' then 1 when 'parcial' then 1 when 'armado' then 2 when 'cargado' then 3 else 4 end, p.fecha;
$$;

-- Faltante por producto (lo que falta armar de los pedidos abiertos), para el admin.
create or replace function public.gt_admin_faltante(p_pass text)
returns table(codigo text, descripcion text, uxb integer, es_de_gt boolean, faltan_cajas numeric, pedidos bigint, primera_entrega text, detalle text)
language sql stable security definer set search_path = gt, public
as $$
  select f.codigo, f.descripcion, f.uxb, f.es_de_gt, f.faltan_cajas, f.pedidos, f.primera_entrega, f.detalle
    from gt.faltante_producto f
   where gt.pass_ok(p_pass)
   order by f.faltan_cajas desc, f.codigo;
$$;

-- A Programar / Programación con la NP de GT, el número de ISIS y el faltante (el admin cae a las …5 si no están).
create or replace function public.gt_admin_ppp_a_programar6(p_pass text)
returns table(id bigint, np integer, np_txt text, np_isis integer, pedido_id bigint, pedido_estado text, cajas numeric, armadas numeric,
              faltan numeric, fecha_recep date, cod integer, cliente text, kg numeric, m3 numeric, vend text, dir_entrega text, barrio text,
              op text, entrega_retira text, rent text, oc text, aviso text, bloque text, fc_cotizador text, fc_pct_facturado numeric,
              estado text, comentario text)
language sql stable security definer set search_path = gt, public
as $$
  select a.id, a.np, case when a.pedido_id is not null then gt.np_txt(a.np) else a.np::text end, a.np_isis, a.pedido_id, p.estado,
         it.cajas, it.armadas, it.faltan,
         a.fecha_recep, a.cod, a.cliente, a.kg, a.m3, a.vend, a.dir_entrega, a.barrio, a.op, a.entrega_retira, a.rent, a.oc, a.aviso,
         a.bloque, a.fc_cotizador, a.fc_pct_facturado, a.estado, a.comentario
    from gt.ppp_a_programar a
    left join gt.pedidos p on p.id = a.pedido_id
    left join lateral (select sum(i.cajas) cajas, sum(i.cajas_armadas) armadas, sum(greatest(i.cajas - i.cajas_armadas, 0)) faltan
                         from gt.pedido_items i where i.pedido_id = a.pedido_id) it on true
   where gt.pass_ok(p_pass) and a.estado in ('a_programar', 'retenido', 'cliente_nuevo')
   order by a.fecha_recep nulls last, a.np;
$$;

create or replace function public.gt_admin_ppp_programacion6(p_pass text)
returns table(id bigint, np integer, np_txt text, np_isis integer, pedido_id bigint, pedido_estado text, cajas numeric, armadas numeric,
              faltan numeric, fecha_recep date, cod integer, cliente text, kg numeric, m3 numeric, vend text, dir_entrega text, barrio text,
              op text, entrega_retira text, rent text, oc text, aviso text, bloque text, fc_cotizador text, fc_pct_facturado numeric,
              comentario text, zona text, camion text, camion_manual boolean, lista_en timestamptz, lista_por text, demora_dias integer)
language sql stable security definer set search_path = gt, public
as $$
  select a.id, a.np, case when a.pedido_id is not null then gt.np_txt(a.np) else a.np::text end, a.np_isis, a.pedido_id, p.estado,
         it.cajas, it.armadas, it.faltan,
         a.fecha_recep, a.cod, a.cliente, a.kg, a.m3, a.vend, a.dir_entrega, a.barrio, a.op, a.entrega_retira,
         a.rent, a.oc, a.aviso, a.bloque, a.fc_cotizador, a.fc_pct_facturado, a.comentario,
         gt.ppp_zona_de(a.barrio), gt.ppp_camion_de(a.camion, a.cliente, a.barrio), nullif(btrim(a.camion), '') is not null,
         a.lista_en, (select e.nombre from gt.empleados e where e.id = a.lista_por),
         ((now() at time zone 'America/Argentina/Buenos_Aires')::date - a.fecha_recep)::int
    from gt.ppp_a_programar a
    left join gt.pedidos p on p.id = a.pedido_id
    left join lateral (select sum(i.cajas) cajas, sum(i.cajas_armadas) armadas, sum(greatest(i.cajas - i.cajas_armadas, 0)) faltan
                         from gt.pedido_items i where i.pedido_id = a.pedido_id) it on true
   where gt.pass_ok(p_pass) and a.estado = 'programado'
   order by a.entrega_retira nulls last, a.np;
$$;

-- Lo que hay que cargar en ISIS de las NP elegidas (ids de la Programación): un renglón por código.
-- Va lo ARMADO si el pedido tiene armado cargado; si no, lo PEDIDO (`base` lo dice). Un pedido sin renglones sale con una fila de aviso.
create or replace function public.gt_admin_isis_planilla(p_pass text, p_ids bigint[])
returns table(ppp_id bigint, pedido_id bigint, np text, np_isis integer, entrega text, cliente_cod text, cliente text, vend text, oc text,
              barrio text, codigo text, descripcion text, cajas numeric, uxb integer, unidades numeric, base text, lista boolean)
language sql stable security definer set search_path = gt, public
as $$
  with sel as (
    select a.*, p.cliente_cod as p_cli, p.np as p_np,
           coalesce((select sum(i.cajas_armadas) from gt.pedido_items i where i.pedido_id = a.pedido_id), 0) as arm_tot
      from gt.ppp_a_programar a left join gt.pedidos p on p.id = a.pedido_id
     where gt.pass_ok(p_pass) and a.id = any(p_ids))
  select s.id, s.pedido_id, coalesce(s.p_np, s.np::text), s.np_isis, left(s.entrega_retira, 10), coalesce(s.cod::text, s.p_cli), s.cliente,
         s.vend, s.oc, s.barrio, i.codigo, coalesce(c.descripcion, i.descripcion,
           case when i.codigo is null then 'Sin renglones en GT: este pedido se cargó antes del cambio del 21/11/2026' end),
         case when i.codigo is null then null when s.arm_tot > 0 then i.cajas_armadas else i.cajas end,
         coalesce(c.uxb, i.uxb),
         case when i.codigo is null then null else (case when s.arm_tot > 0 then i.cajas_armadas else i.cajas end) * coalesce(c.uxb, i.uxb) end,
         case when i.codigo is null then 'sin renglones' when s.arm_tot > 0 then 'armadas' else 'pedidas' end,
         s.lista_en is not null
    from sel s
    left join gt.pedido_items i on i.pedido_id = s.pedido_id and (s.arm_tot <= 0 or i.cajas_armadas > 0)
    left join gt.codigos c on c.codigo = i.codigo
   order by left(s.entrega_retira, 10), s.np, i.codigo;
$$;

-- La Programación al entregar guarda la NP de GT (ya no la de ISIS) en Entregados.
create or replace function public.gt_admin_ppp_entregar(p_pass text, p_ids bigint[]) returns integer
language plpgsql security definer set search_path = gt, public
as $$
declare n integer;
begin
  if not gt.pass_ok(p_pass) then raise exception 'sin permiso'; end if;
  if p_ids is null or array_length(p_ids,1) is null then return 0; end if;
  insert into gt.ppp_entregado (np, fecha_arribo, cod, cliente, kg, m3, localidad_expreso, direccion,
                                op, lugar_entrega, fecha_entrega, observacion, oc, fuente, importado_at)
    select case when pedido_id is not null then gt.np_txt(np) else np::text end, fecha_recep, cod, cliente, kg, m3, barrio, dir_entrega,
           op, barrio, entrega_retira, comentario, oc, 'programacion', now()
      from gt.ppp_a_programar where id = any(p_ids) and estado='programado';
  update gt.ppp_a_programar set estado='entregado' where id = any(p_ids) and estado='programado';
  get diagnostics n = row_count; return n;
end; $$;

-- permisos: las gt_admin_* las llama la página con la clave pública y cada una exige gt.pass_ok; los helpers de gt no.
revoke all on function gt.np_txt(integer), gt.pedido_np_siguiente(), gt.admin_nombre(text), gt.pedido_a_programar(bigint, jsonb),
  gt.ppp_estado_a_pedido_trg(), gt.pedido_estado_a_ppp_trg() from public, anon, authenticated;
grant execute on function public.gt_admin_pedido_crear(text, jsonb), public.gt_admin_pedido_renglon(text, bigint, text, numeric),
  public.gt_admin_pedido_isis(text, bigint, integer), public.gt_admin_pedidos2(text, boolean), public.gt_admin_faltante(text),
  public.gt_admin_ppp_a_programar6(text), public.gt_admin_ppp_programacion6(text), public.gt_admin_isis_planilla(text, bigint[])
  to anon, authenticated;

-- gt_v192 (18/11/2026, Tomás Beviglia): la Programación de la PPP de GT como Gestión Virgilio, para CONTROLAR los pedidos
-- que ya se cargaron en ISIS (C1 «no»: ISIS sigue primero; C5 «no»: no hay módulo de Facturación en GT).
--  C2  zona por barrio            gt.ppp_zonas (barrio → zona). Barrio sin fila = «Sin zona». «Retira» = Retira.
--  C3  camión por día              gt.ppp_camion_de: súper (Cencosud, Coto, La Anónima, Inc) = su propio camión · Retira sin
--                                  camión · el resto = la zona. `camion` en la fila lo pisa a mano (admin «🚚 Camión»).
--  C4  Javier marca «lista»        gt_ppp_para_armar / gt_ppp_marcar_listos (celular, área Pedidos): lista_en / lista_por.
--  C6  alerta a Gabriel (72)       gt.ppp_fact_tarea_sync(día): UNA tarea de Planify por día de entrega con las NP listas
--                                  sin entregar; la nota se reescribe y se cierra sola cuando se entregan todas.
--  C7  cierre                      el trigger sobre gt.ppp_a_programar resincroniza la tarea al entregar / mover / quitar.
--  C8  demora                      demora_dias = hoy − fecha de recepción (el admin la pinta en rojo desde 14).

create table if not exists gt.ppp_zonas (barrio text primary key, zona text not null, orden int not null default 50);
alter table gt.ppp_zonas enable row level security;
insert into gt.ppp_zonas (barrio, zona, orden) values
  ('munro', 'Norte', 10), ('tigre', 'Norte', 10), ('tortuguitas', 'Norte', 10),
  ('pompeya', 'Capital Sur', 20), ('soldati', 'Capital Sur', 20),
  ('paternal', 'Capital', 30), ('retira', 'Retira', 90)
on conflict (barrio) do nothing;

alter table gt.ppp_a_programar add column if not exists camion text;
alter table gt.ppp_a_programar add column if not exists lista_en timestamptz;
alter table gt.ppp_a_programar add column if not exists lista_por bigint;
alter table gt.ppp_a_programar add column if not exists lista_dispositivo text;

create table if not exists gt.ppp_fact_tarea (dia date primary key, task_id bigint not null, creado_en timestamptz not null default now());
alter table gt.ppp_fact_tarea enable row level security;

create or replace function gt.ppp_es_super(p_cliente text) returns boolean language sql immutable set search_path to '' as $f$
  select coalesce(p_cliente, '') ~* '(cencosud|coto|la an[oó]nima|\minc\M)';
$f$;

create or replace function gt.ppp_zona_de(p_barrio text) returns text language sql stable security definer set search_path to '' as $f$
  select coalesce((select z.zona from gt.ppp_zonas z where z.barrio = lower(btrim(p_barrio))),
                  case when nullif(btrim(p_barrio), '') is null then 'Sin zona' else 'Sin zona (' || btrim(p_barrio) || ')' end);
$f$;

create or replace function gt.ppp_camion_de(p_camion text, p_cliente text, p_barrio text) returns text
language sql stable security definer set search_path to '' as $f$
  select coalesce(nullif(btrim(p_camion), ''),
    case when gt.ppp_zona_de(p_barrio) = 'Retira' then 'Retira'
         when gt.ppp_es_super(p_cliente) then 'Súper · ' || split_part(btrim(p_cliente), ' ', 1)
         else gt.ppp_zona_de(p_barrio) end);
$f$;

-- La tarea de Gabriel de un día de entrega: NP listas y todavía programadas (sin entregar).
create or replace function gt.ppp_fact_tarea_sync(p_dia text) returns void language plpgsql security definer set search_path to '' as $f$
declare v_dia date; v_n int; v_lista text; v_task bigint; v_done boolean; v_nombre text; v_nota text;
  v_url constant text := 'https://claude.ai/code/session_01SbdwGigV9g782wM4GRehDg';
begin
  if p_dia is null or p_dia !~ '^\d{4}-\d{2}-\d{2}' then return; end if;
  v_dia := left(p_dia, 10)::date;
  select count(*), string_agg('NP ' || np || ' ' || coalesce(split_part(btrim(cliente), ' ', 1), '') ||
           ' (' || gt.ppp_camion_de(camion, cliente, barrio) || ')', ', ' order by np)
    into v_n, v_lista
    from gt.ppp_a_programar where estado = 'programado' and lista_en is not null and left(entrega_retira, 10) = p_dia;
  select t.task_id, k.done into v_task, v_done from gt.ppp_fact_tarea t left join planify.tasks k on k.id = t.task_id where t.dia = v_dia;
  if v_n = 0 then
    if v_task is not null and not coalesce(v_done, true) then
      update planify.tasks set done = true, updated_at = now(),
        note = 'Ya hecho: las NP del ' || to_char(v_dia, 'DD/MM') || ' que Javier marcó listas ya se entregaron (o se quitaron). Pedido de Tomás Beviglia · cargada por GT (marca de Javier en el celular), sesión ' || v_url
       where id = v_task;
    end if;
    return;
  end if;
  v_nombre := left('GT a facturar ' || to_char(v_dia, 'DD/MM') || ': ' || v_n || ' NP lista' || case when v_n > 1 then 's' else '' end, 60);
  v_nota := 'Falta: facturar en ISIS para la entrega del ' || to_char(v_dia, 'DD/MM') || ' ' || v_lista ||
            '. Javier las marcó armadas en el celular. Pedido de Tomás Beviglia · cargada por GT (marca de Javier en el celular), sesión ' || v_url;
  if v_task is null or v_done is null then
    insert into planify.tasks (name, type, prio, time, date, note, rec, done, assignment_type, employee_id, department_id,
                               system_generated, broadcast, created_at, updated_at)
    values (v_nombre, 'tarea', 'normal', '09:00', to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD'),
            v_nota, 'none', false, 'employee', 72, null, false, false, now(), now())
    returning id into v_task;
    insert into gt.ppp_fact_tarea (dia, task_id) values (v_dia, v_task)
      on conflict (dia) do update set task_id = excluded.task_id, creado_en = now();
  else
    update planify.tasks set name = v_nombre, note = v_nota, done = false, updated_at = now() where id = v_task;
  end if;
end $f$;

-- Cualquier cambio de estado, día o marca resincroniza la tarea del día viejo y del nuevo. Nunca frena el cambio.
create or replace function gt.ppp_fact_tarea_trg() returns trigger language plpgsql security definer set search_path to '' as $f$
begin
  begin
    if old.lista_en is not null or new.lista_en is not null then
      perform gt.ppp_fact_tarea_sync(left(old.entrega_retira, 10));
      if left(new.entrega_retira, 10) is distinct from left(old.entrega_retira, 10) then
        perform gt.ppp_fact_tarea_sync(left(new.entrega_retira, 10));
      end if;
    end if;
  exception when others then
    raise warning 'gt.ppp_fact_tarea_trg: %', sqlerrm;
  end;
  return new;
end $f$;
create or replace trigger zz_ppp_fact_tarea after update of estado, entrega_retira, lista_en, camion on gt.ppp_a_programar
  for each row execute function gt.ppp_fact_tarea_trg();

-- Admin · Programación con zona, camión, marca de Javier y demora
create or replace function public.gt_admin_ppp_programacion5(p_pass text)
returns table(id bigint, np integer, fecha_recep date, cod integer, cliente text, kg numeric, m3 numeric, vend text,
              dir_entrega text, barrio text, op text, entrega_retira text, rent text, oc text, aviso text, bloque text,
              fc_cotizador text, fc_pct_facturado numeric, comentario text, zona text, camion text, camion_manual boolean,
              lista_en timestamptz, lista_por text, demora_dias integer)
language sql stable security definer set search_path to '' as $f$
  select a.id, a.np, a.fecha_recep, a.cod, a.cliente, a.kg, a.m3, a.vend, a.dir_entrega, a.barrio, a.op, a.entrega_retira,
         a.rent, a.oc, a.aviso, a.bloque, a.fc_cotizador, a.fc_pct_facturado, a.comentario,
         gt.ppp_zona_de(a.barrio), gt.ppp_camion_de(a.camion, a.cliente, a.barrio), nullif(btrim(a.camion), '') is not null,
         a.lista_en, (select e.nombre from gt.empleados e where e.id = a.lista_por),
         ((now() at time zone 'America/Argentina/Buenos_Aires')::date - a.fecha_recep)::int
    from gt.ppp_a_programar a
   where gt.pass_ok(p_pass) and a.estado = 'programado'
   order by a.entrega_retira nulls last, a.np;
$f$;

create or replace function public.gt_admin_ppp_set_camion(p_pass text, p_ids bigint[], p_camion text)
returns integer language plpgsql security definer set search_path to '' as $f$
declare n integer;
begin
  if not gt.pass_ok(p_pass) then raise exception 'sin permiso'; end if;
  update gt.ppp_a_programar set camion = left(nullif(btrim(p_camion), ''), 40) where id = any(p_ids);
  get diagnostics n = row_count; return n;
end $f$;

create or replace function public.gt_admin_ppp_quitar_lista(p_pass text, p_ids bigint[])
returns integer language plpgsql security definer set search_path to '' as $f$
declare n integer;
begin
  if not gt.pass_ok(p_pass) then raise exception 'sin permiso'; end if;
  update gt.ppp_a_programar set lista_en = null, lista_por = null, lista_dispositivo = null
   where id = any(p_ids) and lista_en is not null;
  get diagnostics n = row_count; return n;
end $f$;

-- Celular (área Pedidos): lo programado de 7 días atrás a 7 adelante, con la marca
create or replace function public.gt_ppp_para_armar(p_empleado bigint)
returns table(id bigint, np integer, cliente text, barrio text, entrega text, m3 numeric, camion text, lista boolean)
language sql stable security definer set search_path to '' as $f$
  select a.id, a.np, a.cliente, a.barrio, left(a.entrega_retira, 10), a.m3, gt.ppp_camion_de(a.camion, a.cliente, a.barrio),
         a.lista_en is not null
    from gt.ppp_a_programar a
   where exists (select 1 from gt.empleados e where e.id = p_empleado and (e.activo or e.prueba))
     and a.estado = 'programado'
     and left(a.entrega_retira, 10) between to_char((now() at time zone 'America/Argentina/Buenos_Aires')::date - 7, 'YYYY-MM-DD')
                                         and to_char((now() at time zone 'America/Argentina/Buenos_Aires')::date + 7, 'YYYY-MM-DD')
   order by a.entrega_retira, a.np;
$f$;

create or replace function public.gt_ppp_marcar_listos(p_empleado bigint, p_dispositivo text, p_ids bigint[])
returns jsonb language plpgsql security definer set search_path to '' as $f$
declare n integer;
begin
  if not exists (select 1 from gt.empleados e where e.id = p_empleado and e.activo and not coalesce(e.prueba, false)) then
    return jsonb_build_object('ok', false, 'motivo', 'empleado inexistente, inactivo o de prueba');
  end if;
  update gt.ppp_a_programar set lista_en = now(), lista_por = p_empleado, lista_dispositivo = left(p_dispositivo, 60)
   where id = any(p_ids) and estado = 'programado' and lista_en is null;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'marcadas', n);
end $f$;

revoke all on function public.gt_admin_ppp_programacion5(text), public.gt_admin_ppp_set_camion(text, bigint[], text),
  public.gt_admin_ppp_quitar_lista(text, bigint[]), public.gt_ppp_para_armar(bigint),
  public.gt_ppp_marcar_listos(bigint, text, bigint[]) from public;
grant execute on function public.gt_admin_ppp_programacion5(text), public.gt_admin_ppp_set_camion(text, bigint[], text),
  public.gt_admin_ppp_quitar_lista(text, bigint[]), public.gt_ppp_para_armar(bigint),
  public.gt_ppp_marcar_listos(bigint, text, bigint[]) to anon, authenticated;

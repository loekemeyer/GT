-- GT v1.24 — ESNAOLA: qué moldura, anilina, color y metros (Thomas, 01/10/2026).
-- «Cuando hacen moldurado y cuando hacen lijado tienen que anotar la cantidad de metros y qué moldura es la que
--  están haciendo. Las molduras las vas a encontrar en la descripción de lo que se corta en el sector 1 de
--  Pellegrini (03, 012…). Moldurado: qué moldura van a hacer, y cuántos metros al terminar. Lijado: qué moldura y
--  si le pusieron anilina; si le ponen anilina, de qué color (marrón, cedro, roble, verde). Pintura: de qué color
--  va a pintar y qué moldura (blanco parcial, blanco total, negro, verde, celeste, rosa, beige).»
--
-- CÓMO ESTÁ HECHO: las preguntas NO están en el código. gt.rubro_pasos dice, por área, qué se pregunta, en qué
-- orden, con qué botones, bajo qué condición (el color de la anilina sólo si respondió «Sí») y en qué MOMENTO
-- ('empezar' o 'terminar'). Agregar, mover o cambiar una pregunta es un insert/update, no un deploy.
-- La app las lee con public.gt_pasos().
--   · campo 'texto'  → va en gt.registros.texto (la moldura), igual que el código en las otras áreas.
--   · otros campos   → van en gt.registros.detalle (jsonb): {"anilina":"Sí","color":"Cedro"} / {"color":"Negro"}.
--     El cierre lleva el detalle de la apertura más lo que se preguntó al terminar.
--   · fuente 'molduras' → los botones salen de las descripciones de Corte (gt.molduras): 03, 05, 012, 3P 1/2,
--     3P 3/4, 045, Trav 20mm. Una moldura nueva en Corte aparece sola.
-- Movimientos (gt.movimientos, internos): Moldurado + moldura (metros); Lijado − moldura, + moldura lijada (con
-- «anilina <color>» o «sin anilina» en la columna medida). Pintado NO mueve: no se le piden metros.
--
-- Rollback (lo corre el dueño en el SQL Editor; el conector no deja DROP):
--   drop function public.gt_pasos(), public.gt_registros_hoy3(bigint); drop view gt.molduras; drop table gt.rubro_pasos;
--   update gt.rubros set unidad='—', pide_cantidad=false where codigo in ('MOLDU','LIJA');
--   y volver gt_registrar / gt_admin_produccion2 / gt.movimientos a gt_v122_plantas.sql / la viva del 01/10 / gt_v123.
--   (la columna gt.registros.detalle puede quedar: nadie más la lee)

alter table gt.registros add column if not exists detalle jsonb;

-- el detalle en una línea: «anilina Cedro», «sin anilina», «Blanco total»
create or replace function gt.detalle_txt(d jsonb) returns text language sql immutable set search_path to '' as $$
  select case when d is null or d = '{}'::jsonb then null
              when d->>'anilina' = 'No' then 'sin anilina'
              when d->>'anilina' = 'Sí' then 'anilina ' || coalesce(d->>'color', '?')
              else (select string_agg(j.v, ' · ') from jsonb_each_text(d) j(k, v)) end
$$;
revoke all on function gt.detalle_txt(jsonb) from public, anon, authenticated;

create table if not exists gt.rubro_pasos (
  rubro     text not null references gt.rubros(codigo),
  orden     integer not null,
  campo     text not null,          -- 'texto' (va en registros.texto) u otra clave de registros.detalle
  pregunta  text not null,
  opciones  text[],                 -- botones fijos
  fuente    text,                   -- o de dónde salen: 'molduras'
  si_campo  text,                   -- se pregunta sólo si la respuesta de si_campo
  si_valor  text,                   --   es si_valor
  momento   text not null default 'empezar' check (momento in ('empezar','terminar')),
  primary key (rubro, orden)
);
alter table gt.rubro_pasos enable row level security;
revoke all on gt.rubro_pasos from anon, authenticated;

-- las molduras = el prefijo de las descripciones de Corte (sector 1 de Pellegrini), en el orden del tablero
create or replace view gt.molduras with (security_invoker = true) as
select m.moldura, min(m.n) orden, count(*) piezas_corte
  from (select (regexp_match(descripcion, '^(3P \d/\d|Trav \d+mm|\d+)'))[1] moldura,
               case when codigo ~ '^\d+$' then codigo::int end n
          from gt.codigos_rubro where rubro = 'CORTE' and activo) m
 where m.moldura is not null
 group by m.moldura;
revoke all on gt.molduras from anon, authenticated;

create or replace function public.gt_pasos()
returns table(rubro text, orden integer, campo text, pregunta text, opciones text[], fuente text,
              si_campo text, si_valor text, momento text)
language sql stable security definer set search_path to '' as $$
  select p.rubro, p.orden, p.campo, p.pregunta,
         case when p.fuente = 'molduras' then (select array_agg(m.moldura order by m.orden nulls last, m.moldura) from gt.molduras m)
              else p.opciones end,
         p.fuente, p.si_campo, p.si_valor, p.momento
    from gt.rubro_pasos p join gt.rubros r on r.codigo = p.rubro and r.activo
   order by p.rubro, p.momento, p.orden;
$$;
revoke all on function public.gt_pasos() from public;
grant execute on function public.gt_pasos() to anon, authenticated;

-- lo de hoy con planta y detalle (gt_registros_hoy2 no se puede ampliar sin DROP)
create or replace function public.gt_registros_hoy3(p_empleado bigint)
returns table(client_id text, opcion text, rubro text, cantidad numeric, descripcion text, texto text,
              ts_cliente timestamptz, ts_inicio timestamptz, medida text, planta text, detalle jsonb)
language sql stable security definer set search_path to '' as $$
  select r.client_id, r.opcion, r.rubro, r.cantidad, r.descripcion, r.texto, r.ts_cliente, r.ts_inicio, r.medida, r.planta, r.detalle
    from gt.registros r
   where r.empleado_id = p_empleado
     and r.ts_cliente >= (date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires')
   order by r.ts_cliente;
$$;
revoke all on function public.gt_registros_hoy3(bigint) from public;
grant execute on function public.gt_registros_hoy3(bigint) to anon, authenticated;

-- gt_registrar: sobre la definición viva (1.22) + detalle (sólo si es un objeto jsonb no vacío)
create or replace function public.gt_registrar(p_filas jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  f jsonb; ok jsonb := '[]'::jsonb; rech jsonb := '[]'::jsonb; v_cid text; v_emp bigint;
begin
  for f in select * from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb)) loop
    v_cid := f->>'client_id';
    v_emp := case when (f->>'empleado_id') ~ '^\d+$' then (f->>'empleado_id')::bigint end;
    if v_cid is null or v_cid = '' then
      rech := rech || jsonb_build_object('client_id', null, 'motivo', 'sin client_id');
    elsif v_emp is null or not exists (select 1 from gt.empleados e where e.activo and e.id = v_emp) then
      rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', 'empleado inexistente o inactivo');
    elsif f->>'opcion' = 'AREA' and not exists (select 1 from gt.rubros r where r.codigo = f->>'rubro') then
      rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', 'área inexistente');
    elsif f->>'opcion' <> 'AREA' and not exists (select 1 from gt.tareas t where t.codigo = f->>'opcion') then
      rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', 'tarea inexistente');
    elsif (f->>'cantidad') is not null and (f->>'cantidad') !~ '^\d+(\.\d+)?$' then
      rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', 'cantidad inválida');
    else
      insert into gt.registros (client_id, empleado_id, opcion, rubro, cantidad, descripcion, texto, ts_cliente, ts_inicio, dispositivo, medida, planta, detalle)
      values (v_cid, v_emp, f->>'opcion', nullif(f->>'rubro',''), (f->>'cantidad')::numeric, f->>'descripcion', nullif(f->>'texto',''),
              (f->>'ts_cliente')::timestamptz, nullif(f->>'ts_inicio','')::timestamptz, f->>'dispositivo', nullif(btrim(f->>'medida'), ''),
              (select p.codigo from gt.plantas p where p.codigo = nullif(btrim(f->>'planta'), '')),
              case when jsonb_typeof(f->'detalle') = 'object' and f->'detalle' <> '{}'::jsonb then f->'detalle' end)
      on conflict (client_id) do nothing;
      ok := ok || to_jsonb(v_cid);
    end if;
  end loop;
  return jsonb_build_object('ok', ok, 'rechazados', rech);
end $function$;

-- admin Producción: sobre la definición viva — el detalle va en la descripción, y un área cuyo texto sale de una
-- pregunta (la moldura) no se cruza con los códigos de producto (el 012 de Moldurado no es el producto 012)
create or replace function public.gt_admin_produccion2(p_pass text, p_dia date DEFAULT NULL::date)
 returns table(empleado text, area text, rubro text, codigo text, descripcion text, desde timestamp with time zone, hasta timestamp with time zone, cantidad numeric, unidad text, uxb integer, unidades numeric, auto boolean)
 language sql
 stable security definer
 set search_path to ''
as $function$
  with par as (select coalesce(p_dia, (now() at time zone 'America/Argentina/Buenos_Aires')::date) d),
  hoy as (select r.* from gt.registros r, par
           where r.opcion = 'AREA' and r.rubro <> 'ALMU'
             and r.ts_cliente >= par.d::timestamp at time zone 'America/Argentina/Buenos_Aires'
             and r.ts_cliente <  (par.d + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),
  tramos as (
    select c.empleado_id, c.rubro, c.texto, c.medida, c.detalle, c.ts_inicio desde, c.ts_cliente hasta, c.cantidad, c.dispositivo = 'sistema:cierre' auto
      from hoy c where c.ts_inicio is not null
    union all
    select a.empleado_id, a.rubro, a.texto, a.medida, a.detalle, a.ts_cliente, null, null, false from hoy a
     where a.ts_inicio is null
       and not exists (select 1 from hoy c where c.empleado_id = a.empleado_id and c.rubro = a.rubro and c.ts_inicio = a.ts_cliente)),
  conpaso as (select distinct p.rubro from gt.rubro_pasos p where p.campo = 'texto')
  select e.nombre, ru.nombre, t.rubro, t.texto || coalesce(' (' || t.medida || ')', ''),
         coalesce(cr.descripcion, co.descripcion, gt.detalle_txt(t.detalle)),
         t.desde, t.hasta, t.cantidad, ru.unidad, co.uxb,
         case when ru.unidad ilike 'cajas%' and co.uxb is not null then t.cantidad * co.uxb end, coalesce(t.auto, false)
    from tramos t join gt.empleados e on e.id = t.empleado_id join gt.rubros ru on ru.codigo = t.rubro
    left join gt.codigos co on t.rubro not in (select cp.rubro from conpaso cp) and upper(co.codigo) = upper(btrim(t.texto))
    left join gt.codigos_rubro cr on cr.rubro = t.rubro and upper(cr.codigo) = upper(btrim(t.texto))
   where gt.pass_ok(p_pass)
   order by gt.legajo_num(e.legajo) nulls last, e.nombre, t.desde;
$function$;

-- gt.movimientos: sobre la definición VIVA (1.23) + Moldurado y Lijado. Parche por texto: falla si no matchea.
do $mov$
declare v text := pg_get_viewdef('gt.movimientos'::regclass, true); n text;
begin
  if v like '%moldura_lijada%' then return; end if;            -- ya aplicado
  n := replace(v, E'btrim(r.texto) AS texto\n           FROM gt.registros r',
                  E'btrim(r.texto) AS texto,\n            r.detalle\n           FROM gt.registros r');
  if n = v then raise exception 'gt.movimientos: no matcheó el CTE r'; end if;
  v := n;
  n := replace(v, E'WHERE rp.area = ''CARGA''::text\n        )\n SELECT registro_id,',
    E'WHERE rp.area = ''CARGA''::text\n' ||
    E'        UNION ALL\n         SELECT r.registro_id, r.ts, r.dia, r.empleado_id, r.planta, r.area, ''moldura''::text, r.texto, NULL::text, r.cantidad, ''ok''::text, NULL::text\n           FROM r\n          WHERE r.area = ''MOLDU''::text\n' ||
    E'        UNION ALL\n         SELECT r.registro_id, r.ts, r.dia, r.empleado_id, r.planta, r.area, ''moldura''::text, r.texto, NULL::text, - r.cantidad, ''ok''::text, NULL::text\n           FROM r\n          WHERE r.area = ''LIJA''::text\n' ||
    E'        UNION ALL\n         SELECT r.registro_id, r.ts, r.dia, r.empleado_id, r.planta, r.area, ''moldura_lijada''::text, r.texto, gt.detalle_txt(r.detalle), r.cantidad, ''ok''::text, NULL::text\n           FROM r\n          WHERE r.area = ''LIJA''::text\n' ||
    E'        )\n SELECT registro_id,');
  if n = v then raise exception 'gt.movimientos: no matcheó el final de mov'; end if;
  execute 'create or replace view gt.movimientos with (security_invoker = true) as ' || n;
end $mov$;
revoke all on gt.movimientos from anon, authenticated;

-- ============================================================================================
-- DATOS (Thomas, 01/10/2026)
update gt.rubros set unidad = 'metros', pide_cantidad = true where codigo in ('MOLDU', 'LIJA');

insert into gt.rubro_pasos (rubro, orden, campo, pregunta, opciones, fuente, si_campo, si_valor, momento) values
  ('MOLDU', 1, 'texto',   '¿Qué moldura vas a hacer?',         null, 'molduras', null, null, 'empezar'),
  ('LIJA',  1, 'texto',   '¿Qué moldura vas a lijar?',         null, 'molduras', null, null, 'empezar'),
  ('LIJA',  2, 'anilina', '¿Le ponés anilina?',                array['Sí','No'], null, null, null, 'empezar'),
  ('LIJA',  3, 'color',   '¿De qué color es la anilina?',      array['Marrón','Cedro','Roble','Verde'], null, 'anilina', 'Sí', 'empezar'),
  ('PINT',  1, 'color',   '¿De qué color vas a pintar?',       array['Blanco parcial','Blanco total','Negro','Verde','Celeste','Rosa','Beige'], null, null, null, 'empezar'),
  ('PINT',  2, 'texto',   '¿Qué moldura vas a pintar?',        null, 'molduras', null, null, 'empezar')
on conflict (rubro, orden) do nothing;

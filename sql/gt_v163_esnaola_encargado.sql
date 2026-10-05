-- gt_v163 (Thomas, 05/10/2026): «En Esnaola no van a tener monitor… Darío es el encargado, en el que sí tengo confianza.
-- Que Darío pueda fichar sin la necesidad de un código y que cuando fiche le diga el código para el compañero, que es Luis».
-- 1) gt.clave_personal: una clave de 6 números por encargado (NO se escribe en el repo; se carga a mano). Con ella entra
--    directo como él (sin lista ni «¿Sos …?»), a cualquier hora, y el celular la recuerda: los días siguientes es un toque.
-- 2) da_codigo_planta: la planta cuyo código puede mostrar (Darío → ESNA). gt_codigo_planta(llave) se lo da.
-- 3) gt.clave_planta_de(planta, tramo): el código de esa planta, 4 números que cambian cada minuto (vale también el del
--    minuto anterior), con semilla propia: nunca es la clave de vista ni el código del monitor de ese minuto.
-- 4) gt_clave_validar: con el código de una planta devuelve sólo los empleados de esa planta y planta = esa (el celular no
--    pregunta «¿En qué planta?»). Con la clave personal: personal = true y sólo ese empleado.
create table if not exists gt.clave_personal (
  clave text primary key check (clave ~ '^\d{6}$'),
  empleado_id bigint not null references gt.empleados(id),
  da_codigo_planta text references gt.plantas(codigo),
  activo boolean not null default true,
  creada timestamptz not null default now()
);
alter table gt.clave_personal enable row level security;
revoke all on gt.clave_personal from anon, authenticated;

create or replace function gt.clave_planta_de(p_planta text, p_tramo bigint)
 returns text
 language sql
 stable security definer
 set search_path to ''
as $function$
  select case when s.c in (coalesce((select valor from gt.config where clave = 'clave_vista'), ''), gt.clave_de(p_tramo))
              then lpad(((s.c::int + 7) % 10000)::text, 4, '0') else s.c end
    from (select lpad(((('x' || substr(md5((select system_identifier from pg_catalog.pg_control_system())::text
                 || ':gt-clave-planta:' || p_planta || ':' || p_tramo::text), 1, 8))::bit(32)::bigint) % 10000)::text, 4, '0') c) s;
$function$;
revoke all on function gt.clave_planta_de(text, bigint) from public, anon, authenticated;

create or replace function public.gt_clave_validar(p_clave text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  v_t bigint := floor(extract(epoch from now()) / 60)::bigint;
  v_c text := regexp_replace(coalesce(p_clave, ''), '\D', '', 'g');
  v_pr text := gt.planta_principal();
  v_vista boolean := v_c <> '' and v_c = coalesce((select valor from gt.config where clave = 'clave_vista'), '');
  v_pers gt.clave_personal;
  v_planta text;
begin
  if v_c = '' then return jsonb_build_object('ok', false); end if;
  -- gt_v163: la clave personal de un encargado (6 números)
  if length(v_c) = 6 then
    select * into v_pers from gt.clave_personal k where k.clave = v_c and k.activo
       and exists (select 1 from gt.empleados e where e.id = k.empleado_id and e.activo);
    if not found then return jsonb_build_object('ok', false); end if;
  elsif not v_vista and v_c <> gt.clave_de(v_t) and v_c <> gt.clave_de(v_t - 1) then
    -- gt_v163: ¿es el código de otra planta (el que muestra el encargado)?
    select p.codigo into v_planta from gt.plantas p
     where p.activo and p.codigo <> v_pr and v_c in (gt.clave_planta_de(p.codigo, v_t), gt.clave_planta_de(p.codigo, v_t - 1))
     order by p.orden limit 1;
    if v_planta is null then return jsonb_build_object('ok', false); end if;
  end if;
  -- v1.7: ordenados por número de legajo (Thomas); sin legajo, al final por nombre
  -- v1.22: cada empleado trae sus plantas (gt.empleado_planta; sin filas = la principal)
  -- gt_v162: con la clave de vista, vista = true (el celular no graba nada)
  -- gt_v163: con el código de una planta, sólo los de esa planta y planta = esa · con la clave personal, sólo él
  return jsonb_build_object('ok', true, 'vista', v_vista, 'principal', v_pr, 'planta', v_planta,
    'personal', v_pers.clave is not null, 'da_codigo', v_pers.da_codigo_planta, 'empleados', coalesce((
    select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre, 'legajo', e.legajo,
             'plantas', coalesce((select jsonb_agg(jsonb_build_object('codigo', p.codigo, 'nombre', p.nombre) order by p.orden, p.codigo)
                                    from gt.empleado_planta ep join gt.plantas p on p.codigo = ep.planta and p.activo
                                   where ep.empleado_id = e.id),
                                 (select jsonb_build_array(jsonb_build_object('codigo', p.codigo, 'nombre', p.nombre))
                                    from gt.plantas p where p.codigo = v_pr),
                                 '[]'::jsonb))
                     order by gt.legajo_num(e.legajo) nulls last, e.nombre)
      from gt.empleados e where e.activo
       and (v_pers.clave is null or e.id = v_pers.empleado_id)
       and (v_planta is null or exists (select 1 from gt.empleado_planta ep where ep.empleado_id = e.id and ep.planta = v_planta))), '[]'::jsonb));
end $function$;

-- el código de la planta, para el celular del encargado (con su clave personal)
create or replace function public.gt_codigo_planta(p_llave text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare v_k gt.clave_personal; v_t bigint := floor(extract(epoch from now()) / 60)::bigint;
begin
  select * into v_k from gt.clave_personal where clave = regexp_replace(coalesce(p_llave, ''), '\D', '', 'g') and activo and da_codigo_planta is not null;
  if not found then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true, 'planta', v_k.da_codigo_planta,
    'planta_nombre', (select nombre from gt.plantas where codigo = v_k.da_codigo_planta),
    'clave', gt.clave_planta_de(v_k.da_codigo_planta, v_t),
    'cambia_en_s', 60 - (floor(extract(epoch from now()))::bigint % 60));
end $function$;
revoke all on function public.gt_codigo_planta(text) from public;
grant execute on function public.gt_codigo_planta(text) to anon, authenticated;
-- Cargar la clave de Darío (id 6), en el SQL Editor o desde la sesión, sin escribirla en el repo:
--   insert into gt.clave_personal (clave, empleado_id, da_codigo_planta) values ('<6 números>', 6, 'ESNA')

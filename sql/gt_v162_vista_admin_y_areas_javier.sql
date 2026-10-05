-- gt_v162 (Thomas, 05/10/2026)
-- 1) «Si pongo la clave 1411… que nunca aparezca en los códigos aleatorios… para entrar en modo visual… sin registrar ninguna
--    fichada». La clave vive en gt.config.clave_vista (anon no lee gt.config: NO se escribe en el repo). gt.clave_de nunca
--    devuelve esa clave (si el azar la da, da la siguiente). gt_clave_validar la acepta siempre y contesta vista = true: el
--    celular entra como cualquier operario pero no graba nada (ni INGRESO).
--    Cargar o cambiar la clave (en el SQL Editor o desde la sesión):
--      insert into gt.config (clave, valor) values ('clave_vista', '<4 números>') on conflict (clave) do update set valor = excluded.valor
-- 2) «Javier puede: cargar contraído a ISIS, hacer OP, sector Facturación»: tres áreas sólo de Javier Burgos (id 1). Desde acá
--    gt.empleado_rubro dice de QUIÉN es un área: un área con filas ahí la ven sólo esos empleados; sin filas, todos.
--    gt_botones3() = gt_botones2 + «solo» (los ids que la ven, o null). Sin código ni cantidad.
create or replace function gt.clave_de(p_tramo bigint)
 returns text
 language sql
 stable security definer
 set search_path to ''
as $function$
  select case when s.c = coalesce((select valor from gt.config where clave = 'clave_vista'), '')
              then lpad(((s.c::int + 1) % 10000)::text, 4, '0') else s.c end
    from (select lpad(((('x' || substr(md5((select system_identifier from pg_catalog.pg_control_system())::text
                 || ':gt-clave:' || p_tramo::text), 1, 8))::bit(32)::bigint) % 10000)::text, 4, '0') c) s;
$function$;

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
begin
  if v_c = '' or (not v_vista and v_c <> gt.clave_de(v_t) and v_c <> gt.clave_de(v_t - 1)) then
    return jsonb_build_object('ok', false);
  end if;
  -- v1.7: ordenados por número de legajo (Thomas); sin legajo, al final por nombre
  -- v1.22: cada empleado trae sus plantas (gt.empleado_planta; sin filas = la principal)
  -- gt_v162: con la clave de vista, vista = true (el celular no graba nada)
  return jsonb_build_object('ok', true, 'vista', v_vista, 'principal', v_pr, 'empleados', coalesce((
    select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre, 'legajo', e.legajo,
             'plantas', coalesce((select jsonb_agg(jsonb_build_object('codigo', p.codigo, 'nombre', p.nombre) order by p.orden, p.codigo)
                                    from gt.empleado_planta ep join gt.plantas p on p.codigo = ep.planta and p.activo
                                   where ep.empleado_id = e.id),
                                 (select jsonb_build_array(jsonb_build_object('codigo', p.codigo, 'nombre', p.nombre))
                                    from gt.plantas p where p.codigo = v_pr),
                                 '[]'::jsonb))
                     order by gt.legajo_num(e.legajo) nulls last, e.nombre)
      from gt.empleados e where e.activo), '[]'::jsonb));
end $function$;

create or replace function public.gt_botones3()
 returns json
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(json_agg(json_build_object('codigo', b.codigo, 'nombre', b.nombre, 'unidad', b.unidad, 'orden', b.orden,
           'pide_codigo', b.pide_codigo, 'pide_cantidad', b.pide_cantidad, 'planta', b.planta,
           'solo', (select json_agg(er.empleado_id order by er.empleado_id) from gt.empleado_rubro er where er.rubro = b.codigo))), '[]'::json)
    from public.gt_botones2() b;
$function$;
revoke all on function public.gt_botones3() from public;
grant execute on function public.gt_botones3() to anon, authenticated;

insert into gt.rubros (codigo, nombre, unidad, orden, activo, pide_codigo, pide_cantidad, planta, todas_plantas, familia_sin_moldura, productivo) values
  ('ISIS', 'Contraído a ISIS', '—', 13, true, false, false, null, false, false, true),
  ('OP', 'Hacer OP', '—', 14, true, false, false, null, false, false, true),
  ('FACT', 'Facturación', '—', 15, true, false, false, null, false, false, true)
on conflict (codigo) do nothing;
insert into gt.empleado_rubro (empleado_id, rubro)
select 1, r from unnest(array['ISIS', 'OP', 'FACT']) r
where not exists (select 1 from gt.empleado_rubro x where x.empleado_id = 1 and x.rubro = r);

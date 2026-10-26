-- gt_v183 (26/10/2026): «Persona de Prueba», visible SÓLO entrando con Google con loekemeyer.n8n@gmail.com.
-- Aplicada como migración gt_v183_persona_prueba_n8n. Cero cambios en la app.
--
-- Cómo queda:
--   · gt.empleados.prueba (nuevo). La persona de prueba es activo = false + prueba = true: todo lo que filtra e.activo
--     (lista del monitor, Esnaola, parejas, asistencia, aviso de llegada por Telegram, cierre automático) no la ve, y
--     gt_registrar la rechaza («empleado inexistente o inactivo»): aunque algo fallara, no puede grabar un evento.
--   · gt.clave_personal: una clave de 6 números al azar (NO se escribe en el repo) con email = el de n8n.
--   · gt_google_llave y gt_clave_validar aceptan esa clave aunque el empleado esté inactivo, si es prueba.
--   · gt_clave_validar devuelve, para esa clave, personal = false y vista = true con la lista = sólo ella: la app (1.67,
--     sin cambios) muestra la lista con un solo nombre, al tocarlo entra en MODO VISTA (1.52) y simula todo en el celular.
--     No hay INGRESO, ni Empecé/Terminé en gt.registros: no mueve stock ni cuenta para producción ni rendimiento.
--
-- Definiciones vivas tomadas el 26/10/2026 justo antes de escribir (gt_google_llave todavía con la rama gt_v181 de
-- google_vista_mails: se deja como está; con la clave personal cargada, el mail de n8n ya no llega a esa rama).
--
-- Sacarla:
--   update gt.clave_personal set activo = false where empleado_id = (select id from gt.empleados where prueba);

alter table gt.empleados add column if not exists prueba boolean not null default false;

insert into gt.empleados (nombre, legajo, activo, prueba)
select 'Persona de Prueba', null, false, true
 where not exists (select 1 from gt.empleados where prueba);

insert into gt.clave_personal (clave, empleado_id, da_codigo_planta, activo, email)
select c, (select id from gt.empleados where prueba order by id limit 1), null, true, 'loekemeyer.n8n@gmail.com'
  from (select lpad((floor(random() * 1000000))::int::text, 6, '0') c from generate_series(1, 50)) x
 where c not in (select clave from gt.clave_personal)
   and c <> coalesce((select valor from gt.config where clave = 'clave_vista'), '')
   and not exists (select 1 from gt.clave_personal k where lower(k.email) = 'loekemeyer.n8n@gmail.com')
 limit 1;

-- 26/10: trabaja en las dos plantas, como Darío y Luis: sin estas filas no pregunta «¿En qué planta?» (queda en la principal)
insert into gt.empleado_planta (empleado_id, planta)
select e.id, p.codigo from gt.empleados e cross join (values ('PELL'), ('ESNA')) p(codigo)
 where e.prueba and not exists (select 1 from gt.empleado_planta x where x.empleado_id = e.id and x.planta = p.codigo);

CREATE OR REPLACE FUNCTION public.gt_google_llave()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_mail text := lower(coalesce(auth.jwt()->>'email','')); v_k gt.clave_personal; v_vista text;
begin
  if v_mail = '' then return jsonb_build_object('ok', false, 'motivo', 'sin sesión'); end if;
  -- gt_v183: o la persona de prueba (inactiva a propósito, entra en modo vista)
  select * into v_k from gt.clave_personal k where lower(k.email) = v_mail and k.activo
     and exists (select 1 from gt.empleados e where e.id = k.empleado_id and (e.activo or e.prueba)) limit 1;
  if found then return jsonb_build_object('ok', true, 'llave', v_k.clave); end if;
  -- gt_v181: los mails de gt.config.google_vista_mails (separados por coma) entran con la clave de vista: no graban
  if v_mail = any (select lower(trim(m)) from unnest(string_to_array(coalesce((select valor from gt.config where clave = 'google_vista_mails'), ''), ',')) m) then
    select valor into v_vista from gt.config where clave = 'clave_vista';
    if coalesce(v_vista, '') <> '' then return jsonb_build_object('ok', true, 'llave', v_vista, 'vista', true); end if;
  end if;
  return jsonb_build_object('ok', false, 'motivo', 'mail no habilitado', 'email', v_mail);
end $function$;

CREATE OR REPLACE FUNCTION public.gt_clave_validar(p_clave text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_t bigint := floor(extract(epoch from now()) / 60)::bigint;
  v_c text := regexp_replace(coalesce(p_clave, ''), '\D', '', 'g');
  v_pr text := gt.planta_principal();
  v_vista boolean := v_c <> '' and v_c = coalesce((select valor from gt.config where clave = 'clave_vista'), '');
  v_pers gt.clave_personal;
  v_planta text;
  v_prueba boolean := false;
begin
  if v_c = '' then return jsonb_build_object('ok', false); end if;
  -- gt_v163: la clave personal de un encargado (6 números)
  if length(v_c) = 6 then
    select * into v_pers from gt.clave_personal k where k.clave = v_c and k.activo
       and exists (select 1 from gt.empleados e where e.id = k.empleado_id and (e.activo or e.prueba));
    if not found then return jsonb_build_object('ok', false); end if;
    -- gt_v183: la de la persona de prueba entra como la clave de vista (lista con ella sola, no graba)
    v_prueba := exists (select 1 from gt.empleados e where e.id = v_pers.empleado_id and e.prueba and not e.activo);
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
  return jsonb_build_object('ok', true, 'vista', v_vista or v_prueba, 'principal', v_pr, 'planta', v_planta,
    'personal', v_pers.clave is not null and not v_prueba, 'da_codigo', v_pers.da_codigo_planta, 'empleados', coalesce((
    select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre, 'legajo', e.legajo,
             'plantas', coalesce((select jsonb_agg(jsonb_build_object('codigo', p.codigo, 'nombre', p.nombre) order by p.orden, p.codigo)
                                    from gt.empleado_planta ep join gt.plantas p on p.codigo = ep.planta and p.activo
                                   where ep.empleado_id = e.id),
                                 (select jsonb_build_array(jsonb_build_object('codigo', p.codigo, 'nombre', p.nombre))
                                    from gt.plantas p where p.codigo = v_pr),
                                 '[]'::jsonb))
                     order by gt.legajo_num(e.legajo) nulls last, e.nombre)
      from gt.empleados e where (e.activo or (v_prueba and e.id = v_pers.empleado_id))
       and (v_pers.clave is null or e.id = v_pers.empleado_id)
       and (v_planta is null or exists (select 1 from gt.empleado_planta ep where ep.empleado_id = e.id and ep.planta = v_planta))), '[]'::jsonb));
end $function$;

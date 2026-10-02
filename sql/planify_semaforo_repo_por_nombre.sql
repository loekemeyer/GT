-- Semáforo de repos por NOMBRE (Elías, 02/10/2026: «no deberías tener que hacer un SQL por cada nuevo repo»).
-- Proyecto hrxfctzncixxqmpfhskv. Los objetos son de Planify / auditoría, no del schema gt: el archivo queda acá porque
-- salió de una sesión de GT. Aplicado como migraciones `planify_semaforo_repo_por_nombre` y `…_fix_owner`.
--
-- Antes: planify_proyecto_via_libre y planify_proyecto_sesion_abrir pedían el repo_id de github_repo_problemas.repos.
-- Un repo que nunca registró un problema no estaba en esa tabla (GT, el 02/10) y el semáforo no se podía usar sin un
-- insert a mano. registrar_problema ya lo daba de alta solo; el semáforo no.
-- Ahora las dos aceptan 'owner/repo' (también 'Owner/Repo' o la URL de GitHub con o sin .git):
--   · sesion_abrir lo da de alta solo si no existe (después de chequear que el empleado esté autorizado).
--   · via_libre sólo lo busca: un repo sin alta no tiene a nadie adentro = vía libre. Una consulta no escribe.
-- Las versiones con repo_id quedan como estaban. El parámetro nuevo se llama p_repo (no p_repo_id): PostgREST elige la
-- función por el NOMBRE de los parámetros, así la página de Planify que manda p_repo_id sigue cayendo en la de siempre.
--
-- Rollback (lo corre el dueño en el SQL Editor: el conector no deja DROP):
--   drop function planify.planify_proyecto_via_libre(bigint, text);
--   drop function planify.planify_proyecto_sesion_abrir(bigint, text, text, text, text, text);
--   drop function github_repo_problemas.repo_asegurar(text);
--   drop function github_repo_problemas.repo_normalizar(text);

create or replace function github_repo_problemas.repo_normalizar(p_repo text)
returns text language sql immutable set search_path = pg_temp as $$
  select regexp_replace(regexp_replace(lower(btrim(coalesce(p_repo, ''))),
           '^(https?://)?(www\.)?github\.com/', ''), '(\.git)?/*$', '');
$$;

-- el id del repo, dándolo de alta si no existe (owner y nombre son columnas generadas del full_name: no se escriben)
create or replace function github_repo_problemas.repo_asegurar(p_repo text)
returns bigint language plpgsql security definer set search_path = github_repo_problemas, pg_temp as $$
declare v_full text := github_repo_problemas.repo_normalizar(p_repo); v_id bigint;
begin
  if v_full !~ '^[^/\s]+/[^/\s]+$' then
    raise exception 'Repo inválido: «%» (va owner/repo)', p_repo;
  end if;
  insert into github_repo_problemas.repos (full_name)
  values (v_full)
  on conflict (full_name) do update set full_name = excluded.full_name
  returning id into v_id;
  return v_id;
end $$;
revoke all on function github_repo_problemas.repo_normalizar(text) from public, anon, authenticated;
revoke all on function github_repo_problemas.repo_asegurar(text) from public, anon, authenticated;

create or replace function planify.planify_proyecto_via_libre(p_employee_id bigint, p_repo text)
returns table(sesion_id bigint, quien text, que_hace text, branch text, estado text, sesion_url text,
              desde timestamptz, ultimo_latido timestamptz)
language sql stable security definer set search_path = planify, pg_temp as $$
  select * from planify.planify_proyecto_via_libre(p_employee_id,
    coalesce((select r.id from github_repo_problemas.repos r
               where r.full_name = github_repo_problemas.repo_normalizar(p_repo)), -1::bigint));
$$;

create or replace function planify.planify_proyecto_sesion_abrir(p_employee_id bigint, p_repo text,
  p_sesion_url text default null, p_que_hace text default null, p_branch text default null,
  p_estado text default 'trabajando')
returns bigint language plpgsql security definer set search_path = planify, pg_temp as $$
begin
  -- primero el permiso: quien no puede usar el semáforo tampoco da de alta repos
  if not planify.planify_proyectos_autorizado(p_employee_id) then
    raise exception 'Solo IT y Diseno pueden registrarse en el semaforo';
  end if;
  return planify.planify_proyecto_sesion_abrir(p_employee_id, github_repo_problemas.repo_asegurar(p_repo),
                                               p_sesion_url, p_que_hace, p_branch, p_estado);
end $$;

-- mismos permisos que las versiones con repo_id
revoke all on function planify.planify_proyecto_via_libre(bigint, text) from public;
revoke all on function planify.planify_proyecto_sesion_abrir(bigint, text, text, text, text, text) from public;
grant execute on function planify.planify_proyecto_via_libre(bigint, text) to anon, authenticated;
grant execute on function planify.planify_proyecto_sesion_abrir(bigint, text, text, text, text, text) to anon, authenticated;

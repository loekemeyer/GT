-- GT — acceso de sólo lectura a los pedidos de la página de TIERRA NATIVA (D12). PASO 1 de 2.
-- Lo corre Thomas UNA SOLA VEZ en el SQL Editor del proyecto Supabase de Tierra Nativa (zjvpzqhbekxnwxdczpof).
-- Después no hay que volver a tocarlo, salvo que se cambie la contraseña.
--
-- Antes de correrlo: reemplazar <CONTRASEÑA> por una propia, larga (30 caracteres o más, letras y números).
-- La misma contraseña va DESPUÉS al Vault del proyecto de Gestión (hrxfctzncixxqmpfhskv):
--   Dashboard → Project Settings → Vault → Add new secret → nombre tn_fdw_pass, valor la contraseña.
-- La contraseña NO se manda por el chat ni se guarda en ningún repo.

-- 1) el rol de sólo lectura con el que Gestión se conecta
create role gt_reader login password '<CONTRASEÑA>' nosuperuser nocreatedb nocreaterole noinherit;
grant usage on schema public to gt_reader;
grant select on all tables in schema public to gt_reader;
alter default privileges in schema public grant select on tables to gt_reader;

-- 2) las tablas con RLS prendida no se ven desde afuera aunque tengan el grant: una política de lectura por tabla
--    (es lo mismo que ya tiene Virgilio para lk_ppp_reader, 40 políticas).
do $$
declare t record;
begin
  for t in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('create policy gt_reader_lee on public.%I for select to gt_reader using (true)', t.relname);
  end loop;
end $$;

-- 3) comprobación (no depende de cómo se llamen las tablas): tablas_que_lee > 0 y escribe = 0
select count(*) filter (where privilege_type = 'SELECT')  as tablas_que_lee,
       count(*) filter (where privilege_type <> 'SELECT') as escribe
  from information_schema.role_table_grants
 where grantee = 'gt_reader' and table_schema = 'public';

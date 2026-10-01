-- GT — acceso de sólo lectura a los pedidos de TIERRA NATIVA (D12). PASO 2 de 2.
-- Se corre UNA SOLA VEZ en Gestión (hrxfctzncixxqmpfhskv), cuando el paso 1 ya corrió en Tierra Nativa y la
-- contraseña está en el Vault con el nombre tn_fdw_pass. La contraseña se lee del Vault: no aparece acá.
-- Mismo molde que LK → Virgilio (host directo db.<ref>.supabase.co, puerto 5432, sslmode require).

create extension if not exists postgres_fdw;

create server if not exists tn_db foreign data wrapper postgres_fdw
  options (host 'db.zjvpzqhbekxnwxdczpof.supabase.co', port '5432', dbname 'postgres', sslmode 'require');

do $$
declare v_pass text;
begin
  select decrypted_secret into v_pass from vault.decrypted_secrets where name = 'tn_fdw_pass';
  if v_pass is null then
    raise exception 'GT: falta el secreto tn_fdw_pass en el Vault de Gestión';
  end if;
  execute format('create user mapping if not exists for postgres server tn_db options (user %L, password %L)', 'gt_reader', v_pass);
end $$;

-- las tablas de Tierra Nativa se ven en el schema gt_tn (sólo lectura, y sólo desde el servidor: anon no las ve)
create schema if not exists gt_tn;
revoke all on schema gt_tn from anon, authenticated;
import foreign schema public from server tn_db into gt_tn;

-- comprobación (tarda ~2,4 s la primera vez: conexión entre proyectos)
select count(*) as pedidos_en_tn from gt_tn.orders;

-- gt_v164 (Thomas, 05/10/2026: D79 «sí, pero no sé cómo saber si es fija»). Antes de exigirle a Darío el wifi de Esnaola hay
-- que saber si la conexión de Esnaola sale siempre por la misma dirección. Se MIDE: cada evento que llega guarda la IP desde
-- la que lo mandó el celular (la que ve Supabase: cf-connecting-ip / x-forwarded-for de la request de la API).
-- ⚠ Un evento que quedó en la cola sin red se manda después desde donde esté el celular: puede traer otra IP. Mirar el INGRESO.
-- Consulta (por día, desde qué direcciones fichó cada uno en Esnaola):
--   select (ts_cliente at time zone 'America/Argentina/Buenos_Aires')::date dia, e.nombre, r.ip, count(*)
--     from gt.registros r join gt.empleados e on e.id = r.empleado_id where r.planta = 'ESNA' and r.ip is not null group by 1, 2, 3 order by 1, 2;
alter table gt.registros add column if not exists ip text;

create or replace function gt.trg_registro_ip()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
declare h jsonb;
begin
  begin h := nullif(current_setting('request.headers', true), '')::jsonb; exception when others then h := null; end;
  if h is not null then   -- siempre la de la request (no la que diga el celular)
    new.ip := nullif(btrim(coalesce(h->>'cf-connecting-ip', split_part(h->>'x-forwarded-for', ',', 1), h->>'x-real-ip')), '');
  end if;
  return new;
end $function$;

create trigger zz_gt_registro_ip before insert on gt.registros for each row execute function gt.trg_registro_ip();

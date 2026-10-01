-- GT 1.2 (01/10/2026, Thomas) — APLICADO. Aviso a «GT Avisos» cuando alguien EMPIEZA un área con un código que
-- no está en la lista de esa área. En la base (trigger): avisa aunque el celular tenga la app vieja.
-- Uno por (área, código, día). Si falla, no frena el registro.
-- Rollback (en el SQL Editor; el conector no deja pasar DROP):
--   drop trigger gt_alerta_codigo_nuevo on gt.registros;
--   drop function gt.trg_alerta_codigo_nuevo(), gt.codigo_en_lista(text, text), gt.area_tiene_lista(text);
create or replace function gt.codigo_en_lista(p_rubro text, p_cod text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from (
      select c.codigo from gt.codigos c join gt.codigo_area a on a.codigo = c.codigo where a.rubro = p_rubro and c.activo
      union all
      select k.codigo from gt.codigos_rubro k where k.rubro = p_rubro and k.activo) l
     where regexp_replace(upper(l.codigo), '^0+(?=\d)', '') = regexp_replace(upper(btrim(p_cod)), '^0+(?=\d)', ''));
$$;
create or replace function gt.area_tiene_lista(p_rubro text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from gt.codigo_area where rubro = p_rubro)
      or exists (select 1 from gt.codigos_rubro where rubro = p_rubro);
$$;
create or replace function gt.trg_alerta_codigo_nuevo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_area text; v_emp text; v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if gt.area_tiene_lista(new.rubro) and not gt.codigo_en_lista(new.rubro, new.texto) then
    select nombre into v_area from gt.rubros where codigo = new.rubro;
    select nombre into v_emp from gt.empleados where id = new.empleado_id;
    perform public.tg_enqueue(
      '⚠ GT — código no registrado: ' || upper(btrim(new.texto)) || ' en ' || coalesce(v_area, new.rubro) || E'\n' ||
      'Lo cargó ' || coalesce(v_emp, '?') || ' a las ' ||
      to_char(coalesce(new.ts_cliente, now()) at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') || '.' || E'\n' ||
      'Decime qué es para sumarlo a la lista.',
      'gt-codnuevo-' || new.rubro || '-' || upper(btrim(new.texto)) || '-' || v_hoy::text,
      coalesce((select valor from gt.config where clave = 'telegram_chat'), '-1004379879565'));
  end if;
  return null;
exception when others then
  return null;
end $$;
create trigger gt_alerta_codigo_nuevo after insert on gt.registros
  for each row when (new.opcion = 'AREA' and new.ts_inicio is null and coalesce(btrim(new.texto), '') <> '')
  execute function gt.trg_alerta_codigo_nuevo();

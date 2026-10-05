-- gt_v160 (Thomas, 05/10/2026: «si siguen cargando producciones de un código que no lo tienen agendado, quiero que me siga
-- llegando la alerta por Telegram, no sólo la primera vez»). Antes: un aviso por área + código + DÍA (dedup_key con la
-- fecha). Ahora: uno por APERTURA (dedup_key con el client_id: el mismo evento reenviado por la cola offline no repite),
-- con cuántas veces se usó ese código en esa área y desde cuándo.
-- Rollback: volver la dedup_key a 'gt-codnuevo-' || rubro || '-' || código || '-' || fecha (sql/gt_alerta_codigo_no_registrado.sql)
create or replace function gt.trg_alerta_codigo_nuevo()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_area text; v_emp text; v_veces int; v_primera timestamptz;
begin
  if gt.area_tiene_lista(new.rubro) and not gt.codigo_en_lista(new.rubro, new.texto) then
    select nombre into v_area from gt.rubros where codigo = new.rubro;
    select nombre into v_emp from gt.empleados where id = new.empleado_id;
    select count(*), min(ts_cliente) into v_veces, v_primera from gt.registros
     where opcion = 'AREA' and ts_inicio is null and rubro = new.rubro and upper(btrim(texto)) = upper(btrim(new.texto));
    perform public.tg_enqueue(
      '⚠ GT — código no registrado: ' || upper(btrim(new.texto)) || ' en ' || coalesce(v_area, new.rubro) || E'\n' ||
      'Lo cargó ' || coalesce(v_emp, '?') || ' a las ' ||
      to_char(coalesce(new.ts_cliente, now()) at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') || '.' || E'\n' ||
      case when v_veces > 1 then 'Ya van ' || v_veces || ' veces en ' || coalesce(v_area, new.rubro) || ' (la primera, el ' ||
        to_char(v_primera at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') || ').' || E'\n' else '' end ||
      'Decime qué es para sumarlo a la lista.',
      'gt-codnuevo-' || new.client_id,
      coalesce((select valor from gt.config where clave = 'telegram_chat'), '-1004379879565'));
  end if;
  return null;
exception when others then
  return null;
end $function$;

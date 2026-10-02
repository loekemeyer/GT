-- gt_v158 (D62, Thomas, 02/10/2026): todo lo cargado antes del lunes 05/10 fue prueba. Aplicado desde la sesión el 02/10.
-- Hasta el lunes 05/10 12:00 ART, un evento con hora anterior al lunes no entra a gt.registros: va al respaldo
-- (gt.bkp_registros_pruebas_20261002) y el celular lo da por enviado (gt_registrar lo cuenta como ok). Cubre las
-- pruebas del fin de semana y las que un celular sin red mande tarde: con esto el borrado de
-- sql/gt_borrar_pruebas_antes_del_lunes.sql alcanza con correrlo UNA vez. Pasado el lunes 12:00 no hace nada.
-- Apagarlo: alter table gt.registros disable trigger aaa_gt_pruebas_antes_del_lunes;
-- Probado en transacción abortada: evento del sábado 03/10 → 0 en registros, 1 en el respaldo · del lunes 08:00 → 1 en registros.
create or replace function gt.trg_pruebas_antes_del_lunes() returns trigger
language plpgsql security definer set search_path = '' as $fn$
begin
  if now() < '2026-10-05 12:00-03'::timestamptz and new.ts_cliente < '2026-10-05 00:00-03'::timestamptz then
    begin
      insert into gt.bkp_registros_pruebas_20261002 select (new).*;
    exception when others then null;   -- si el respaldo cambia de forma, la prueba se descarta igual
    end;
    return null;
  end if;
  return new;
end $fn$;

create trigger aaa_gt_pruebas_antes_del_lunes before insert on gt.registros
  for each row execute function gt.trg_pruebas_antes_del_lunes();

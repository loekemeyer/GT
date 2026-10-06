-- Rollback de gt_v166: vuelve gt_registrar a la de la 1.56 (un error en una fila tira el lote entero) y le saca el permiso
-- de gt_log_envio al celular. La tabla gt.envio_errores queda (nadie más la lee).
create or replace function public.gt_registrar(p_filas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  f jsonb; ok jsonb := '[]'::jsonb; rech jsonb := '[]'::jsonb; v_cid text; v_emp bigint;
begin
  for f in select * from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb)) loop
    v_cid := f->>'client_id';
    v_emp := case when (f->>'empleado_id') ~ '^\d+$' then (f->>'empleado_id')::bigint end;
    if v_cid is null or v_cid = '' then
      rech := rech || jsonb_build_object('client_id', null, 'motivo', 'sin client_id');
    elsif v_emp is null or not exists (select 1 from gt.empleados e where e.activo and e.id = v_emp) then
      rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', 'empleado inexistente o inactivo');
    elsif f->>'opcion' = 'AREA' and not exists (select 1 from gt.rubros r where r.codigo = f->>'rubro') then
      rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', 'área inexistente');
    elsif f->>'opcion' <> 'AREA' and not exists (select 1 from gt.tareas t where t.codigo = f->>'opcion') then
      rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', 'tarea inexistente');
    elsif (f->>'cantidad') is not null and (f->>'cantidad') !~ '^\d+(\.\d+)?$' then
      rech := rech || jsonb_build_object('client_id', v_cid, 'motivo', 'cantidad inválida');
    else
      insert into gt.registros (client_id, empleado_id, opcion, rubro, cantidad, descripcion, texto, ts_cliente, ts_inicio, dispositivo, medida, planta, detalle)
      values (v_cid, v_emp, f->>'opcion', nullif(f->>'rubro',''), (f->>'cantidad')::numeric, f->>'descripcion', nullif(f->>'texto',''),
              (f->>'ts_cliente')::timestamptz, nullif(f->>'ts_inicio','')::timestamptz, f->>'dispositivo', nullif(btrim(f->>'medida'), ''),
              (select p.codigo from gt.plantas p where p.codigo = nullif(btrim(f->>'planta'), '')),
              case when jsonb_typeof(f->'detalle') = 'object' and f->'detalle' <> '{}'::jsonb then f->'detalle' end)
      on conflict (client_id) do nothing;
      ok := ok || to_jsonb(v_cid);
    end if;
  end loop;
  return jsonb_build_object('ok', ok, 'rechazados', rech);
end $function$;
revoke execute on function public.gt_log_envio(text, text, bigint, text, int, int, timestamptz) from anon, authenticated;

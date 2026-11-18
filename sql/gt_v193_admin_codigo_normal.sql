-- gt_v193 (18/11/2026, Tomás Beviglia: «no con el admin maestro, con el código normal»). YA APLICADO.
-- El admin de GT se entra con el código vivo de Planify («🔑 Código admin») de CUALQUIER persona de Planify: ya no se
-- exige el permiso al panel gt-admin del Admin Maestro. Probado en transacción abortada con Juan Cruz (51, sin permiso):
-- entra y su token pasa gt.pass_ok.
create or replace function public.gt_admin_identificar(p_codigo text, p_email text default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare r jsonb; v_tok text; v_vence timestamptz := now() + accesos.ident_duracion('gt-admin');
begin
  r := accesos.identificar_vivo('gt-admin', p_codigo);
  if not coalesce((r ->> 'ok')::boolean, false) then
    return jsonb_build_object('ok', false, 'motivo', coalesce(r ->> 'motivo', 'Código incorrecto o vencido.'));
  end if;
  v_tok := 'pl.' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into gt.admin_sesiones (hash, employee_id, nombre, email, vence_en)
  values (encode(extensions.digest(v_tok, 'sha256'), 'hex'), (r ->> 'employee_id')::bigint, r ->> 'nombre',
          left(lower(nullif(btrim(p_email), '')), 120), v_vence);
  return jsonb_build_object('ok', true, 'token', v_tok, 'nombre', r ->> 'nombre',
    'resta_s', floor(extract(epoch from v_vence - now()))::int);
end $function$;

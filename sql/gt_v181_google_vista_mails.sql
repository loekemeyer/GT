-- gt_v181 (26/10/2026): mails que entran con Google en MODO VISTA (no graban nada).
-- Temporal: loekemeyer.n8n@gmail.com, para ver cómo es el ingreso con Google sin entrar como Darío.
-- Aplicada como migración gt_v181_google_vista_mails. Para sacarlo:
--   delete from gt.config where clave = 'google_vista_mails';
insert into gt.config (clave, valor) values ('google_vista_mails', 'loekemeyer.n8n@gmail.com')
  on conflict (clave) do update set valor = excluded.valor;

CREATE OR REPLACE FUNCTION public.gt_google_llave()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_mail text := lower(coalesce(auth.jwt()->>'email','')); v_k gt.clave_personal; v_vista text;
begin
  if v_mail = '' then return jsonb_build_object('ok', false, 'motivo', 'sin sesión'); end if;
  select * into v_k from gt.clave_personal k where lower(k.email) = v_mail and k.activo
     and exists (select 1 from gt.empleados e where e.id = k.empleado_id and e.activo) limit 1;
  if found then return jsonb_build_object('ok', true, 'llave', v_k.clave); end if;
  -- gt_v181: los mails de gt.config.google_vista_mails (separados por coma) entran con la clave de vista: no graban
  if v_mail = any (select lower(trim(m)) from unnest(string_to_array(coalesce((select valor from gt.config where clave = 'google_vista_mails'), ''), ',')) m) then
    select valor into v_vista from gt.config where clave = 'clave_vista';
    if coalesce(v_vista, '') <> '' then return jsonb_build_object('ok', true, 'llave', v_vista, 'vista', true); end if;
  end if;
  return jsonb_build_object('ok', false, 'motivo', 'mail no habilitado', 'email', v_mail);
end $function$;

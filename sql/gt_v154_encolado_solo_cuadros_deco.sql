-- GT gt_v154 (Elías, 02/10/2026): «lo único que se encola son los artículos de deco y los de cuadros, y los portarretratos
-- del 220 al 224. Todo el resto de los portarretratos no se encolan».
-- · gt.codigo_area.activo: false = el código no se hace en esa área (el conector no deja DELETE). La lista del celular
--   (gt_codigos_area / gt_codigos_area2), el aviso de código no registrado (gt.codigo_en_lista) y gt.area_tiene_lista leen
--   sólo las activas.
-- · Encolado queda con 198: 146 cuadros («Cuadro» / «Cuadros», MDF incluidos), 47 de deco (bandejas, cajones, sets de
--   bandejas 518 / 519 / 660, cuelgas, percheros, cartel, secaplatos, org. canasta, arbolito, letrero, mini cartel) y los
--   portas 220 a 224. Salen 112: 58 portas, 10 espejos, 4 múltiples, 2 diplomas y 38 de reventa (fabrica = false); más 5 que
--   ya estaban discontinuados. Hasta el 02/10 sólo se habían encolado cuadros (173, 183, 184, 185) y los portas 223 y 224.
-- · gt.movimientos: Montaje descuenta «encolado» sólo de lo que está en la lista activa de Encolado (un porta que no se
--   encola no deja el depósito interno en negativo). Probado en transacción abortada: Montaje de 781 y de 183, 1 caja cada
--   uno → antes 2 movimientos de encolado, después 1 (el del 183).
-- · D56 (Elías, 02/10: «diplomas sí se encola»): después volvieron el 192 y el 214 → 200
--   update gt.codigo_area set activo = true where rubro = 'ENCOL' and codigo in ('192','214') and not activo
-- ROLLBACK: update gt.codigo_area set activo = true where rubro = 'ENCOL' · y el bloque de la vista al revés (sacar el AND).
-- ⚠ sql/gt_movimientos_vivo.sql es la vista de la 1.25 (no tiene gt_v140 a gt_v142 ni esto): la vigente es
--   select pg_get_viewdef('gt.movimientos'::regclass, true).

alter table gt.codigo_area add column if not exists activo boolean not null default true;
comment on column gt.codigo_area.activo is 'gt_v154: false = el código no se hace en esa área (el conector no deja DELETE). La lista del celular y el aviso de código no registrado leen sólo las activas.';

CREATE OR REPLACE FUNCTION public.gt_codigos_area()
 RETURNS TABLE(codigo text, descripcion text, medida text, rubro text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select c.codigo, c.descripcion, c.medida, a.rubro
    from gt.codigos c join gt.codigo_area a on a.codigo = c.codigo and a.activo
   where c.activo
  union all
  select k.codigo, k.descripcion, k.medida, k.rubro from gt.codigos_rubro k where k.activo
  order by 4, 1;
$function$;

CREATE OR REPLACE FUNCTION gt.codigo_en_lista(p_rubro text, p_cod text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from (
      select c.codigo from gt.codigos c join gt.codigo_area a on a.codigo = c.codigo where a.rubro = p_rubro and a.activo and c.activo
      union all
      select k.codigo from gt.codigos_rubro k where k.rubro = p_rubro and k.activo) l
     where regexp_replace(upper(l.codigo), '^0+(?=\d)', '') = regexp_replace(upper(btrim(p_cod)), '^0+(?=\d)', ''));
$function$;

CREATE OR REPLACE FUNCTION gt.area_tiene_lista(p_rubro text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from gt.codigo_area where rubro = p_rubro and activo)
      or exists (select 1 from gt.codigos_rubro where rubro = p_rubro);
$function$;

update gt.codigo_area a set activo = false
  from gt.codigos c
 where c.codigo = a.codigo and a.rubro = 'ENCOL' and a.activo
   and not (c.descripcion ~* '^Cuadros?\M' or c.codigo in ('220','221','222','223','224'))
   and (not c.fabrica or split_part(c.descripcion, ' ', 1) in ('Porta', 'Espejo', 'Diploma', 'Multiple'));

-- la vista, parcheada sobre la definición VIVA (aplicado así el 02/10/2026)
do $aplica$
declare d text; viejo text; nuevo text; n int;
begin
  d := pg_get_viewdef('gt.movimientos'::regclass, true);
  viejo := $v$'encolado'::text,
            rp.producto,
            rp.medida,
            - rp.u,
            'ok'::text,
            rp.nota
           FROM rp
          WHERE rp.area = 'MONT'::text$v$;
  nuevo := viejo || $v$ AND (EXISTS ( SELECT 1
                   FROM gt.codigo_area ca
                  WHERE ca.rubro = 'ENCOL'::text AND ca.activo AND ca.codigo = rp.producto))$v$;
  n := (length(d) - length(replace(d, viejo, ''))) / length(viejo);
  if n <> 1 then raise exception 'el trozo aparece % veces', n; end if;
  execute 'create or replace view gt.movimientos with (security_invoker = true) as ' || replace(d, viejo, nuevo);
end $aplica$;
comment on view gt.movimientos is 'gt_v154 (Elías 02/10): Montaje descuenta encolado sólo de lo que se encola (gt.codigo_area ENCOL activa: cuadros, deco y portas 220 a 224).';

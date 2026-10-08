-- gt_v169 (Thomas, 08/10/2026) — tres pedidos juntos:
-- 1) Deco: más códigos que sirven para varios artículos y preguntan cuál (gt_v168):
--      3004 Patas c/Trav · 3001 Armado Bastidor · 3061 Bastidor + Patas c/Tornillo → 540, 542, 547
--      3008 Manija 03 + Corte 012 13 cm → 456, 536, 818, 534
--      3007 Manija 03 + Corte 012 20 cm · 3079 Armado Bandeja 20x20 → 535, 549, 452
--    3002 / 3003 (bastidor 540 / 547) y 3060 / 3063 (bastidor + patas 540 / 547) quedan activos: D103.
-- 2) Puesta a punto encoladora: «¿Con quién lo hacés?» al empezar (gt.rubro_pasos, fuente 'companeros': los empleados
--    activos por legajo, con «Solo» primero. El celular 1.60 saca al que pregunta). Va en detalle.con.
-- 3) Guardado a góndola: al terminar, «¿A dónde fue?» Góndola / Pedidos (detalle.destino). En gt.movimientos lo que
--    va a Pedidos suma en 'armado' (lo armado para pedidos, lo mismo que suma el área Pedidos) en vez de 'gondola'.
--    Lo de contraído se descuenta igual.
-- Rollback: update gt.codigos_rubro set articulos = null where codigo in (…) · update gt.rubro_pasos set rubro = 'X' …
--   (el conector no deja DELETE: lo borra el dueño en el SQL Editor) · gt.movimientos con 'gondola' fijo en GUARD.

update gt.codigos_rubro set articulos = array['540', '542', '547'],
       descripcion = 'Patas c/Trav — 540/542/547 Bandeja Cama Chica 30x40' where rubro = 'DECO' and codigo = '3004';
update gt.codigos_rubro set articulos = array['540', '542', '547'],
       descripcion = 'Armado Bastidor — 540/542/547 Bandeja Cama Chica 30x40' where rubro = 'DECO' and codigo = '3001';
update gt.codigos_rubro set articulos = array['540', '542', '547'],
       descripcion = 'Bastidor + Patas c/Tornillo — 540/542/547 Bandeja Cama Chica 30x40' where rubro = 'DECO' and codigo = '3061';
update gt.codigos_rubro set articulos = array['456', '536', '818', '534'],
       descripcion = 'Manija 03 + Corte 012 13 cm — 456/536/818/534 Bandeja 13x30' where rubro = 'DECO' and codigo = '3008';
update gt.codigos_rubro set articulos = array['535', '549', '452'],
       descripcion = 'Manija 03 + Corte 012 20 cm — 535/549/452 Bandeja 20x20' where rubro = 'DECO' and codigo = '3007';
update gt.codigos_rubro set articulos = array['535', '549', '452'],
       descripcion = 'Armado Bandeja — 535/549/452 Bandeja 20x20' where rubro = 'DECO' and codigo = '3079';

insert into gt.rubro_pasos (rubro, orden, campo, pregunta, opciones, fuente, momento)
select 'PAPENC', 1, 'con', '¿Con quién lo hacés?', null, 'companeros', 'empezar'
 where not exists (select 1 from gt.rubro_pasos where rubro = 'PAPENC' and campo = 'con');
insert into gt.rubro_pasos (rubro, orden, campo, pregunta, opciones, fuente, momento)
select 'GUARD', 1, 'destino', '¿A dónde fue?', array['Góndola', 'Pedidos'], null, 'terminar'
 where not exists (select 1 from gt.rubro_pasos where rubro = 'GUARD' and campo = 'destino');

create or replace function public.gt_pasos()
 returns table(rubro text, orden integer, campo text, pregunta text, opciones text[], fuente text, si_campo text, si_valor text, momento text)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select p.rubro, p.orden, p.campo, p.pregunta,
         case when p.fuente = 'molduras' then (select array_agg(m.moldura order by m.orden nulls last, m.moldura) from gt.molduras m)
              -- gt_v169: los empleados activos, por legajo (el celular saca al que pregunta)
              -- «Solo» primero, desde la base: así la pregunta sirve también en un celular con la app vieja (v169b)
              when p.fuente = 'companeros' then array['Solo'] || (select array_agg(e.nombre order by gt.legajo_num(e.legajo) nulls last, e.nombre)
                                                    from gt.empleados e where e.activo)
              else p.opciones end,
         p.fuente, p.si_campo, p.si_valor, p.momento
    from gt.rubro_pasos p join gt.rubros r on r.codigo = p.rubro and r.activo
   order by p.rubro, p.momento, p.orden;
$function$;

-- gt.movimientos: se parte de la definición VIVA y se cambia sólo el depósito del Guardado
do $v$
declare d text := pg_get_viewdef('gt.movimientos'::regclass, true);
        viejo text := E'''gondola''::text AS text,\n            rp.producto,\n            NULL::text AS text,\n            rp.u,\n            ''ok''::text AS text,\n            rp.nota\n           FROM rp\n          WHERE rp.area = ''GUARD''::text';
        nuevo text := E'CASE WHEN rp.detalle ->> ''destino'' = ''Pedidos'' THEN ''armado''::text ELSE ''gondola''::text END AS text,\n            rp.producto,\n            NULL::text AS text,\n            rp.u,\n            ''ok''::text AS text,\n            rp.nota\n           FROM rp\n          WHERE rp.area = ''GUARD''::text';
begin
  if (length(d) - length(replace(d, viejo, ''))) / length(viejo) <> 1 then
    raise exception 'gt.movimientos no tiene una sola vez el bloque de Guardado: no se cambia';
  end if;
  execute 'create or replace view gt.movimientos with (security_invoker = true) as ' || replace(d, viejo, nuevo);
end $v$;

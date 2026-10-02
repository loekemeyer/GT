-- GT gt_v143 (D31, Thomas 01/10/2026: «movimientos») — un área «Movimientos» en la botonera: sin código ni cantidad,
-- en TODAS las plantas. Es una pausa del trabajo (mover material, racks, etc.): al terminarla el celular propone volver al
-- área productiva anterior (app.js 1.28, PAUSAS = ALMU + MOVIM; Recibir tampoco cuenta como productiva).
-- gt.rubros.todas_plantas: el área se ve en todas las plantas. gt_botones2 devuelve una fila por planta activa para esos
-- rubros (misma firma: no hace falta DROP) y el celular filtra por la planta elegida.
-- ROLLBACK: update gt.rubros set activo = false where codigo = 'MOVIM' (la columna y la función quedan, son inocuas).

alter table gt.rubros add column if not exists todas_plantas boolean not null default false;
comment on column gt.rubros.todas_plantas is '1.28 (D31): true = el área se ve en todas las plantas (gt_botones2 devuelve una fila por planta activa).';

insert into gt.rubros (codigo, nombre, unidad, orden, activo, pide_codigo, pide_cantidad, planta, todas_plantas)
values ('MOVIM', 'Movimientos', '—', 30, true, false, false, null, true)
on conflict (codigo) do update set nombre = excluded.nombre, unidad = excluded.unidad, orden = 30, pide_codigo = false, pide_cantidad = false, todas_plantas = true, activo = true;

create or replace function public.gt_botones2()
 returns table(codigo text, nombre text, unidad text, orden integer, pide_codigo boolean, pide_cantidad boolean, planta text)
 language sql stable security definer set search_path to ''
as $function$
  -- 1.28 (D31): un rubro con todas_plantas sale una vez por planta activa (el celular filtra por la planta elegida)
  select r.codigo, r.nombre, r.unidad, r.orden, r.pide_codigo, r.pide_cantidad, coalesce(p.codigo, r.planta) planta
    from gt.rubros r left join gt.plantas p on r.todas_plantas and p.activo
   where r.activo order by r.orden, r.codigo, p.orden;
$function$;

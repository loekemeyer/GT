-- gt_v172 (Thomas, 21/10/2026, D2): el vidrio que se corta en Deco SUMA al stock y se DESCUENTA cuando montan portas.
-- Pedido: «tiene que descontarse cuando montan portas», sobre «¿el corte de vidrio suma al stock de Vidrio {medida}
-- que gasta Montaje?».
--
-- Lo que ya estaba (gt_v142, regla 6 de gt.insumo_regla): Montaje de «porta», «multiple» y todo lo «c/Vidrio» descuenta
-- 1 «VIDRIO {medida del producto}» por unidad. Lo que faltaba:
--   1) gt.codigos_rubro.insumo: el insumo que PRODUCE un código propio de un rubro. Los 15 de Corte Vidrio (2001-2015)
--      producen «VIDRIO <medida del tablero>». gt.movimientos suma +cantidad a ese insumo al cerrar el tramo.
--   2) La regla 6 ya no descuenta vidrio a las «porta» que no lo llevan: Difusor, Vela, Sahumerio, Cepillo y Pasta,
--      Foto Broche y Broche Metálico [Probable].
--   3) Recetas por producto donde la medida del producto no es la del vidrio:
--      · portas c/Soga x2 / x3 (606-609) y múltiples (281, 283, 311, 312): la medida decía «10*15 x2» y descontaba
--        un «VIDRIO 10*15 x2» que nadie corta. Ahora N vidrios de la medida de cada ventana (la del aro).
--      · c/Vidrio 30*40 con aro de 27.5*40 (Diplomas 192 y 214, Cuadro Vintage 228): el vidrio es el del aro,
--        27.5*40 (código 2006 del tablero) [Probable]. 227 (20*30, aro 20*27.5) y 224 (Porta Gigante 30*40) quedan
--        como estaban: el tablero no tiene ese vidrio (D4).
--      Una receta por producto REEMPLAZA a todas las reglas de esa etapa (gt.producto_insumo), así que lleva también
--      el FONDO de la regla 7, con la misma lógica de una por ventana [Adivinando, como la regla 7].
-- ⚠ El 7b0c7fb (gt_v171) dice «Hecho-por: sin confirmar»: lo hizo Thomas (employee_id 3).
--
-- Rollback:
--   update gt.codigos_rubro set insumo = null where rubro = 'DECO' and codigo between '2001' and '2015';
--   update gt.insumo_regla set excluye = null where id = 6;
--   update gt.insumo_receta set activo = false where fuente = 'gt_v172';
--   (la rama nueva de gt.movimientos sin filas con insumo no suma nada)

alter table gt.codigos_rubro add column if not exists insumo text;
comment on column gt.codigos_rubro.insumo is
  'gt_v172: insumo que produce este código al cerrar el tramo (+cantidad en gt.movimientos, depósito insumo). Ej.: VIDRIO 10*15';

update gt.codigos_rubro set insumo = 'VIDRIO ' || medida
 where rubro = 'DECO' and codigo between '2001' and '2015' and descripcion = 'Corte Vidrio';

-- gt.movimientos: se parte de la definición VIVA y se agrega una rama al final de mov
do $v$
declare d text; n int;
  ancla constant text := 'x.insumo <> ''-''::text';
begin
  d := pg_get_viewdef('gt.movimientos'::regclass, true);
  if position('cri.insumo' in d) > 0 then raise notice 'gt_v172 ya aplicada'; return; end if;
  n := (length(d) - length(replace(d, ancla, ''))) / length(ancla);
  if n <> 1 then raise exception 'movimientos: el ancla aparece % veces', n; end if;
  execute 'create or replace view gt.movimientos with (security_invoker = true) as ' || replace(d, ancla, ancla || '
        UNION ALL
         SELECT r.registro_id,
            r.ts,
            r.dia,
            r.empleado_id,
            r.planta,
            r.area,
            ''insumo''::text AS text,
            cri.insumo,
            NULL::text AS text,
            r.cantidad,
            ''ok''::text AS text,
            NULL::text AS text
           FROM r
             JOIN gt.codigos_rubro cri ON cri.rubro = r.area AND cri.insumo IS NOT NULL AND gt.sin0(cri.codigo) = gt.sin0(r.texto)');
end $v$;

update gt.insumo_regla
   set excluye = 'Difusor|Vela|Sahumerio|Cepillo|Broche',
       nota = nota || ' · gt_v172 (Thomas 21/10): sin las porta que no llevan vidrio'
 where id = 6 and excluye is null;

-- gt.insumo_receta.insumo tiene FK a gt.insumos: los vidrios del tablero (más el 10*10 del 281) y los fondos de las recetas
insert into gt.insumos (codigo, nombre, unidad, activo, nota)
select 'VIDRIO ' || m, 'Vidrio ' || m, 'u', true, 'gt_v172: lo suma Corte Vidrio (Deco), lo descuenta Montaje' from unnest(array[
  '10*10', '10*15', '13*18', '15*21', '20*25', '20*30', '27.5*40', '29*40', '40*50', '50*60', '60*80', '60*100',
  '15*37', '8.5*23', '17.5*23', '23*26.5']) m
union all
select 'FONDO ' || m, 'Fondo ' || m, 'u', true, 'gt_v172: recetas de portas x2/x3 y múltiples [Adivinando]'
  from unnest(array['10*10', '10*15', '13*18', '15*21', '30*40']) m
on conflict do nothing;

insert into gt.insumo_receta (nivel, codigo, insumo, cantidad, etapa, fuente, nota, activo, por_pieza)
select 'producto', p, i, c, 'MONT', 'gt_v172', n, true, false from (values
  ('606', 'VIDRIO 10*15', 2, 'c/Soga x2: un vidrio por ventana'),  ('606', 'FONDO 10*15', 2, '[Adivinando] regla 7, uno por ventana'),
  ('607', 'VIDRIO 10*15', 3, 'c/Soga x3: un vidrio por ventana'),  ('607', 'FONDO 10*15', 3, '[Adivinando] regla 7, uno por ventana'),
  ('608', 'VIDRIO 13*18', 2, 'c/Soga x2: un vidrio por ventana'),  ('608', 'FONDO 13*18', 2, '[Adivinando] regla 7, uno por ventana'),
  ('609', 'VIDRIO 13*18', 3, 'c/Soga x3: un vidrio por ventana'),  ('609', 'FONDO 13*18', 3, '[Adivinando] regla 7, uno por ventana'),
  ('283', 'VIDRIO 10*15', 4, 'Multiple X4: un vidrio por ventana'), ('283', 'FONDO 10*15', 4, '[Adivinando] regla 7, uno por ventana'),
  ('311', 'VIDRIO 13*18', 4, 'Multiple x4: un vidrio por ventana'), ('311', 'FONDO 13*18', 4, '[Adivinando] regla 7, uno por ventana'),
  ('312', 'VIDRIO 15*21', 4, 'Multiple x4: un vidrio por ventana'), ('312', 'FONDO 15*21', 4, '[Adivinando] regla 7, uno por ventana'),
  ('281', 'VIDRIO 10*10', 2, 'Multiple X6: un vidrio por ventana'), ('281', 'FONDO 10*10', 2, '[Adivinando] regla 7, uno por ventana'),
  ('281', 'VIDRIO 10*15', 2, 'Multiple X6: un vidrio por ventana'), ('281', 'FONDO 10*15', 2, '[Adivinando] regla 7, uno por ventana'),
  ('281', 'VIDRIO 13*18', 2, 'Multiple X6: un vidrio por ventana'), ('281', 'FONDO 13*18', 2, '[Adivinando] regla 7, uno por ventana'),
  ('192', 'VIDRIO 27.5*40', 1, '[Probable] el vidrio es la medida del aro'), ('192', 'FONDO 30*40', 1, '[Adivinando] regla 7'),
  ('214', 'VIDRIO 27.5*40', 1, '[Probable] el vidrio es la medida del aro'), ('214', 'FONDO 30*40', 1, '[Adivinando] regla 7'),
  ('228', 'VIDRIO 27.5*40', 1, '[Probable] el vidrio es la medida del aro')
) v(p, i, c, n)
where not exists (select 1 from gt.insumo_receta x where x.fuente = 'gt_v172' and x.codigo = v.p and x.insumo = v.i);

-- verificación
-- select codigo, medida, insumo from gt.codigos_rubro where insumo is not null order by codigo;
-- select producto, insumo, cantidad, origen from gt.producto_insumo where etapa = 'MONT' and insumo like 'VIDRIO%' order by 1, 2;
-- select codigo, saldo from gt.stock where codigo like 'VIDRIO%' order by 1;

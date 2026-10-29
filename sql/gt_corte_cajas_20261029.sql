-- Corte de conteo de cajas, 29/10/2026 11:55 hora AR (Angely, planilla manuscrita «CAJA ARMADAS · ART EMBLISTADO · A EMBLISTAR»).
--   Cajas armadas: 0 en las 22 cajas.
--   Art. emblistado (en CAJAS, D10): 299=15 458=15 394=16 396=12 395=18 181=13 872=16 163=30 782=13 781=5 134=15 189=8 135=10 584=20  → 14 artículos, 206 cajas.
--   La columna «A emblistar» (233, 189, 406, 416, 414, 878) NO es stock de emblistado: entra sola cuando se registre Emblistado.
--   Sin movimientos de EMBL / CONTR / ARMCAJ entre las 11:20 y las 11:55, así que la hora exacta no cambia nada.
-- Una fila por cada caja (caja_armada) y por cada artículo con caja o con movimientos de emblistado (230 filas, en 0 los que no figuran):
-- sin la fila en cero el historial anterior al corte seguiría contando. cantidad en UNIDADES (cajas × UxB).
-- Resultado: 40*15 → 81 cajas por armar (6 artículos) · 40*50 → 56 (3) · 30 → 31 (2) · 38*38 → 20 (1) · 15 → 18 (2). Total 206.
-- Rollback: delete from gt.stock_inicial where nota like 'Corte 29/10%'   (el conector no deja DELETE: en el SQL Editor)
insert into gt.stock_inicial (deposito, codigo, medida, cantidad, contado_en, nota)
select 'caja_armada', codigo, '', 0, '2026-10-29 11:55:00-03'::timestamptz, 'Corte 29/10 (Angely): cajas armadas = 0'
  from gt.codigos_rubro where rubro = 'ARMCAJ'
on conflict (deposito, codigo, medida) do nothing;

insert into gt.stock_inicial (deposito, codigo, medida, cantidad, contado_en, nota)
select 'emblistado', k.codigo, '', coalesce(v.cajas, 0) * coalesce(nullif(c.uxb, 0), 1), '2026-10-29 11:55:00-03'::timestamptz,
       case when v.cajas is null then 'Corte 29/10 (Angely): 0' else 'Corte 29/10 (Angely): ' || v.cajas || ' cajas' end
  from (select codigo from gt.codigos where caja is not null union select s.codigo from gt.stock s join gt.codigos g on g.codigo = s.codigo where s.deposito = 'emblistado') k
  join gt.codigos c on c.codigo = k.codigo
  left join (values ('299',15),('458',15),('394',16),('396',12),('395',18),('181',13),('872',16),('163',30),('782',13),('781',5),('134',15),('189',8),('135',10),('584',20)) v(cod, cajas)
    on ltrim(v.cod, '0') = ltrim(k.codigo, '0')
on conflict (deposito, codigo, medida) do nothing;

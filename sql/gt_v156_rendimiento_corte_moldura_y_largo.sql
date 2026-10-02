-- GT gt_v156 (Elías, 02/10/2026: «el corte es por moldura y por corte (cm)»): en Rendimiento la fila de Corte es moldura +
-- largo de la pieza («Mold 03 · 25 cm», con coma decimal: «Mold 03 · 65,5 cm»), sin el color. Grampeado y el resto, igual.
-- Las 168 piezas de Corte tienen el largo en gt.codigos_rubro.medida («10 cm» a «120 cm»). Con los tramos reales: 125 →
-- «Mold 3P 3/4 · 30 cm», 15 → «Mold 03 · 65,5 cm», 16 → «Mold 03 · 10 cm», 25 → «Mold 03 · 30 cm».
-- ROLLBACK: la de sql/gt_v150_rendimiento.sql (sin « · » || medida en la rama de CORTE).
CREATE OR REPLACE FUNCTION gt.variable_rendimiento(p_rubro text, p_texto text, p_medida text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when p_rubro = 'CORTE' then
      (select 'Mold ' || (regexp_match(k.descripcion, '^(3P \d/\d|Trav \d+mm|\d+)'))[1] || coalesce(' · ' || replace(k.medida, '.', ','), '')
         from gt.codigos_rubro k where k.rubro = 'CORTE' and upper(k.codigo) = upper(btrim(p_texto)) limit 1)
    when p_rubro = 'GRAMP' then
      (select 'Mold ' || (regexp_match(k.descripcion, '^(3P \d/\d|Trav \d+mm|\d+)'))[1] || coalesce(' · ' || k.medida, '')
         from gt.codigos_rubro k where k.rubro = 'GRAMP' and upper(k.codigo) = upper(btrim(p_texto)) limit 1)
    else gt.familia(p_rubro, p_texto, p_medida) end
$function$;

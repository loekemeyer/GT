-- GT v1.18 — APLICADO el 2026-10-01 (Thomas): en DECO (bandejas, cajones, percheros, cuelgas…) sólo se agrupa
-- lo que tiene la misma descripción salvo el diseño / la línea de láminas: modelo (lo de antes de «Mold») +
-- moldura + medida. Cuadros, porta, espejos, diplomas y múltiples siguen con moldura + medida (1.16);
-- sets de 3, entre sets (1.17).
-- Resultado: 540 = 542 · 563 = 583 · 564 = 584 · 565 = 585 · 456 = 536 · 452 = 535 = 535W · 537 = 541 = 548;
-- 547 (Bandeja de Cama Mami), 543, 546, 538, 818, 150, 636 van solos.
create or replace function gt.grupo_auto(p_desc text, p_medida text) returns text
 language sql immutable set search_path to ''
as $$
  select case
    when coalesce(btrim(p_medida), '') = '' then null
    when gt.es_set3(p_desc) then 'Set x3 · ' || coalesce(gt.moldura_de(p_desc) || ' · ', '') ||
      (select string_agg(btrim(x), ' + ' order by btrim(x)) from unnest(string_to_array(p_medida, '+')) x)
    when gt.moldura_de(p_desc) is null then null
    when lower(split_part(btrim(p_desc), ' ', 1)) in ('cuadro', 'cuadros', 'porta', 'espejo', 'diploma', 'multiple')
      then gt.moldura_de(p_desc) || ' · ' || btrim(p_medida)
    else btrim(regexp_replace(p_desc, '\s*\mMold\M.*$', '', 'i')) || ' · ' || gt.moldura_de(p_desc) || ' · ' || btrim(p_medida) end
$$;

-- GT v1.19 — APLICADO el 2026-10-01 (Thomas, D41 / D42 / D43): excepciones a mano en gt.codigo_grupo.
insert into gt.codigo_grupo (codigo, grupo, nota) values
 ('818', 'Bandeja manija/mad · Mold 012 · 13*30', 'D42 Thomas 01/10: Mold 12 = Mold 012'),
 ('547', 'Bandeja de Cama · Mold 012 · 30*40', 'D41 Thomas 01/10: tarda igual que 540'),
 ('541', 'Bandeja Asas de Cuero · Mold 045 · 25*35', 'D43 Thomas 01/10: va solo')
on conflict (codigo) do update set grupo = excluded.grupo, nota = excluded.nota;
-- verificado: 818 con 456/536; 547 con 540/542; 541 solo (537/548 siguen juntos).

-- GT v12.0 (01/10/2026, Thomas) — APLICADO. Área «Recibir mercadería»: pregunta Insumo o Moldura.
-- Las opciones son códigos propios del área; la app las muestra como botones (≤ 6 y con nombre).
insert into gt.rubros (codigo, nombre, unidad, orden, pide_codigo)
  values ('RECIB', 'Recibir mercadería', 'unidades recibidas', 11, true) on conflict (codigo) do nothing;
insert into gt.codigos_rubro (rubro, codigo, descripcion) values
  ('RECIB', 'INSUMO', 'Insumo'), ('RECIB', 'MOLDURA', 'Moldura') on conflict (rubro, codigo) do nothing;

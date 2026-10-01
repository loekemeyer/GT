-- GT v1.26 — COLOR DEL MARCO por artículo y receta producto → aro por color (Thomas, 01/10/2026).
-- Fuente: fotos del catálogo de Tierra Nativa, clasificadas por ChatGPT (lo pasó Thomas) y por Claude, a ciegas.
-- Se carga SÓLO donde las dos coinciden (171 artículos), más los Porta Gigante 220–224 (ChatGPT y la 2ª mirada de
-- Claude) y 183/211/217/233 (ChatGPT no abrió la foto; Claude, seguridad alta). Los marrones de las molduras 012 y 05
-- (Cedro / Marrón / Roble) NO se cargan: las dos fuentes no coinciden y depende de D10.
--   · gt.codigo_color: una fila por (artículo, color). Un surtido tiene varias filas (proporción pendiente, D11).
--   · gt.color_aro(desc): el color de un aro de Grampeado (Bco, Bco P → Blanco; Bco T → Blanco total; Nat → Natural…).
--   · gt.producto_aro: si el artículo tiene UN color, sólo quedan los aros de ese color (Blanco acepta también Bco T:
--     en 3P 3/4 un «Blanco» sin más sigue entre Bco P y Bco T). Un artículo «c/Soga» sólo toma aros «p/soga» y al revés.
--     Lo resuelto por color sale con receta = 'color'.
-- Rollback (lo corre el dueño): drop table gt.codigo_color; drop function gt.color_aro(text);
--   y volver gt.producto_aro a la definición de gt_v123_movimientos.sql.

create or replace function gt.color_aro(p text) returns text language sql immutable set search_path to '' as $$
  select case when p ~* '\mBco T\M' then 'Blanco total'
              when p ~* '\mBco\M' then 'Blanco'
              when p ~* '\mNat(ural)?\M' then 'Natural'
              when p ~* '\mNegro\M' then 'Negro'
              when p ~* '\mCedro\M' then 'Cedro'
              when p ~* '\mMarr[oó]n\M' then 'Marrón'
              when p ~* '\mRoble\M' then 'Roble'
              when p ~* '\mVerde\M' then 'Verde'
              when p ~* '\mCeleste\M' then 'Celeste'
              when p ~* '\mRosa\M' then 'Rosa' end
$$;
revoke all on function gt.color_aro(text) from public, anon, authenticated;

create table if not exists gt.codigo_color (
  codigo     text not null,
  color      text not null,
  proporcion numeric check (proporcion > 0 and proporcion <= 1),   -- sólo en surtidos (D11)
  fuente     text,
  nota       text,
  cargado_en timestamptz not null default now(),
  primary key (codigo, color)
);
alter table gt.codigo_color enable row level security;
revoke all on gt.codigo_color from anon, authenticated;

insert into gt.codigo_color (codigo, color, fuente, nota) values
('080','Sin marco','foto: ChatGPT y Claude coinciden',null),
('082','Sin marco','foto: ChatGPT y Claude coinciden',null),
('083','Sin marco','foto: ChatGPT y Claude coinciden',null),
('084','Sin marco','foto: ChatGPT y Claude coinciden',null),
('085','Sin marco','foto: ChatGPT y Claude coinciden',null),
('086','Sin marco','foto: ChatGPT y Claude coinciden',null),
('087','Sin marco','foto: ChatGPT y Claude coinciden',null),
('088','Sin marco','foto: ChatGPT y Claude coinciden',null),
('089','Sin marco','foto: ChatGPT y Claude coinciden',null),
('110','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('110','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('112','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('112','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('113','Blanco','foto: ChatGPT y Claude coinciden',null),
('114','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('114','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('115','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('115','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('118','Blanco','foto: ChatGPT y Claude coinciden',null),
('119','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('119','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('120','Natural','foto: ChatGPT y Claude coinciden',null),
('121','Blanco','foto: ChatGPT y Claude coinciden',null),
('122','Natural','foto: ChatGPT y Claude coinciden',null),
('123','Blanco','foto: ChatGPT y Claude coinciden',null),
('125','Natural','foto: ChatGPT y Claude coinciden',null),
('126','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('126','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('127','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('127','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('130','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('130','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('132','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('132','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('133','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('133','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('134','Negro','foto: ChatGPT y Claude coinciden',null),
('135','Negro','foto: ChatGPT y Claude coinciden',null),
('136','Natural','foto: ChatGPT y Claude coinciden',null),
('137','Natural','foto: ChatGPT y Claude coinciden',null),
('140','Blanco','foto: ChatGPT y Claude coinciden',null),
('141','Blanco','foto: ChatGPT y Claude coinciden',null),
('142','Blanco','foto: ChatGPT y Claude coinciden',null),
('143','Blanco','foto: ChatGPT y Claude coinciden',null),
('144','Blanco','foto: ChatGPT y Claude coinciden',null),
('145','Blanco','foto: ChatGPT y Claude coinciden',null),
('146','Negro','foto: ChatGPT y Claude coinciden',null),
('147','Blanco','foto: ChatGPT y Claude coinciden',null),
('148','Blanco','foto: ChatGPT y Claude coinciden',null),
('149','Blanco','foto: ChatGPT y Claude coinciden',null),
('151','Blanco','foto: ChatGPT y Claude coinciden',null),
('152','Blanco','foto: ChatGPT y Claude coinciden',null),
('153','Blanco','foto: ChatGPT y Claude coinciden',null),
('154','Negro','foto: ChatGPT y Claude coinciden',null),
('155','Negro','foto: ChatGPT y Claude coinciden',null),
('156','Negro','foto: ChatGPT y Claude coinciden',null),
('157','Negro','foto: ChatGPT y Claude coinciden',null),
('160','Verde','foto: ChatGPT y Claude coinciden',null),
('162','Celeste','foto: ChatGPT y Claude coinciden','surtido'),
('162','Lila','foto: ChatGPT y Claude coinciden','surtido'),
('163','Blanco','foto: ChatGPT y Claude coinciden',null),
('164','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('164','Negro','foto: ChatGPT y Claude coinciden','surtido'),
('165','Negro','foto: ChatGPT y Claude coinciden',null),
('166','Blanco','foto: ChatGPT y Claude coinciden',null),
('167','Blanco','foto: ChatGPT y Claude coinciden',null),
('169','Negro','foto: ChatGPT y Claude coinciden',null),
('170','Blanco','foto: ChatGPT y Claude coinciden',null),
('171','Blanco','foto: ChatGPT y Claude coinciden',null),
('173','Natural','foto: ChatGPT y Claude coinciden',null),
('174','Natural','foto: ChatGPT y Claude coinciden',null),
('176','Natural','foto: ChatGPT y Claude coinciden',null),
('180','Negro','foto: ChatGPT y Claude coinciden',null),
('181','Negro','foto: ChatGPT y Claude coinciden',null),
('182','Negro','foto: ChatGPT y Claude coinciden',null),
('183','Negro','foto: sólo Claude (ChatGPT no abrió la foto)',null),
('184','Negro','foto: ChatGPT y Claude coinciden',null),
('185','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('185','Negro','foto: ChatGPT y Claude coinciden','surtido'),
('186','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('186','Negro','foto: ChatGPT y Claude coinciden','surtido'),
('187','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('187','Negro','foto: ChatGPT y Claude coinciden','surtido'),
('188','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('188','Negro','foto: ChatGPT y Claude coinciden','surtido'),
('189','Negro','foto: ChatGPT y Claude coinciden',null),
('192','Blanco','foto: ChatGPT y Claude coinciden',null),
('211','Negro','foto: sólo Claude (ChatGPT no abrió la foto)',null),
('213','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('213','Negro','foto: ChatGPT y Claude coinciden','surtido'),
('215','Natural','foto: ChatGPT y Claude coinciden',null),
('216','Natural','foto: ChatGPT y Claude coinciden',null),
('217','Natural','foto: sólo Claude (ChatGPT no abrió la foto)',null),
('218','Natural','foto: ChatGPT y Claude coinciden',null),
('220','Blanco','foto: ChatGPT y 2ª mirada de Claude coinciden','surtido'),
('220','Negro','foto: ChatGPT y 2ª mirada de Claude coinciden','surtido'),
('221','Blanco','foto: ChatGPT y 2ª mirada de Claude coinciden','surtido'),
('221','Negro','foto: ChatGPT y 2ª mirada de Claude coinciden','surtido'),
('222','Blanco','foto: ChatGPT y 2ª mirada de Claude coinciden','surtido'),
('222','Negro','foto: ChatGPT y 2ª mirada de Claude coinciden','surtido'),
('223','Blanco','foto: ChatGPT y 2ª mirada de Claude coinciden','surtido'),
('223','Negro','foto: ChatGPT y 2ª mirada de Claude coinciden','surtido'),
('224','Blanco','foto: ChatGPT y 2ª mirada de Claude coinciden','surtido'),
('224','Negro','foto: ChatGPT y 2ª mirada de Claude coinciden','surtido'),
('227','Blanco','foto: ChatGPT y Claude coinciden',null),
('228','Blanco','foto: ChatGPT y Claude coinciden',null),
('229','Blanco','foto: ChatGPT y Claude coinciden',null),
('230','Natural','foto: ChatGPT y Claude coinciden',null),
('231','Natural','foto: ChatGPT y Claude coinciden',null),
('232','Natural','foto: ChatGPT y Claude coinciden',null),
('233','Natural','foto: sólo Claude (ChatGPT no abrió la foto)',null),
('237','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('237','Negro','foto: ChatGPT y Claude coinciden','surtido'),
('241','Natural','foto: ChatGPT y Claude coinciden',null),
('242','Natural','foto: ChatGPT y Claude coinciden',null),
('243','Natural','foto: ChatGPT y Claude coinciden',null),
('244','Natural','foto: ChatGPT y Claude coinciden',null),
('245','Natural','foto: ChatGPT y Claude coinciden',null),
('246','Natural','foto: ChatGPT y Claude coinciden',null),
('247','Natural','foto: ChatGPT y Claude coinciden',null),
('248','Natural','foto: ChatGPT y Claude coinciden',null),
('249','Natural','foto: ChatGPT y Claude coinciden',null),
('250','Natural','foto: ChatGPT y Claude coinciden',null),
('251','Natural','foto: ChatGPT y Claude coinciden',null),
('253','Negro','foto: ChatGPT y Claude coinciden',null),
('254','Negro','foto: ChatGPT y Claude coinciden',null),
('255','Negro','foto: ChatGPT y Claude coinciden',null),
('256','Negro','foto: ChatGPT y Claude coinciden',null),
('281','Natural','foto: ChatGPT y Claude coinciden',null),
('283','Natural','foto: ChatGPT y Claude coinciden',null),
('310','Blanco','foto: ChatGPT y Claude coinciden',null),
('311','Natural','foto: ChatGPT y Claude coinciden',null),
('312','Natural','foto: ChatGPT y Claude coinciden',null),
('346','Blanco','foto: ChatGPT y Claude coinciden',null),
('348','Blanco','foto: ChatGPT y Claude coinciden',null),
('374','Negro','foto: ChatGPT y Claude coinciden',null),
('378','Gris','foto: ChatGPT y Claude coinciden',null),
('390','Negro','foto: ChatGPT y Claude coinciden',null),
('391','Negro','foto: ChatGPT y Claude coinciden',null),
('392','Negro','foto: ChatGPT y Claude coinciden',null),
('393','Natural','foto: ChatGPT y Claude coinciden',null),
('394','Natural','foto: ChatGPT y Claude coinciden',null),
('395','Natural','foto: ChatGPT y Claude coinciden',null),
('396','Natural','foto: ChatGPT y Claude coinciden',null),
('397','Blanco','foto: ChatGPT y Claude coinciden',null),
('398','Blanco','foto: ChatGPT y Claude coinciden',null),
('403','Natural','foto: ChatGPT y Claude coinciden',null),
('404','Natural','foto: ChatGPT y Claude coinciden',null),
('405','Natural','foto: ChatGPT y Claude coinciden',null),
('406','Natural','foto: ChatGPT y Claude coinciden',null),
('407','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('407','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('408','Negro','foto: ChatGPT y Claude coinciden',null),
('409','Negro','foto: ChatGPT y Claude coinciden',null),
('410','Negro','foto: ChatGPT y Claude coinciden',null),
('411','Negro','foto: ChatGPT y Claude coinciden',null),
('412','Natural','foto: ChatGPT y Claude coinciden',null),
('414','Negro','foto: ChatGPT y Claude coinciden',null),
('416','Negro','foto: ChatGPT y Claude coinciden',null),
('417','Natural','foto: ChatGPT y Claude coinciden',null),
('419','Negro','foto: ChatGPT y Claude coinciden',null),
('420','Negro','foto: ChatGPT y Claude coinciden',null),
('421','Negro','foto: ChatGPT y Claude coinciden',null),
('427','Blanco','foto: ChatGPT y Claude coinciden',null),
('428','Blanco','foto: ChatGPT y Claude coinciden',null),
('444','Natural','foto: ChatGPT y Claude coinciden',null),
('445','Negro','foto: ChatGPT y Claude coinciden',null),
('446','Negro','foto: ChatGPT y Claude coinciden',null),
('447','Blanco','foto: ChatGPT y Claude coinciden',null),
('448','Natural','foto: ChatGPT y Claude coinciden',null),
('449','Natural','foto: ChatGPT y Claude coinciden',null),
('450','Natural','foto: ChatGPT y Claude coinciden',null),
('451','Blanco','foto: ChatGPT y Claude coinciden',null),
('455','Blanco','foto: ChatGPT y Claude coinciden',null),
('457','Natural','foto: ChatGPT y Claude coinciden',null),
('459','Natural','foto: ChatGPT y Claude coinciden',null),
('460','Natural','foto: ChatGPT y Claude coinciden',null),
('461','Negro','foto: ChatGPT y Claude coinciden',null),
('462','Negro','foto: ChatGPT y Claude coinciden',null),
('463','Negro','foto: ChatGPT y Claude coinciden',null),
('464','Negro','foto: ChatGPT y Claude coinciden',null),
('465','Natural','foto: ChatGPT y Claude coinciden',null),
('466','Natural','foto: ChatGPT y Claude coinciden',null),
('637','Blanco','foto: ChatGPT y Claude coinciden',null),
('640','Marrón','foto: ChatGPT y Claude coinciden',null),
('641','Marrón','foto: ChatGPT y Claude coinciden',null),
('642','Marrón','foto: ChatGPT y Claude coinciden',null),
('645','Blanco','foto: ChatGPT y Claude coinciden',null),
('780','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('780','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('781','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('781','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('781E','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('781E','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('782','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('782','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('782E','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('782E','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('783','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('783','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('784','Blanco','foto: ChatGPT y Claude coinciden','surtido'),
('784','Natural','foto: ChatGPT y Claude coinciden','surtido'),
('790','Blanco','foto: ChatGPT y Claude coinciden',null),
('791','Blanco','foto: ChatGPT y Claude coinciden',null),
('792','Blanco','foto: ChatGPT y Claude coinciden',null),
('793','Blanco','foto: ChatGPT y Claude coinciden',null),
('794','Blanco','foto: ChatGPT y Claude coinciden',null),
('814','Blanco','foto: ChatGPT y Claude coinciden',null),
('815','Blanco','foto: ChatGPT y Claude coinciden',null),
('816','Blanco','foto: ChatGPT y Claude coinciden',null)
on conflict (codigo, color) do nothing;

-- gt.producto_aro: sobre la definición VIVA. Parche por texto: falla si no matchea.
do $pa$
declare v text := pg_get_viewdef('gt.producto_aro'::regclass, true); n text;
begin
  if v like '%codigo_color%' then return; end if;
  n := replace(v, E'gt.perfil_producto(c.descripcion) AS perfil,',
    E'gt.perfil_producto(c.descripcion) AS perfil,\n            c.descripcion ~* ''soga''::text AS soga,\n            ( SELECT max(cc.color) AS max FROM gt.codigo_color cc WHERE cc.codigo = p.producto HAVING count(*) = 1) AS color,');
  if n = v then raise exception 'producto_aro: no matcheó pp'; end if; v := n;
  n := replace(v, E'gt.med_norm(codigos_rubro.medida) AS med\n           FROM gt.codigos_rubro',
    E'gt.med_norm(codigos_rubro.medida) AS med,\n            gt.color_aro(codigos_rubro.descripcion) AS color,\n            codigos_rubro.descripcion ~* ''p/soga''::text AS soga\n           FROM gt.codigos_rubro');
  if n = v then raise exception 'producto_aro: no matcheó aro'; end if; v := n;
  n := replace(v, E'LEFT JOIN aro a ON a.perfil = pp_1.perfil AND a.med = pp_1.med_aro',
    E'LEFT JOIN aro a ON a.perfil = pp_1.perfil AND a.med = pp_1.med_aro AND a.soga = pp_1.soga AND (pp_1.color IS NULL OR a.color = pp_1.color OR pp_1.color = ''Blanco''::text AND a.color = ''Blanco total''::text)');
  if n = v then raise exception 'producto_aro: no matcheó el join'; end if; v := n;
  n := replace(v, E'WHEN cand.n = 1 THEN ''auto''::text',
    E'WHEN cand.n = 1 THEN CASE WHEN pp.color IS NULL THEN ''auto''::text ELSE ''color''::text END');
  if n = v then raise exception 'producto_aro: no matcheó receta'; end if; v := n;
  execute 'create or replace view gt.producto_aro with (security_invoker = true) as ' || v;
end $pa$;
revoke all on gt.producto_aro from anon, authenticated;

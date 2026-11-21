# Insumos por producto (lámina, fondo, vidrio, gancho, blíster, grampas), Sublimado, vidrio de cada producto, colores de marco — reglas de GT

_Parte de `docs/REGLAS-GT-APP.md` (índice). Partido por tema el 21/11/2026; texto sin cambios, secciones en el orden del original._

### gt_v175 — Porta Cubo Colgante sin vidrio y dónde se descuenta el de la Caja de Té (Thomas, 21/10/2026: D6, D7)

- **D7:** *«El 348 no utiliza vidrio»*. La regla 6 suma «Cubo Colgante» a `excluye`: salen el 348 (30\*40) y el 346 (15\*21), el
  mismo producto en otra medida [Probable]. El FONDO no cambia. Ninguno se había registrado en Montaje.
- **D6:** *«en un paso se le pone el panel con bastidor y la tapa con bisagras ya tiene puesto el vidrio cuando se le va a poner
  todo junto»*. El vidrio se pone antes, en la tapa, pero **ningún paso registra eso** (el Bastidor 3031 y el Aro 3032 se
  tipean en Grampeado). El 3084 / 3086 / 3088 consume una tapa con su vidrio por caja, así que el descuento de gt_v173 queda ahí.
  Lo único que no ve: tapas ya armadas con vidrio que todavía no entraron a una caja (siguen contando como vidrio).
  `sql/gt_v175_cubo_colgante_sin_vidrio.sql`.

### gt_v173 — Sublimado 5101 a 5124 y el vidrio de cada producto (Thomas, 21/10/2026: D3 «sí», D4, D5 «no»)

- **Tablero «Codigos Sublimado»** → 24 códigos de Deco, «Sublimado <moldura> — <artículo>» (5101 «Sublimado Pareja 045 — 563
  Cajón 2 Tablas 15\*21», 5117 «Sublimado Aro Vintage 10\*15»…). Apagados los 5 de artículos discontinuados (563J, 564J, Cartel
  302: 5107–5110 y 5114). El 307 Arbolito va con moldura **012** como el tablero (la base dice «Mold 045»). No mueven stock.
  El 5101 / 5102 / 5103 ya se venían tipeando fuera de la lista (Juan Gimenez, Darío Mendez): dejaron de ser no identificados.
- **D4 — qué vidrio lleva cada uno:** 224 Porta Gigante 30\*40 → **29\*40** (receta en Montaje, con su FONDO) · 227 Cuadro
  Vintage c/Vidrio → **20\*30** (la regla 6 ya lo daba) · **15\*37 discontinuo** (2012 e insumo apagados) · **8.5\*23 → 661,
  17.5\*23 → 662, 23\*26.5 → 663**.
- **Las Cajas de Té no pasan por Montaje** (nunca se registró un 661–663 ahí): el vidrio se descuenta al cerrar en Deco el
  «Panal + Bastidor + Tapa c/Bisagras» (3084 / 3086 / 3088), uno por caja [Probable: va en la tapa]. Para eso
  **`gt.codigos_rubro.insumo_cant`**: cuánto mueve el insumo por unidad (vacío = +1, lo produce · −1 = lo consume), y la rama
  de gt_v172 en `gt.movimientos` multiplica por ese número.
- **D5 «no»:** sin conteo inicial; el stock de vidrio son sólo los movimientos. Al 21/10 (con lo ya cargado): 8.5\*23 −54,
  17.5\*23 −7, 23\*26.5 −12 (Cajas de Té armadas), 15\*21 −160, 27.5\*40 −16.
- Probado en transacción abortada: 2013 × 10 → +10 VIDRIO 8.5\*23 · 3084 × 4 → −4 · 224 × 1 caja (UxB 4) → −4 VIDRIO 29\*40 ·
  227 × 1 caja → −16 VIDRIO 20\*30 · 2001 × 5 → +5 · 5102 sin movimiento. `sql/gt_v173_sublimado_y_vidrio_cajas_te.sql`.

### Colores de marco por artículo (base, 01/10/2026)

- `gt.codigo_color` (artículo, color, proporción, fuente): una fila por color; un **surtido** tiene varias filas,
  repartidas parejo (1.26). Origen: las fotos del catálogo de Tierra Nativa, clasificadas por **ChatGPT** (lo pasó
  Thomas) y por **Claude**, a ciegas; se cargó donde **coinciden** (179 artículos) más lo que confirmó Thomas
  (`fuente = 'Thomas 01/10'`). El cruce completo está en `docs/colores_marco_cruce.csv`.
- **Marrones de 012 (D10, Thomas: «012 y 05 sí»):** rojizo = **Cedro**, miel = **Roble**, marrón oscuro = **Marrón**.
  Cargada la lectura de Claude, que aplicó esa regla (21 artículos: 214, 400, 402, 550, 553, 604 a 609, 710 a 714 y
  740 a 745). `sql/gt_v130_marrones_012.sql`. Sin cargar: los estampados (045) y los de deco que no se mandaron a ChatGPT.
- `gt.producto_aro` usa el color (`gt.color_aro`: Bco/Bco P → Blanco, Bco T → Blanco total, Nat → Natural). Un
  artículo «c/Soga» sólo toma aros «p/soga». **De 301 pares producto→aro, resueltos: 273** (12 al empezar el día; ver D22 arriba —
  los 14 sin aro de la lista de abajo ya están resueltos, discontinuados o preguntados en D26).
  Faltan 39: 25 sin color cargado (deco, 045 y el 817) y 14 sin aro en Grampeado: 03 Bco 10*25 (115), 3P 3/4 30*40 y 60*80
  (Porta Gigante 224 / 220), Mold 20mm (Porta Atril 640 a 645), 03 Negro 15*21 (Sets 408 / 409), 012 Nat 10*10 (281),
  012 Cedro 30*40 (Diploma 214), 012 Roble p/soga 10*15 (604) y 012 Nat 20*25 / 20*30 (713 / 714).
- **Blancos 3P 3/4 (D21, Thomas):** 790 a 793 y 310 llevan **Bco T**; 228 lleva **Bco P** (`gt.receta_aro`).
- **«Bco T es cubo» (D16, D24):** el Porta Cubo (814 a 816) lleva los aros **Bco T** chicos (063 a 065), igual que
  790 a 792; en Corte salen de las piezas **3P 3/4 Bco Total** (136 a 141, de 10 a 21 cm).
- `sql/gt_v126_color_marco.sql`, `sql/gt_v127_surtidos_paquete_corte.sql`, `sql/gt_v128_blancos_cubi.sql`.

### gt_v140 — INSUMOS por producto: lámina, fondo, vidrio, gancho, blíster, grampas (Thomas, 01/10/2026: D34 «sí»)

Hasta acá el despiece era sólo madera (moldura → piezas → aro → cuadro). Ahora cada producto puede llevar insumos, y
cada «Terminé» con cantidad los descuenta en la etapa que los consume. **Las tablas están VACÍAS hasta que Thomas pase
qué lleva cada grupo: sin filas, nada cambia** (la lámina genérica de Encolado sigue igual).

| objeto | qué es |
|---|---|
| `gt.insumos` | el catálogo: código, nombre, unidad (`u` por defecto) |
| `gt.insumo_receta` | qué lleva cada cosa: `nivel` **producto** (cantidad por unidad: un cuadro, un set) · **grupo** (lo mismo para todo el grupo de fabricación, `gt.grupo_codigo` = moldura + medida: 68 grupos para 317 activos, 93 van sueltos) · **aro** (cantidad por aro, se descuenta al grampear) + `etapa` donde se consume |
| `gt.producto_insumo` | la receta resuelta por producto: **la fila del producto manda sobre la de su grupo, ETAPA por etapa** |
| `gt.movimientos` | 3 cambios «D34»: − insumos del producto en su etapa (`deposito = 'insumo'`), − insumos del aro al grampear, y la lámina genérica sólo para el producto sin receta en ENCOL |
| `gt.demanda_insumos` | qué comprar = `a_fabricar` × UxB × receta (+ grampas × aros a grampear) − lo que hay en el depósito `insumo` (conteo: `gt.stock_inicial` con `deposito = 'insumo'`) |

- **Etapas por defecto** (si Thomas no dice otra): lámina → Encolado · fondo / vidrio → Montaje · gancho → Gancho ·
  blíster → Emblistado · film → Contraído · grampas → Grampeado (por aro).
- **Cargar es un `insert`**, con el «sí» ya dado en D34 (primero el insumo en el catálogo, después la receta):
  ```sql
  insert into gt.insumos (codigo, nombre, unidad) values ('LAM 30*40', 'Lámina 30×40', 'u') on conflict do nothing;
  insert into gt.insumo_receta (nivel, codigo, insumo, cantidad, etapa, fuente)
  values ('grupo', 'Mold 03 · 30*40', 'LAM 30*40', 1, 'ENCOL', 'Thomas 02/10') on conflict (nivel, codigo, insumo, etapa) do update
     set cantidad = excluded.cantidad, activo = true, fuente = excluded.fuente;
  ```
  Sacar un insumo de una receta = `update … set activo = false` (el conector no deja `DELETE`).
- Probado en transacción abortada (01/10 a la noche): grupo «Mold 03 · 30*40» con lámina ×1 en Encolado y gancho ×1,
  el 183 con lámina ×2 propia y el aro 080 con 8 grampas → 134 encolado 2 cajas: `insumo LAM 30*40 −32` y **sin** la
  lámina genérica · 183 1 caja: −32 (pisa al grupo) · 134 gancho 2 cajas: `GANCHO −32` · 541 (sin receta): lámina
  genérica −8 como siempre · 080 grampeado ×10: `GRAMPA −80`. `gt.demanda_insumos` dio 5.776 láminas y 5.744 ganchos
  para los 32 del grupo con demanda.
- `sql/gt_v140_insumos.sql` (rollback en la cabecera: volver la vista con `sql/gt_movimientos_vivo.sql`).
- **gt_v141 (Thomas, 01/10: «Lámina encolada es lámina + chapadur»):** Encolado descuenta **solo**, sin cargar nada,
  `LAM <medida>` y `CHAP <medida>` del producto (un set x3: una de cada medida; `deposito = 'insumo'`). Reemplaza al
  depósito genérico `lamina` de 1.23. Si el producto tiene receta propia de insumos en ENCOL, ésa manda (probado: el
  183 con «lámina ×2» propia descuenta sólo eso). Para la DEMANDA hace falta saber de antemano qué productos llevan
  lámina: **`gt.codigos.lleva_lamina`** (null = sin definir, no cuenta; se completa con **D36**). Probado en
  transacción abortada: 134 encolado 2 cajas → `LAM 30*40 −32` y `CHAP 30*40 −32` · set 136, 1 caja → −8 de cada
  medida · demanda con 134 y 136 marcados: 1.600 chapadur 30×40, 1.664 láminas 30×40 (el 183 con receta propia ×2).
  `sql/gt_v141_lamina_chapadur.sql`.
- **gt_v142 (Thomas, 01/10: «Hacé laburar todo lo de D35 dentro del schema GT»): los insumos se resuelven SOLOS, por
  REGLAS que viven en la base.** `gt.insumo_regla` (ámbito producto / aro · etapa · patrón regex sobre la descripción ·
  plantilla con `{medida}` · cantidad · `por_pieza`). Orden, **etapa por etapa**: receta del producto > receta de su
  grupo > regla; para un aro: receta del aro > regla. Un insumo **`-`** en una receta = «en esta etapa no lleva nada»
  (anula la regla y el respaldo de Encolado; la fila `-` del catálogo está inactiva a propósito). Las 9 reglas sembradas:

  | etapa | a quién (descripción) | insumo | cant | fuente |
  |---|---|---|---|---|
  | Encolado | Cuadro / Cuadros, **también los «c/Vidrio»**, salvo MDF | `LAM {medida}` + `CHAP {medida}`, por pieza | 1 | Thomas (D36: «con vidrio también») |
  | Gancho | cuadros, portas, espejos, diplomas, múltiples | `GANCHO`, por pieza | 1 | [Probable] |
  | Emblistado | ídem | `BLIS {medida}` (un set entero en uno) | 1 | [Probable] |
  | Contraído | ídem | `FILM` (cuenta unidades, no metros) | 1 | [Adivinando] |
  | Montaje | «c/Vidrio», portas, múltiples | `VIDRIO {medida}` | 1 | [Probable] |
  | Montaje | portas, múltiples, diplomas | `FONDO {medida}` | 1 | [Adivinando] |
  | Montaje | espejos | `ESPEJO {medida}` | 1 | [Probable] |
  | Grampeado | todo aro | `GRAMPA` | 8 | [Adivinando] |

  Lo marcado [Probable] / [Adivinando] es lectura de Claude, no dato de Thomas: se corrige con un `update` a la regla
  (D36 confirmó lámina + chapadur también para los cuadros c/Vidrio; el resto queda como está hasta que diga otra cosa). Probado en transacción abortada: 134 encolado 2 cajas → lámina y chapadur 30×40 −32 · gancho −32 · blíster
  30×40 −32 · film −32 · set 136 encolado → −8 de cada medida y, con gancho en 30×40, un solo −8 · diploma 192 montaje →
  vidrio y fondo 30×40 −16 · bandeja 541 encolada (sin regla) → el respaldo lámina + chapadur 25×35 · aro 080 ×10 →
  grampas −80 · receta `-` en 134/Encolado → nada. `gt.codigos.lleva_lamina` queda **sin uso** (la regla lo reemplaza).
  **Demanda de insumos al 01/10, sin conteo:** 178.657 grampas · 21.618 ganchos · 19.122 film · 6.990 láminas y 6.990
  chapadur 30×40 · 5.794 blíster 30×40 (`select * from gt.demanda_insumos`). ⚠ `gt.demanda_producto` incluye **13
  productos que GT no fabrica** (3 cajas, 6 cestos, 2 estantes, jabonera, set 900: 22 cajas) porque tienen consumo en
  TN. **D37 (Thomas, 01/10: «sí») → `gt.codigos.fabrica`** (gt_v144; ⚠ las cajas 661 a 663 volvieron a «se fabrica» con D65): false = reventa / importado, no entra a
  `gt.demanda_producto` ni a lo que cuelga de ella. En false: los 14 que nombró Thomas (cajas 661 a 663, cestos 619 a
  626, estantes 898 y 899, jabonera 920, set 900) y [Probable] 24 hermanos de reventa sin demanda ese día (jarrones,
  libros, frascos, individuales, macetas, canasto 901, set 902). Todo lo que lleva «Mold», los sets de bandejas (518,
  519, 660), Cartel Flecha 527, Org.Canasta 615, Percheros 632 y Secaplatos 557 siguen como fabricados. Medido: la
  demanda pasó de 210 a 198 productos y de 1.665 a 1.644 cajas; aros, ganchos y film no cambiaron. Marcar otro es
  `update gt.codigos set fabrica = false where codigo = '…'`. `sql/gt_v142_insumo_reglas.sql`,
  `sql/gt_v144_demanda_solo_fabricados.sql`.

# Stock y movimientos por etapa, stock de cajas, armado de cajas, vidrio cortado, sin emblistado, correcciones — reglas de GT

_Parte de `docs/REGLAS-GT-APP.md` (índice). Partido por tema el 21/11/2026; texto sin cambios, secciones en el orden del original._

### gt_v190 — 222, 220, 661 y 662 no se emblistan: su Contraído ya no resta de Emblistado (Angely, 02/11/2026: D12 / D23 / D26)

- Angely: *«222, 661, 662 y 220 no se emblistan; el resto sí, y el resto debe haber sido olvido»*. Hasta hoy **todo** Contraído restaba de Emblistado (`gt.movimientos`), así que esos 4 dejaban el stock en negativo (661 −18 y 662 −7 el 08/10; 220 y 222 −4 el 26/10, todos de Javier; el conteo del 29/10 los puso en 0).
- **Cambio:** columna `gt.codigos.sin_emblistado` (falso por defecto; verdadero en 220, 222, 661 y 662) y la rama de `gt.movimientos` «Contraído resta Emblistado» con `AND NOT rp.sin_embl`. El Contraído de esos códigos **sigue** sumando Contraído, descontando FILM y caja armada. Un código nuevo que tampoco se emblista se marca con un UPDATE, sin tocar la vista.
- Medido: 2.692 → 2.688 movimientos; stock de Emblistado de los 4 = 0; `security_invoker` conservado; solo `gt.stock` lee `gt.movimientos`. `sql/gt_v190_sin_emblistado.sql`.
- **El 535 queda fuera**: tiene 2 Emblistados anotados, a veces sí pasa por ahí.
- **Contraído sin Emblistado de los que SÍ se emblistan (D12):** 878 (05/10 Walter 3 cajas; 07/10 Javier 15; 08/10 Javier 13; 02/11 Javier 15 y Walter 15 contra 15 de Emblistado del 30/10 de Federico → hoy −90 u), 244 (09/10 Federico 10 cajas), 245 (08/10 Federico 8), 276 (07/10 Javier 3), 405 (09/10 Federico 3), 249 (07/10 Javier 1), 557 (07/10 Javier 1). Solo el 878 tiene efecto hoy (los demás son anteriores al conteo). La base dice quién anotó el Contraído, **no** quién debía anotar el Emblistado.
- **D11 (Angely: «se encajan y luego van a Contraído»):** los 6 códigos de Deco «Armado Cajón 2 Tablas» son 3064 → 563, 3065 → 564, 3066 → 565, 3070 → 583, 3071 → 584, 3072 → 585. Hoy Deco no mueve stock de cajas y el Contraído de esos 6 descuenta caja armada (251 cajas contraídas: 154 de `38*38` antes del conteo y 20 después, 77 de la `5`). Pendiente D24: cuántas cajas de cartón se gastan por cajón armado en Deco.

### Contraído 426 del 05/10 cargado dos veces — corregido a mano (Angely, 02/11/2026: D7 / D21)

- Walter y Javier abrieron el 426 con 1,5 s de diferencia **sin tocar «Tocá para sumarte»** y cerraron con 0,3 s de diferencia, cada uno con 25 cajas: el programa lo leyó como dos trabajos (50 cajas = 800 u). Emblistado había hecho 25 cajas (400 u) ese día, así que el trabajo fue de 25 [Probable]. Casos parecidos: 05/10 (137) y 08/10 (Encolado 136, 456, 547); desde el 09/10 no hay ninguno.
- **Cómo cuenta el programa una caja:** `gt.movimientos` multiplica las cajas cargadas por `gt.codigos.uxb` al consultar (el 426: 16 u por caja; los 283 activos que se fabrican van de 1 a 28, el más común 16 con 99 artículos). Cada cierre de 25 cajas del 426 = Contraído +400, Emblistado −400, FILM −400 y 25 cajas armadas de la `40*15`.
- **Corrección** (`sql/gt_dato_426_pareja_20261102.sql`, ya aplicada): fila 150 en `gt.parejas` (Walter empezó, Javier se sumó) + `_une` / `_invitado` / `pareja` en las 2 filas de Javier, cantidad vacía en su cierre, «con Javier Burgos» en las 2 de Walter. Verificado: Contraído 426 **+560 → +160** u, FILM **−21.600 → −21.200**; Emblistado 426 y la caja `40*15` no cambian (conteo del 29/10). No se borró ninguna fila ni se tocó ningún trigger, función o vista.
- El ✏️ de Producción no sirve para esto: sólo permite poner un número, no dejar la cantidad vacía, y el Rendimiento solo reconoce la pareja si existe la fila en `gt.parejas`.

### Corte de cajas del 29/10/2026 11:55 (Angely)

- Planilla manuscrita: **cajas armadas = 0** y **14 artículos emblistados = 206 cajas** (299=15 · 458=15 · 394=16 · 396=12 · 395=18 · 181=13 · 872=16 · 163=30 · 782=13 · 781=5 · 134=15 · 189=8 · 135=10 · 584=20). El 163 coincide con
  el Emblistado de 30 que se había cerrado a las 11:19. La columna «A emblistar» (233, 189, 406, 416, 414, 878) **no** se carga: entra sola cuando se registre Emblistado.
- Cargado en `gt.stock_inicial` (`sql/gt_corte_cajas_20261029.sql`): 22 filas de `caja_armada` (todas en 0) y 230 de `emblistado` (en 0 las que no figuran, para que el historial anterior no cuente). Desde ahí
  `gt.demanda_cajas` da: **40\*15 → armar 81** (6 artículos) · **40\*50 → 56** (3) · **30 → 31** (2) · **38\*38 → 20** (1) · **15 → 18** (2).
- ⚠ Se leyeron **781 y 782 sin la E** (Porta Mold 03, caja 15), no 781E / 782E (Caja Exhibidora). Si una anotación de Contraído llega antes que el Armado de cajas, las armadas quedan en negativo hasta que se anote el armado.

### 1.68 / gt_v185 — las dos pantallas de cajas: «armar N» en cada botón y la pestaña 🗃️ Cajas del admin (Angely, 29/10/2026: D4 «sí»)

- **Celular** (`app.js`, `etiquetarCajas`): en «¿Qué caja vas a armar?» cada botón suma una línea chica: **«armar N»** (naranja) · **«NO ARMAR MÁS»** (rojo) · **«sin emblistado»** (apagado). La lee de
  `gt_cajas_estado()` al abrir la pantalla (también desde «¿Con qué seguís?» al terminar Contraído). **Sólo avisa: la caja se arma igual** (Angely: *«no les limita armar ese número»*, así pueden
  dejar cajas armadas de reserva). Sin red, sin corte de conteo o con la lista vacía, los 22 botones salen como siempre.
- **Admin** (`admin.html`, pestaña **🗃️ Cajas**): una fila por caja con artículos, emblistado (cajas), armadas y estado, **las que hay que armar primero** (mayor a menor) y después las que alcanzan. Las cajas
  sin emblistado ni armadas van juntas en una línea al pie (sin filas vacías). Avisa los artículos emblistados sin caja cargada. **Se actualiza sola cada 10 s** mientras la pestaña está abierta. Sin corte
  de conteo dice «Falta el corte de conteo» y no muestra números. Las planas (pallet) no se muestran.
- **Base** (`sql/gt_v185_cajas_pantallas.sql`): `gt.demanda_cajas` suma al final `tono` (armar · nomas · nada), `etiqueta` y `corte_en`; `public.gt_cajas_estado()` (pública, sólo caja / tono / etiqueta) y
  `public.gt_admin_cajas(p_pass)` (clave del monitor). Probado en transacción abortada con corte simulado.
- `tests/cajas.cjs` (27 controles: 320 y 390 px, «NO ARMAR MÁS» igual abre el armado, sin corte, base caída, admin en vivo). Versión 1.68.

### gt_v184 — cuántas cajas armar, en función de lo EMBLISTADO, con un corte de conteo (Angely, 29/10/2026)

- Pedido: *«A las 12 te paso cuántas cajas armadas hay y cuántos artículos emblistados hay en ese momento, para hacer un corte. Desde ahí te dice cuántas
  cajas tienen que armar en función de lo que se emblista, y descuenta cuando las contraen.»* («enlistados» es [Probable] «emblistados».) Y: *«el stock de cajas está en
  dos estadios: la caja plana en pallet y la caja armada, que dura muy poco hasta que se contrae. Por ahora no me importa el stock en pallet, sino el de cajas armadas.»*
- **Cambia el cálculo de gt_v182.** `gt.demanda_cajas.hacen_falta` ya no es la demanda: es **lo emblistado que todavía no se contrajo**, en cajas (stock `emblistado` / UxB), sumado por la caja
  del artículo. `a_armar = hacen_falta − armadas` (mínimo 0). Emblistar sube el `hacen_falta`. **Contraer baja a la vez el emblistado y las armadas**: el `a_armar` no se mueve. Armar
  suma a las armadas. Con las armadas alcanzando, `estado = NO ARMAR MÁS: alcanzan (sobran N)` (sólo avisa, no bloquea: Angely, 29/10).
- **El corte.** Hasta que haya un conteo de `emblistado` en `gt.stock_inicial` el estado dice `falta el corte de emblistado` (el saldo desde el 02/10 es sólo movimiento: −861 cajas netas
  en 72 artículos). El corte se carga con `contado_en` = la hora del conteo y **una fila por cada caja (22, en 0 si no hay) en `caja_armada` y una por cada artículo con movimientos de
  emblistado o con caja (en 0 si no hay) en `emblistado`**, `medida = ''`. Sin la fila en cero el historial anterior seguiría contando. Lo posterior a `contado_en` suma solo.
- Las planas (pallet) se siguen descontando al armar, pero no se muestran: las columnas `planas` / `a_comprar` quedan en la vista por compatibilidad.
- Probado en transacción abortada (40\*15: 10 cajas del 134 y 5 del 183 emblistadas, 20 armadas → NO ARMAR MÁS, sobran 5 · contraen 2 del 134 y emblistan 6 del 183 → hacen falta 19, armadas 18, **armar 1** ·
  arman 3 → NO ARMAR MÁS, sobran 2 · sin corte → `falta el corte de emblistado`). `sql/gt_v184_cajas_por_emblistado.sql` (rollback: el `create or replace view` de gt_v182).

### gt_v183 — la caja de los artículos que faltaban (Angely, 28/10/2026)

- Angely devolvió la planilla «Cajas pendientes por artículo» con la columna **Caja** completa para los **39 artículos con demanda** que no estaban en la
  planilla de gt_v181. Su caja manda sobre la deducción de Claude: difieren **608 y 745** (16, no 15), **311** (40\*15, no 40\*50) y **335 y 343** (15, no IMP).
  Los 781E / 782E (Caja Exhibidora) van a **Exhi 2 Porta / Exhi 3 Porta**: esas dos cajas del tablero ya tienen artículos.
- Se suman **426** (40\*15) y **456** (10) de la hoja «Ya contraídos»: propuestas de Claude (39 y 3 artículos de la misma moldura, medida y UxB con esa caja) que
  la hoja devolvió sin tocar. Sólo completa lo vacío (`caja is null`): no pisa gt_v181. Total con caja: **228** (187 de gt_v181 + 41 de acá).
- Quedan sin caja el **557** y el **220** (cierres de Contraído, hoja devuelta en blanco) y **92 activos** (32 de reventa y **60 que se fabrican pero hoy no tienen demanda**).
  `gt.demanda_cajas` ya no tiene fila `(sin caja)`: hoy todo lo que hay que fabricar tiene caja. Hacen falta: 40\*15 → 534 · 40\*50 → 178 · 15 → 142 · 30 → 136 ·
  38\*38 → 25 · 5 → 22 · 16 → 21 · 12 → 20 · 14 → 18 · 10 → 15 · 20\*50 → 14 · IMP → 13 · 13 → 3 · Caja Notebook → 2 · Exhi 2 Porta → 1 · Exhi 3 Porta → 1.
- ⚠ El **426** de Walter y Javier (05/10 14:24, 25 cajas cada uno, abiertos con 1,5 s de diferencia) puede ser un solo trabajo anotado dos veces: con su caja cargada
  descuenta 50 cajas armadas en lugar de 25. Pendiente de confirmar. `sql/gt_v183_caja_pendientes.sql` (rollback: `update gt.codigos set caja = null where codigo in (…)`).

### gt_v182 — el stock de CAJAS: armar suma, contraer resta, y `gt.demanda_cajas` para el monitor (26/10/2026)

- Pedido (cuando se anota *Armado de cajas* en Contraído): *«arman las cajas para todo lo que van a [contraer]. Pueden armar la 4015 y capaz
  arman 50: no son de un solo artículo, se usan a lo largo del día o de más de un día para todos los artículos. Tiene que aparecerles botones
  con los números de caja, que anoten la cantidad, y que eso aumente el stock de cajas armadas y descuente del stock de cajas como insumo. Y
  cuando contrajeron el 134, si armaron 10 cajas, descuente 10 cajas de la caja 4015»* (la «4015» es la caja **40\*15**). Los botones ya estaban (1.67).
- **La caja armada es de la CAJA, no del artículo.** Se cuenta por número de caja: armar 50 de la 40\*15 no dice para qué artículo.
- **Armado de cajas** (cierre con cantidad, código = la caja): **+** depósito `caja_armada` de esa caja y **−** el insumo `CAJA <caja>` (la caja plana
  que se compra; 22 filas nuevas en `gt.insumos`). El descuento de la plana usa lo que ya había: `gt.codigos_rubro.insumo` / `insumo_cant = -1`
  (igual que el vidrio de Deco), sin tocar la vista.
- **Contraído** (cierre con cantidad, en cajas): **−** `caja_armada` de la caja que usa ese artículo (`gt.codigos.caja`, gt_v181): 10 cajas del 134 = 10 de
  la 40\*15. Un artículo sin caja cargada no descuenta nada. Si la cantidad del código va en unidades se divide por la UxB.
  **[Probable]** la lectura de «comprar» del pedido es *contraer* (es donde se cuentan cajas, y la caja se arma dentro de Contraído).
- `gt.movimientos` y `gt.stock` (unidad «cajas») se cambiaron sobre la definición viva, con control de que el ancla apareciera 1 sola vez
  y `security_invoker` conservado. Probado en transacción abortada: armado 50 de la 40\*15 + Contraído 10 del 134 + 2 del set 136 + 3 del 456 (sin caja) →
  `caja_armada` 40\*15 **+38**, insumo `CAJA 40\*15` **−50**, 3 filas nuevas (el 456 no suma). Rollback probado también: las demás 1.982 filas no cambian.
- **`gt.demanda_cajas`** (base del monitor): por caja, `hacen_falta` = Σ por artículo que GT fabrica de `a_fabricar_cajas` menos lo ya contraído (depósito
  `contraido`), `armadas`, `a_armar`, `planas`, `a_comprar` y `estado` (`armar N` · **`NO ARMAR MÁS: alcanzan (sobran N)`** · `sin demanda` · `sin conteo…`).
  Al registrar un armado el estado se corrige solo (es una vista). Fila `(sin caja)` = artículos con demanda y sin caja cargada.
  Medido el 26/10 sin conteos: 40\*15 → 551 cajas (46 artículos) · 40\*50 → 192 · 15 → 138 · 30 → 129 · `(sin caja)` → 38 artículos, 46 cajas (el 28/10: «artículos» cuenta sólo los que tienen cajas por contraer).
- ⚠ **Sin conteo físico no hay stock.** El Contraído desde el 02/10 ya descuenta (40\*15: −777 con 0 armadas contadas) y el armado empezó el 21/10 (9 cierres, 150 cajas).
  Hasta que se cuenten, las armadas y las planas valen 0 en `gt.demanda_cajas` y el estado lo dice. El conteo va en `gt.stock_inicial`: `deposito = 'caja_armada'`
  (código = la caja) y `deposito = 'insumo'` (código = `CAJA <caja>`), con `contado_en`: lo anterior deja de contar solo.
- 6 cajas del tablero no las usa ningún artículo de la planilla (2, 22, Exhi 2 Porta, Exhi 3 Porta, Exhi Cuadro, Tapa + Base) y otras 2 sólo las usan artículos
  sin demanda hoy (29 → el 920, que no se fabrica · Caja Cuadros Set → el 089): las 8 salen `sin demanda`. Se pueden armar y suman, pero nada las descuenta.
- `sql/gt_v182_cajas_stock_y_demanda.sql` · rollback `sql/gt_v182_rollback.sql`. **Falta el monitor** (pestaña del admin, en vivo) y los botones ya existen.

### gt_v181 — qué caja usa cada artículo (planilla «Cajas según Cód», 26/10/2026)

- **`gt.codigos.caja`** (texto): el número de caja del tablero «Num Caja» (`gt.codigos_rubro`, rubro `ARMCAJ`). Cargados **187 artículos** de la planilla (185 activos, 16 cajas
  distintas: 40\*15 → 48 · 30 → 36 · 15 → 25 · 40\*50 → 17 · 38\*38 → 17 · 12 → 9 · 5 y 16 → 7 c/u · 14 → 5 · 10 → 4 · 13, 20\*50 e IMP → 3 c/u · 29, Caja Cuadros Set y Caja Notebook → 1 c/u).
  Todas las cajas de la planilla existen en el tablero. Nulo = sin dato: **133 activos** no están en la planilla.
- La UxB de la planilla **no se carga** (`gt.codigos.uxb` ya existe y mueve el stock). Difieren 2: **471** (planilla 5 / base 8) y **214** (planilla 12 / base 16).
- Contraído tiene 7 cierres (69 cajas) de códigos sin caja: 220, 222, 411, 426, 456, 557. `sql/gt_v181_caja_por_articulo.sql`
  (rollback: `update gt.codigos set caja = null`).

### gt_v172 — el vidrio cortado SUMA al stock y lo descuenta Montaje de portas (Thomas, 21/10/2026, D2)

- Pedido: *«tiene que descontarse cuando montan portas»*. El descuento ya existía (gt_v142, regla 6 de `gt.insumo_regla`:
  Montaje de porta / múltiple / «c/Vidrio» resta 1 «VIDRIO {medida}» por unidad). Faltaba que el corte sumara.
- **`gt.codigos_rubro.insumo`** (columna nueva): el insumo que produce un código propio de un rubro. Los 15 de Corte Vidrio
  (Deco 2001–2015) producen «VIDRIO <medida del tablero>»; `gt.movimientos` suma **+cantidad** al cerrar el tramo (rama nueva
  al final de `mov`, agregada sobre la definición viva). Otro código que produzca un insumo es un `update`, no código.
- **La regla 6 ya no descuenta vidrio** a las «porta» que no lo llevan: Difusor, Vela, Sahumerio, Cepillo y Pasta, Foto
  Broche, Broche Metálico (`excluye`) [Probable]. ⚠ La regla 7 (FONDO, [Adivinando]) no se tocó: al 895 Porta Difusor le sigue
  descontando un «FONDO 10\*12\*7».
- **Recetas por producto** (`gt.insumo_receta`, `fuente = 'gt_v172'`), donde la medida del producto no es la del vidrio:
  portas c/Soga 606–609 («10\*15 x2» → 2 «VIDRIO 10\*15») y múltiples 281, 283, 311, 312 (un vidrio por ventana, la medida
  del aro); c/Vidrio 30\*40 con aro 27.5\*40 (Diplomas 192 y 214, Cuadro Vintage 228) → «VIDRIO 27.5\*40» (el 2006 del
  tablero) [Probable]. Como una receta por producto reemplaza todas las reglas de la etapa, llevan también su FONDO.
  `gt.insumo_receta.insumo` tiene FK a `gt.insumos`: se dieron de alta 16 «VIDRIO …» y 5 «FONDO …».
- Probado en transacción abortada: 2003 × 10 → +10 VIDRIO 15\*21 · 782 × 1 caja → −16 · 606 × 1 caja (UxB 12) → −24
  VIDRIO 10\*15 · 895 sin vidrio · 192 → −16 VIDRIO 27.5\*40 · 2006 × 7 → +7.
- Lo que quedaba sin par (224, 227 y los cortes 29\*40, 15\*37, 8.5\*23, 17.5\*23, 23\*26.5) lo resolvió Thomas el mismo día: gt_v173.
- `sql/gt_v172_stock_vidrio.sql` (con su rollback). Cero cambios en la app.

### 1.67 — Armado de cajas pregunta QUÉ caja, con el tablero «Num Caja» (Thomas, 19/10/2026)

- Pedido: *«Ahí debería preguntar qué número de caja va a armar»*, con la foto del tablero: **22 cajas**.
- ⚠ **Desde gt_v182 (26/10) las cajas SÍ mueven stock** (armar suma `caja_armada`, Contraído resta): el «no mueve stock» de abajo vale para el stock de productos.
- **Las 22 van a `gt.codigos_rubro` (rubro `ARMCAJ`), no a `gt.codigo_area`**: ésa es para los 331 productos, y el «2» de
  una caja no es el producto 2. `gt_codigos_area2` ya une las dos tablas, así que la app las ve sin tocar ninguna función.
  `gt.rubros.pide_codigo = true` para `ARMCAJ`. **Cero cambios en funciones o vistas.**
- **No mueve stock, y está verificado en la definición viva de `gt.movimientos`:** esa vista cruza `codigos_rubro` sólo con
  `CORTE` y `GRAMP` (`cr.rubro = r.area`), y los productos sólo con las 6 áreas de producto. `ARMCAJ` no entra por ninguna
  rama. 11 de los 22 códigos existen también en Corte o Grampeado («2», «5», «10»…): no se cruzan porque el join pide
  además el rubro.
- **Se eligen por BOTONES, no se tipean:** 7 de los 22 son texto («Caja Notebook», «Tapa + Base», «IMP») y 4 son medidas
  («20\*50»), y el campo de código es de teclado numérico. `esOpciones` pasa a aceptar también una lista **corta**
  (`BOTONES_MAX = 30`) donde **algún** código no se puede tipear. Las áreas de producto (331), Corte (195), Grampeado (130)
  y Deco (87) se siguen tipeando: no entran en una grilla. Con más de 6 opciones la grilla va compacta (`.muchas`) y la
  pregunta ya no las nombra una por una: dice **«¿Qué caja vas a armar?»** (`PREGUNTA` por área, porque «Armado de cajas»
  no sale de la regla «¿Qué vas a <nombre sin -ado>?»).
- **El orden es el del tablero, no el de la base:** `gt_codigos_area2` ordena por texto («10» antes que «2»), así que la app
  reordena: números por valor (2 … 30), después las medidas (20\*50 … 40\*50), después los nombres. Medido en 390 px:
  2 columnas, botón de 52 px, ningún texto cortado; la lista entra con un poco de scroll (915 px de alto).
- **Sigue pidiendo cuántas armó** (D15, 1.64): primero la caja, al terminar la cantidad. El cartel dice «¿Cuántas cajas
  armadas de Caja Notebook?» («del 183» sólo cuando el código empieza con número).
- `sql/gt_v167_armado_de_cajas_numero.sql` (con su rollback) · `tests/puesta.cjs` (las 22 en orden, sin campo de tipeo, la
  caja viaja en la apertura y en el cierre).

### 1.64 — «📦 Armado de cajas» dentro de Contraído (Elías, 16/10/2026)

- Pedido: *«En contraído faltaría agregar armado de cajas»*. Mismo molde que la Puesta a punto (1.50): rubro **`ARMCAJ`**,
  `DENTRO_DE = { ARMCAJ: "CONTR" }`. No va en la botonera: es un botón en la pantalla del código de Contraído y «Terminar e ir a
  Armado de cajas» al cerrar Contraído. Sin código, productiva. **D15 (Elías: «sí»): pide cuántas «cajas armadas»** (no es
  cambio de app: `pide_cantidad = true` en la base); sale en Producción y no mueve stock. `sql/gt_v164_armado_de_cajas.sql`, `tests/puesta.cjs`.

### 1.23 — movimientos de stock por etapa, sólo internos (Thomas, 01/10/2026)

- *«Por ahora no hace stock, hace solamente movimientos… que internamente funcionen los movimientos, pero que no
  se los muestren a los operarios.»* → **`gt.movimientos`** (vista): cada «Terminé» con cantidad suma en su etapa
  y descuenta de la anterior. No hay saldo inicial: **no es stock** hasta que Thomas cargue el inicial.
- La cadena: Corte → (Grampeado: −2 piezas de cada lado del aro, + aro) → Encolado (− lámina − chapadur de la medida, gt_v141; + encolado) →
  Montaje (− aro, − encolado, + montado) → Gancho → Emblistado → Contraído → Guardado a góndola. Unidades:
  piezas, aros y, en las áreas de producto, cajas × UxB. **Sets x3 por medida**; emblistar un set descuenta
  una de cada medida.
- **Pedidos y Carga camión (D2): la lógica está y está APAGADA** (`gt.config` `stock_pedidos_activo` = '1' la
  prende; sin fila = apagada). Pedidos todavía no registra código ni cajas, y el área Carga camión (`CARGA`) no existe.
- Recetas: `gt.aro_piezas` (corte → aro, automática por perfil + largo; al 01/10 a la noche **ningún aro sin
  resolver**: D6, D23 y D27 cerraron los 17 que faltaban) y `gt.producto_aro` (producto → aro; **9 automáticos**, el
  resto espera el color de la planilla D4). A mano mandan `gt.receta_corte` y `gt.receta_aro` (`aro = '-'` = no
  lleva aro). Lo que falta sale con `receta = 'sin receta'` y en `nota` las opciones.
- Es una **vista**, no una tabla: no se desincroniza, un cierre reemplazado (`AREAX`) deja de contar solo y al
  cargar una receta se recalcula toda la historia. Deco y Esnaola no mueven stock.
- `sql/gt_v123_movimientos.sql` (consultas útiles al final). Probado con una cadena de prueba en transacción
  abortada.

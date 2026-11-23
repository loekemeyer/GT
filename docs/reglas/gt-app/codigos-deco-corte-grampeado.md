# Tableros de Deco, Corte y Grampeado — reglas de GT

_Parte de `docs/REGLAS-GT-APP.md` (índice). Partido por tema el 21/11/2026; texto sin cambios, secciones en el orden del original._

### 1.60 — más códigos de Deco por artículo, «¿Con quién?» en la Puesta a punto y Guardado → Góndola o Pedidos (Thomas, 08/10/2026)

- **Deco (gt_v169), con `articulos` como el 3080:** **3004** Patas c/Trav, **3001** Armado Bastidor y **3061** Bastidor + Patas
  c/Tornillo → 540 / 542 / 547 · **3008** «Manija 03 + Corte 012 13 cm» → 456 / 536 / 818 / 534 · **3007** «Manija 03 + Corte 012
  20 cm» y **3079** «Armado Bandeja» 20x20 → 535 / 549 / 452. ⚠ **3002 / 3003** (bastidor 540 / 547) y **3060 / 3063** (bastidor +
  patas 540 / 547) siguen activos y hacen lo mismo que el 3001 y el 3061: D103.
- **Puesta a punto encoladora pregunta «¿Con quién lo hacés?»** al empezar: «Solo» y los empleados activos por legajo, sin el que
  pregunta (`gt.rubro_pasos` con `fuente = 'companeros'`, que resuelve `gt_pasos`; «Solo» lo pone la base, así sirve con la app vieja).
  Va en `detalle.con` y la botonera dice «con Walter Saucedo». **No** le abre nada al compañero ni lo suma como pareja: es un dato.
- **Guardado a góndola pregunta al terminar «¿A dónde fue?» Góndola / Pedidos** (`gt.rubro_pasos`, momento `terminar`,
  `detalle.destino`). En `gt.movimientos` lo que va a Pedidos suma en **`armado`** (lo armado para pedidos) en vez de `gondola`;
  contraído se descuenta igual. Probado en transacción abortada (183 × 2 cajas a Pedidos: armado +32 · contraído −32; × 1 a Góndola:
  gondola +16). Sin la pregunta (cierre automático, celular viejo sin la fila) va a góndola, como antes. No dice a QUÉ pedido
  (D104, Thomas: «por ahora no»).
- ⚠ Las dos preguntas viven en la base: salieron en los celulares apenas se aplicó gt_v169 (también con la 1.58).
- `sql/gt_v169_deco_articulos_puesta_con_quien_guardado_destino.sql` · `tests/puesta.cjs` (con quién, sin uno mismo, Solo) ·
  `tests/codigos.cjs` (Guardado a Pedidos).

### 1.59 — Deco: el 3080 sirve para 4 bandejas y pregunta cuál se fabrica (Thomas, 08/10/2026)

- Pedido: *«456, 536, 818, 534 usan el 3080. Cuando ponen 3080, debe preguntar qué código va a fabricar»* (escribió «380»: se
  tomó como 3080). Venía de la Oficina Pellegrini: *«necesitamos los códigos de armado de art bandeja 456, armado de manija más bastidor»*.
- **`gt.codigos_rubro.articulos`** (text[], gt_v168): con 2 o más, el celular pregunta **«¿Qué artículo vas a fabricar?»** con un botón
  por artículo (número + descripción del producto) en la pantalla de la medida del set (1.17). Va en **`detalle.articulo`** de la
  apertura y el cierre lo hereda («¿Cuántas unidades fabricadas del 3080 · 534?»). Al seguir con el mismo código lo vuelve a preguntar.
  Hoy sólo el **3080** «Armado Bandeja — 456/536/818/534 Bandeja 13x30» (antes «— 536»). Otro código igual:
  `update gt.codigos_rubro set articulos = array['…','…'] where rubro = 'DECO' and codigo = '…'`.
- `gt_codigos_area2` (misma firma) suma `articulos`. Un celular que cae a `gt_codigos_area` no pregunta. (Más códigos así: 1.60.)
- `sql/gt_v168_deco_articulos.sql` · `tests/codigos.cjs` (empezar, terminar, seguir con el 3080, un código sin artículos no pregunta).

### D64 y D65 — Deco: operaciones de artículos discontinuados y Cajas de Té (Thomas, 02/10/2026)

- **D64 («todos discontinuos»):** 13 operaciones de Deco nombraban artículos que no están en `gt.codigos` (302, 563J, 564J,
  570, 581, 582, 589 a 594 y 897). Salieron de la lista del celular con `gt.codigos_rubro.activo = false`: Deco pasa de
  **71 a 58** códigos. Tipeado igual, entra como código fuera de la lista.
- **D65 («sí se fabrican»):** las **Cajas de Té 661, 662 y 663** se arman en Deco (panal + bastidor + tapa, divisores):
  `gt.codigos.fabrica = true`. Deja sin efecto, para ellas, lo de D37 (reventa). Entran a la demanda por consumo:
  3 + 4 + 4 = 11 cajas sin conteo (total 1.641 → 1.652). No llevan aro. `sql/gt_d64_d65_deco.sql`.

### gt_v196 — los 15 bastidores y aros, en Deco y en Grampeado (Thomas, 23/11/2026)

- *«Que estén en deco y en grampeado»*: 3010–3013, 3018, 3028–3036 y 3043 vuelven a estar activos en DECO sin salir de GRAMP
  (deja sin efecto el apagado en Deco de gt_v195 y gt_v188). Deco 106 → 121 activos · Grampeado 143.
- Sin doble conteo: `gt.movimientos` cruza por el rubro del registro y Deco no mueve stock por código.
  `sql/gt_v196_bastidores_aros_deco_y_grampeado.sql`.

### gt_v195 — Grampeado: el tablero de bastidores y aros entero viene de Deco (Lautaro Durante, 19/11/2026)

- Pedido (WhatsApp con la foto del tablero «Cod · Descripción · Código Bastidor · Código Aro»): *«El código 3011 no está en
  grampeado»*. Los 15 del tablero se habían cargado en Deco el 07/10; el 3043 ya había pasado en gt_v188.
- Medido el 23/11: en Deco, 0 registros de los 14. En Grampeado se tipeaban fuera de la lista 3011 (Luis Luna, Lautaro Durante:
  32 u), 3018 (20), 3031 (72), 3032 (112) y 3034 (137). → **3010–3013, 3018, 3028–3036 activos en GRAMP y apagados en DECO**.
  Grampeado 129 → 143 activos · Deco → 106.
- Stock sin cambios: `gt.movimientos` ya sumaba esos cierres al depósito «aro» y descontaba GRAMPA (−2.984); sólo se va la nota
  «código fuera de la lista». Sin piezas en `gt.aro_piezas`: el cierre deja «no se encontró la pieza de corte», como el 3043.
- D96 sigue igual: los 3084/3086/3088 «Panal + Bastidor + Tapa» quedan en Deco. `sql/gt_v195_bastidores_aros_a_grampeado.sql`.

### gt_v180 — Grampeado: 22 aros 3P con la medida de la fila de arriba (22/10/2026)

- Foto del operario: el **118** salía «3P 1/2 Bco P · 30\*120». En la planilla «Códigos para planilla diaria de grampeado» el
  118 es **40\*50** y no existe 3P 1/2 de 30\*120.
- La transcripción del 01/10 (`gt_codigos_corte_grampeado.sql`) se salteó las filas **30\*30** y **60\*80** y corrió una fila
  hacia arriba todo el bloque 3P desde 29\*40: 1/2 Bco P **118** · 3/4 Bco P **103 116 100 093 106 096 099 112 102 111 105** ·
  3/4 Negro **104 101 094 108 097 098 110 095 109 107**. El 124 y el 115 (27,5\*40) estaban bien.
- **Sin historia que rehacer**: 0 registros de Grampeado con esos 22 códigos (80 en total al 22/10 10:08). Piezas por aro,
  aro por producto, movimientos y demanda son vistas: se corrigieron solas (220 → 105 / 107, 221 → 111 / 109,
  222 → 112 / 110, 223 → 106 / 108, 229 → 106, 237 → 102 / 095).
- Arrastres de decisiones tomadas sobre la medida mal leída:
  - **236 / 237** (D22, «no hay aro 60\*80») son el 105 / 107 del tablero: apagados.
  - Receta de corte D27 «Bco P 29\*40 = 168 + 116» pasó del aro 116 al **103**. La D23 del 103 («27,5\*40») se borró: no hay
    3/4 Bco P de 27,5\*40. El **116** (30\*30) se resuelve solo: 114 ×4.
  - Corte **167** «3P 1/2 Bco 120 cm» (D27, sólo para el 118) apagado. Corte **166** «3P 3/4 Negro» pasó de 27,5 a **29 cm**
    (sólo servía al lado corto del 104, que ahora es 29\*40).
- ⚠ **228** Vintage c/Vidrio (D21, «Bco P») sigue en el aro 103, que ahora es 29\*40: falta confirmar con Thomas.
- `select * from gt.aro_piezas where pieza is null` sigue vacía. `sql/gt_v180_grampeado_3p_medidas_tablero.sql`.

### gt_v179 — la pregunta de color de la bandeja suma «Natural» (Thomas, 21/10/2026)

- *«Un solo código para la moldura de una misma medida… que pregunte qué color están cortando, si rosa, natural o celeste.»*
  206 / 207 / 212 preguntan al terminar **Rosa / Natural / Celeste** (`gt.rubro_pasos` CORTE 2–4).
- Ningún tablero tenía un código Rosa: «Rosa» era sólo la etiqueta que la base les puso el 07/10 a 206 / 207 / 212. Lo que se
  apagó (215) y lo que se le sacó al 213 / 214 eran los Celeste que numeró Claude ese día (D95), tampoco impresos.
- ⚠ El «012 Natural 13 cm» que sí existe (código **69**) es de Corte 45° (marcos), no la pieza de 90° de la bandeja. En Corte
  45° la regla sigue siendo un código por color (69 / 74 / 84 / 94 para 012 13 cm; 153 / 155 Trav 20mm Rosa / Celeste 27 cm): D15.
  `sql/gt_v179_corte_bandeja_color_natural.sql`.

### gt_v178 — Deco controlado contra el tablero de las bandejas (Thomas, 21/10/2026: «Controla»)

- Tablero de bandejas (536 / 535 / 538, 540 / 542 / 543 / 545 / 547, 537 / 541 / 546 / 548, Porta Broche 160 / 162 / 163): **31
  códigos coinciden** con la base. Las diferencias, todas de la Bandeja Cama Chica:
  - El tablero tiene escrito a mano **3001** y **3061** en la 540 (tapando el 3002 y el 3060) y da **3003 / 3063** para la 547.
    → 3001 y 3061 preguntan sólo 540 / 542; **3002 y 3060 apagados** (resuelve **D103**). Lo ya cargado no se toca: 3001·547
    (30, 09/10) y 3061·547 (60, hasta 16/10).
  - 3007 / 3008 pasan al nombre del tablero, «Armado Corte Chico c/Manija».
- `sql/gt_v178_deco_bandejas_control_tablero.sql`.

### gt_v177 — Deco: cartel «Codigos Perforado-Lijado-Calado» (Thomas, 21/10/2026)

- 16 códigos nuevos de Deco, «Operación — artículo»: Calado 045 Trav Chico / Gde de las Cajas de Té 662 y 663 (6001–6004);
  Bandeja Notebook 545: Calado Bast. 045 (**6005**), Calado Reg Altura Trav 20mm (6006), Perforado Patas (7008), Perforado
  Soporte 10mm (**7010**), Perforado 100 Grande (7011), Lijado Soporte 10mm (8002), Lijado 100 Chico / Grande (8003 / 8004);
  Perforado Patas de las Bandejas de Cama 542 y 543 (7006 / 7007); Perforado 012 p/Pitones del 310 Cuelga Llaves (7009);
  Lijado Manija 03 de las bandejas 535 / 536 / 538 (8001). El 7001 pasa a «Perforado Tapa 03 — Cajas de Té».
- **Resuelve D10:** el 6005 y el 7010 que tipeaba Juan Gimenez son de la Bandeja Notebook. También se tipeaban fuera de la lista
  el 7008 (Juan), el 7006 (Luis Luna, Ximena Ortiz) y el 8001 (Lautaro Durante): ahora se reconocen. No mueven stock.
- ⚠ Quedan como no identificados: el **6005 en Corte** del 16/10 (Juan, 100, era el Calado de Deco) y el **215** del 07/10 (Luis,
  200 manijas Celeste, apagado en gt_v176) (D13). `sql/gt_v177_deco_perforado_lijado_calado.sql`.

### gt_v176 — Corte de la bandeja 13x30: sin códigos por color, pregunta «¿De qué color?» (Thomas, 21/10/2026, D9)

- *«Los códigos de rosa o celeste que no existan, y cuando cortan 012 13 cm que pregunte qué color.»* La moldura 012 de la
  bandeja se corta **ya pintada**, Rosa o Celeste.
- **206 / 207 / 212** quedan como el tablero «Corte 90°»: «012 Corte Chico · Bandeja 13x30 (536)» 13 cm, «012 Corte Grande ·
  Bandeja 13x30 (536) y 30x30 (538)» 27.5 cm, «Manija Madera · Bandeja 536, 535 y 538». Rendimiento los sigue agrupando
  igual («Mold 012 · 13 cm»).
- Al **terminar** cualquiera de los tres: **«¿De qué color?» Rosa / Celeste** → `detalle.color` (`gt.rubro_pasos` CORTE 2, 3 y
  4, `si_campo = 'codigo'`, el mecanismo de la 1.65). 207 y 212 también [Probable]: son el corte grande y la manija de la misma
  bandeja. Cero cambios en la app.
- **213 / 214** quedan sólo como Cajón Porta Cubiertos (045 Chico / Grande): **ya no preguntan «¿Qué cortaste?»** (esas dos filas
  de `rubro_pasos` pasaron a ser la pregunta del color: el conector no deja `DELETE`). **215** «Manija 03 Celeste» apagado.
- ⚠ El stock del depósito «corte» va por código: Rosa y Celeste del 206 suman juntas. Los cortes de Luis del 07/10 quedan como se
  cargaron (206 / 207 / 212 × 400 / 400 / 200 y 215 × 200, sin color). `sql/gt_v176_corte_bandeja_pregunta_color.sql`.

### gt_v174 — Corte: tablero «Corte 90° Grados», 200 a 273 (Thomas, 21/10/2026)

- Pedido: *«258 en corte no lo tenés»* + la foto del tablero (*«el 258 es moldura de 100 con ranura para cajón 25x34»*).
  38 códigos con el formato del tablero de Corte 45° Bandeja: `descripcion` = moldura, `medida` = producto. Bandejas: 204/205
  (535 20x20), 225 (538 30x30), 208–211 (Cama Chica 540/542: Corte Chico, Grande, Pata, Travesaño), 200–203 (Cama Grande 543).
  Cajón 2 Tablas Blanco 15\*21 / 20\*27.5 / 25\*34 (563 / 564 / 565): 241–249 (045 s/Ran, 045 c/Ran, 100 c/Ran) y 265–273
  (las tres «c/B»). Natural (583 / 584 / 585): 250–258. En los cajones sólo los artículos activos (563J, 564J, 570, 581, 582 y 589
  a 594 son discontinuos, D64).
- **206 / 207 / 212 no se pisaron**: el tablero los da como «012 Corte Chico / Grande» y «Manija Madera» de las bandejas 536 / 535
  / 538, y la base los tenía desde el 07/10 como «012 Rosa 13 / 27.5 cm» y «Manija 03 Rosa» (D9).
- Ya se tipeaban fuera de la lista y pasan a reconocerse: 204 (Javier Burgos), 208, 210, 211 (Luis Luna, Lautaro Durante, Ximena
  Ortiz) y 258 (Luis Luna). Quedan fuera de la lista en Corte el 1000 (prueba, D33) y el **6005** (Juan Gimenez, 2 veces).
  `sql/gt_v174_corte_90_grados.sql`.

### gt_v171 — Deco: «Codigos Corte Vidrio» 2001 a 2015 (21/10/2026)

- Pedido: foto del tablero «Codigos Corte Vidrio» + *«Carga estos · Rubro deco»*. 15 medidas → `gt.codigos_rubro` rubro `DECO`,
  `descripcion = 'Corte Vidrio'`, `medida` como en el tablero (10\*15, 13\*18, 15\*21, 20\*25, 20\*30, 27.5\*40, 29\*40, 40\*50,
  50\*60, 60\*80, 60\*100, 15\*37, 8.5\*23, 17.5\*23, 23\*26.5). El celular muestra «Corte Vidrio · 10\*15» y al terminar pide
  «unidades fabricadas». Ningún rubro usaba 2001–2015. Deco: 74 → **89** activos.
- ⚠ **No mueve stock**: `gt.movimientos` cruza `codigos_rubro` sólo con Corte y Grampeado. El vidrio cortado **no** suma al insumo
  «Vidrio {medida}» que descuenta Montaje (gt_v142). Cero cambios en la app. `sql/gt_v171_deco_corte_vidrio.sql`.

# Códigos y áreas — reglas de GT

_Parte de `docs/REGLAS-GT-APP.md` (índice). Partido por tema el 21/11/2026; texto sin cambios, secciones en el orden del original._

### v10.0 — tipear el código y códigos nuevos (Thomas, 01/10/2026)

- **Sin lista desplegable**: en el iPhone el `datalist` tapaba el campo y no dejaba tipear. Abajo del
  campo se muestra qué es lo tipeado («03 Bco · 10 cm»). Teclado numérico si todos los códigos del
  área son números.
- **D7 hecho (01/10):** ya no existen `gt.*_v1` ni las funciones viejas (`gt_login`, `gt_areas`, `gt_botonera`,
  `gt_codigos`, `gt_clave_actual`, `gt_tareas()`, `gt_registros_hoy(text)`).
- **Un código que no está en la lista se pregunta** («¿Lo registro igual?») y, con el segundo toque,
  se registra. **D48 (Elías, 02/10): sigue así, no se rechaza.** El aviso a «GT Avisos» sale sólo si se confirma
  (sin el segundo toque no se graba nada), **uno por cada apertura** (gt_v160, Thomas 05/10: *«que me siga llegando la alerta,
  no sólo la primera vez»*; antes, uno por área + código + día) con «Ya van N veces en <área> (la primera, el dd/mm hh:mm)», y
  entre 07:00 y 21:00. `sql/gt_v160_alerta_codigo_cada_vez.sql`. Medido el 02/10: los 2
  códigos fuera de lista de esos días (1000 en Corte, 999 en Gancho) salieron y Telegram los aceptó (mensaje 248).
  El grupo tiene **3 miembros** (el creador, el bot y una persona más): quien no está en el grupo no los ve. **D50 (Elías,
  02/10: «no»):** no se lo suma al grupo. Para identificarlos después: `select * from gt.codigos_no_identificados order by ultima desc;`
  (01/10, D33: el **1000** en Corte de las 14:05 fue una prueba de Thomas, no se carga.)

### Estado de los códigos al 01/10/2026 (cargados con el «sí» de Thomas, D13 + D10)

| área | pide código | lista |
|---|---|---|
| Corte | sí | 233 activos (el 21/10 entraron 38 del tablero «Corte 90° Grados»: 200–205, 208–211, 225 de bandejas y 241–258 / 265–273 de Cajón 2 Tablas, gt_v174) · 174 propios (Corte 45°; 157 y 158 entraron con D22, 159 a 168 con D27; el 07/10 206 / 207 «012 Rosa 13 y 27,5 cm» y 212 «Manija 03 Rosa», tipeados esa mañana fuera de lista, y sus Celeste 213 / 214 / 215, números elegidos por Claude: D95. **gt_v176:** sin color, 206 / 207 / 212 preguntan «¿De qué color?» Rosa / Natural / Celeste (gt_v179), 215 apagado) |
| Grampeado | sí | 143 propios activos (3043 «Bastidor 556 Cajón Porta Cubiertos» vino de Deco el 02/11, gt_v188 · el 23/11 vinieron de Deco los otros 14 del tablero de bastidores y aros, 3010–3013, 3018, 3028–3036, gt_v195 · 234 a 240 entraron con D22 y D26; 236 / 237 apagados en gt_v180: eran el 105 / 107) |
| Encolado · Montaje · Gancho · Emblistado · Contraído | sí | 323 productos (13 discontinuos: 6 desde D22 y los 7 G y W desde el 02/10, no se listan) |
| Guardado a góndola | sí | los 323 productos + pide cajas. **Se nutre de Contraído** (v8.0): al empezar muestra como botones lo contraído y todavía no guardado (`gt_contraido_pendiente`). Acepta **cualquier** producto, pero si no salió de Contraído **avisa y pide confirmar** (v11.0, D17) |
| Deco | sí | 121 de operación activos (gt_v178: 3002 y 3060 apagados, D103 · el 21/10 entraron los 16 del cartel «Codigos Perforado-Lijado-Calado»: 6001–6006, 7006–7011, 8001–8004, gt_v177 · el 21/10 entraron los 15 del tablero «Codigos Corte Vidrio», **2001–2015** «Corte Vidrio · 10\*15…», gt_v171, el 2012 apagado, y los 24 del tablero «Codigos Sublimado», **5101–5124**, 19 activos: gt_v173) (tablero «08. Sector Deco»: 71; los 13 de artículos discontinuados salieron con D64; el 07/10 entraron el **7001** «Perforado — Cajas de Té» y 15 de la foto del tablero de bastidores y aros: 3010–3013, 3018, 3028–3036, 3043 (el **3043** pasó a Grampeado el 02/11, gt_v188, y los otros 14 el 23/11, gt_v195: Deco quedó con 106 activos). 3031/3033/3035 «Bastidor» y 3084/3086/3088 «Panal + Bastidor + Tapa» **quedan los dos** (D96 resuelto, Thomas 02/11: *«Ambos»*, son dos procesos distintos —bastidor por un lado, panal + bastidor + tapa por otro—, no hay doble conteo; controlado ese día contra la foto del tablero, los 15 están; sólo los 308x descuentan vidrio, así que no hay doble movimiento)) |
| Pedidos | no | — (y no pide cantidad) |
| Almuerzo (`ALMU`) | no | botón aparte, no tarjeta; sin cantidad |
| Recibir mercadería | **no** (1.12, D29) | — ; al terminar no pide cantidad (1.13, D30) |
| Movimientos (`MOVIM`, 1.28, D31) | no | — ; sin cantidad. En **todas** las plantas. Es una pausa: al terminar propone volver al área productiva anterior |
| Baño (`BANO`, 1.31, Elías) | no | igual que Movimientos |
| Limpieza (`LIMP`, 1.54) | no | igual que Movimientos |

Avisos de llegada: van al grupo de Telegram **«GT Avisos»** (`gt.config.telegram_chat = -5397417174`,
configurado y probado el 01/10/2026). El bot es `@Faltantes_Virgilio_bot`, el mismo que vacía
`public.telegram_outbox` (manda sólo de 07:00 a 21:00). ⚠ Un link de invitación (`t.me/+…`) **no** sirve
como destino: hace falta el número del grupo. Se saca con `getUpdates` del bot por `net.http_get` (el
token está en el Vault, `telegram_bot_token`; nada más en el sistema lee los updates del bot).

**Aviso de Movimientos a Thomy (Elías, 16/10/2026).** Cada vez que alguien abre **Movimientos** (`AREA` + `MOVIM`, sin
`ts_inicio`) el trigger `gt_aviso_movimiento` encola en `telegram_outbox` *«🔄 GT — <nombre> cargó Movimientos a las HH:MM
(<planta>). Motivo: <detalle.que>»* (el «Motivo» que escribe el operario; vacío → «— (no escribió)») al chat **privado** `gt.config.telegram_chat_movim`. ⚠ Telegram **no manda a un número de teléfono**: el chat
existe recién cuando Thomy abre `t.me/Faltantes_Virgilio_bot?start=<gt.config.telegram_movim_codigo>` y toca *Iniciar*.
El cron `gt-telegram-capturar-movim` (cada minuto, `gt.telegram_capturar_movim()`) lee `getUpdates`, guarda el chat que
mandó exactamente `/start <código>` y le confirma por el bot; con el chat cargado no hace nada más. Vacío = no avisa.
Lo que llega fuera de 07:00-21:00 sale a las 07:00 (horario del outbox). `sql/gt_v165_aviso_movimiento_telegram.sql`.

### v7.0 — códigos propios de Corte 45° y Grampeado (Thomas, 01/10/2026)

El mismo número es otra cosa según el área (**080** = «Cuadro Ciudades MDF» como producto, pero
«03 Negro 27.5*40» en Grampeado). Por eso hay dos fuentes y la app lee las dos por `gt_codigos_area()`:

| fuente | clave | para |
|---|---|---|
| `gt.codigos` + `gt.codigo_area` | código del producto, habilitado por área | áreas 3 a 7 (productos de Tierra Nativa) |
| `gt.codigos_rubro` | **(área, código)** con su propia descripción | Corte 45° (1–168) y Grampeado (003–240) |

El código se compara **sin ceros adelante** («21» = «021») y se guarda como figura en la lista.
Cargas: `sql/gt_codigos_tierra_nativa.sql` y `sql/gt_codigos_corte_grampeado.sql` (transcripto de las
fotos de los tableros: la medida de algunas filas es la lectura más probable).

### v6.0 — códigos por área y aviso de llegadas tarde (Thomas, 01/10/2026)

- **Códigos por área:** `gt.codigos` (323 productos de Tierra Nativa, con medida) + `gt.codigo_area`.
  Las áreas 3 a 7 (Encolado, Montaje, Gancho, Emblistado, Contraído) usan esa lista y piden código
  al empezar. Un área con código pero **sin** lista asignada (Grampeado, Guardado a góndola) acepta
  cualquiera. Carga: `sql/gt_codigos_tierra_nativa.sql`.
- **Llegadas tarde por Telegram** (`gt.alerta_llegada`): 08:05 avisa quién no registró nada antes de
  las 08:00; 10:30 manda el resumen (quién llegó tarde, con la hora, y quién sigue sin registro).
  Lun a vie, sin feriados. «Llegó» = primer registro del día en la app: **Tierra Nativa no tiene
  fichada en la base** (medido: 0 filas con legajo `t…` en las 4 tablas de fichadas).

### 1.62 — en Encolado el DECO se anota en unidades y los CUADROS en cajas (Thomas, 08/10/2026)

- Pedido: *«cuando encolan artículos de deco se anotan unidades y cuando encolan artículos de cuadro se encolan cajas. Hay que
  hacer esa norma de separación»*.
- **`gt.codigo_area.unidad`** (gt_v170): la unidad de ESE código en ESA área; vacía = la del área. Los **47 de deco activos** de
  Encolado (todo lo que no es Cuadro / Cuadros / Porta / Diploma: la misma separación de gt_v154; 106 filas contando las inactivas)
  quedan en **«unidades encoladas»**; cuadros, portas 220 a 224 y diplomas siguen en «cajas encoladas». En Montaje y el resto,
  el deco sigue en cajas. Otro código: `update gt.codigo_area set unidad = '…' where rubro = '…' and codigo = '…'`.
- **`gt.unidad_area(área, código)`** la resuelve para todos: el celular (`gt_codigos_area2` manda `unidad`: «¿Cuántas unidades
  encoladas del 456?», sin el aviso de más de 10 cajas), Producción (`gt_admin_produccion3`), Ritmo (`gt_admin_ritmo2`),
  Rendimiento (`gt_admin_rendimiento`), `gt.produccion` y `gt.movimientos` (un tramo en unidades **no** se multiplica por la UxB).
  Las 5 se cambiaron sobre la definición viva, con control de que cada reemplazo apareciera las veces esperadas.
- Medido al aplicarlo: 4 tramos de deco en Encolado (456 de Walter con 5 y de Ximena con **136**, 547 de los dos con 1). El 136
  de Ximena pasa de leerse 1.088 unidades (136 cajas × 8) a **136 unidades** = 17 cajas: era un dato bueno anotado en la unidad
  que se usa en el piso (D105 se retira para ese tramo). En `gt.movimientos` el 456 encolado quedó 5 y 136.
- `sql/gt_v170_encolado_deco_en_unidades.sql` · `tests/codigos.cjs` (456 en unidades sin aviso · 002 en cajas con aviso).

### 1.65 — Corte 213 / 214: «¿Qué cortaste?» (Elías, 16/10/2026, D16)

- El tablero «Codigos Corte 45° Bandeja» usa el 213 / 214 para el Cajón Porta Cubiertos (045 Chico / Grande), que ya eran
  012 Celeste 13 / 27.5 cm (Elías: *«está duplicado»*). Para separarlos en la producción, al terminar Corte con esos
  códigos se pregunta **«¿Qué cortaste?» · 012 Celeste / Cajón Porta Cubiertos** → `detalle.producto`.
- Nuevo en `gt.rubro_pasos`: **`si_campo = 'codigo'`** compara `si_valor` contra el código del tramo (sin ceros adelante),
  no contra otra respuesta. Sirve para cualquier pregunta que dependa del código. `sql/gt_v165_corte_213_214_pregunta.sql`,
  `tests/puesta.cjs`.
- El tablero de la Caja de Té repite números a propósito: el **307** (moldura 70) sale en 70 Grande de la Chica y la Mediana y
  en 70 Chico de la Grande; el **311** (moldura 03), en la tapa grande de la Chica y la Mediana; el **314**, las dos tapas de la Grande (Elías, 16/10):
  es el mismo largo de corte para cajas distintas (D14, Elías).

### 1.50 — «🔧 Puesta a punto encoladora» dentro de Encolado (05/10/2026)

- Pedido: *«dentro de encolado, apenas entrar, puedan tocar un botón que sea puesta a punto encoladora… se necesita hacer
  solamente en el encolador»*.
- Rubro nuevo **`PAPENC`** en `gt.rubros` (sin código ni cantidad, productivo). **No va en la botonera**: `DENTRO_DE = { PAPENC:
  "ENCOL" }` en `app.js` lo saca de las tarjetas y lo pone como botón en la pantalla del código de Encolado, arriba de «Tocá
  para sumarte». Al terminarlo, «¿Con qué código seguís en Encolado?»; desde el almuerzo propone Encolado. Otra área dentro
  de otra es sumar una fila en `gt.rubros` y una entrada en `DENTRO_DE`. Se saca con `update gt.rubros set activo = false
  where codigo = 'PAPENC'`. Sin cantidad, no entra a Rendimiento ni a movimientos. `sql/gt_v159_puesta_a_punto_encoladora.sql`,
  `tests/puesta.cjs`.
- **D66 (Thomas: «está bien. Solo se necesita a la mañana»):** queda productiva y sólo al entrar a Encolado (no se ofrece al
  cambiar de código). **D70 (Thomas: «dejalo por todo el día, capaz se necesita hacer más de 1 vez»):** sin límite de hora
  ni de veces. El commit 27796c5 dice «Hecho-por: sin confirmar»: lo hizo Thomas (employee_id 3).
- **425 y 426 (D69, cargados el 05/10, gt_v161):** se vendían en TN (425: 19,5 cajas/mes · 426: 8,67) sin ficha en ningún lado.
  Thomas: *«426 Línea Matisse Floral · 425 Línea Coral · 30x40»*. Cargados como «Cuadro Mold 03 Línea …», 30*40, en las 6 áreas
  de producto. **D73 (Thomas: «va x16 · Aro Natural»):** UxB 16 y marco Natural → aro 078 (03 Nat 27.5*40, como el 248). Mold 03 queda
  [Probable] (no se confirmó aparte; el aro Natural de 27,5×40 es de la 03).
  Entran a la demanda: 30 y 14 cajas. `sql/gt_v161_codigos_425_426.sql`.
- **Artículos de Easy (gt_v167, Thomas: «agregá todos estos», lista de venta jun-26 a sep-26):** de 34, 28 ya estaban. Entraron
  **257** Bauhaus Verde, **299** Música, **458** Infantil F, **469** Velvet (Mold 03 30*40 x16), **470** Set x2 Bauhaus Studio
  (30*40 + 30*40, x8 [Adivinando]) y **471** Set x3 Bauhaus Blue (3 × 30*40, x8), en las 6 áreas de producto, sin color de
  marco. Todos con venta en TN: entran a la demanda (294 cajas sin conteo). **D93:** la lista dice 420 = «Coral 30*40» y
  457 = «Infantil M 30*40»; la base, 420 = Wine 20*30 y 457 = Back to School 30*40: no se tocaron. `sql/gt_v167_codigos_easy.sql`.
- **1.51 (D72, Thomas: «sí»):** también en la pantalla de **Terminé de Encolado**: «🔧 Terminar e ir a Puesta a punto
  encoladora» cierra Encolado con sus cajas (las pide igual) y abre la puesta a punto; al terminarla, «¿Con qué código seguís en
  Encolado?». No sale al terminar la propia puesta a punto. Con 520 px de alto o menos va al lado de «Terminar y seguir», con
  el nombre corto. `tests/puesta.cjs`.

### 1.42 — el código se tipea con teclado numérico y una E al lado (Elías, 02/10/2026)

- Pedido: *«que todos los inputs para poner código sean numéricos y con un botón al lado para agregar a ese código o
  sacarle (en caso de doble tap) una E»* · *«también tiene que buscar en la lista si se le agrega la E»*.
- Los dos campos de código (Empecé y «¿Con qué código seguís?») abren siempre el **teclado numérico** (`inputmode`
  numeric). Al lado, el botón **E**: un toque la pone al final, otro la saca, y queda marcado mientras está puesta. No le
  saca el foco al campo (el teclado no se cierra). Al ponerla o sacarla se vuelve a buscar en la lista y abajo dice qué es
  («781E» → «Porta Mold 03 Caja Exhibidora · 13*18»).
- **Al revés también:** si se escribe **781** y en la lista sólo está el **781E**, abajo dice «Sin la E no está. 781E: …»,
  marca la E en naranja y, si se toca Empezar igual, «El 781 no está en la lista, el 781E sí: tocá la E» (con un segundo
  toque se registra el 781, como cualquier código fuera de la lista).
- Los códigos con letra que quedan activos son **781E y 782E**. Los **514G a 519G y 535W** los dio de baja Elías el
  02/10 (*«los G y W son discontinuos»*): `gt.codigos.activo = false` con `discontinuado_nota`; tenían 0 registros, 0
  pedidos y 3 cajas en la demanda (514G, 515G y 517G, 1 cada uno), que salieron. Si un código activo termina en otra letra,
  su botón aparece solo al lado de la E (sale de la lista del área, no del código).
- **1.44 (Elías: «en el módulo de encolado no va la posibilidad de que pongan la E»):** en **Encolado** no hay botón de letra
  (tampoco en «¿Con qué código seguís en Encolado?») ni aviso de «sin la E no está»: el 781 y el 781E (Porta Mold 03,
  13*18) se encolan igual, la caja exhibidora va después. `SIN_LETRA = ["ENCOL"]` en `app.js`; otra área sin la E es
  sumarla ahí.
- **gt_v154 — qué se encola** (Elías: *«lo único que se encola son los artículos de deco y los de cuadros, y los portarretratos
  del 220 al 224. Todo el resto de los portarretratos no se encolan»*): la lista de Encolado del celular pasó de 310 a
  **198** (146 cuadros, 47 de deco, portas 220 a 224). Salieron 58 portas, 10 espejos, 4 múltiples, 2 diplomas y 38 de
  reventa. **D56 (Elías: «diplomas sí se encola»):** volvieron el **192** y el **214** → **200**; espejos y múltiples
  siguen afuera. `gt.codigo_area.activo` (false = no se hace en esa área; el conector no deja `DELETE`); volver uno a la lista es
  `update gt.codigo_area set activo = true where rubro = 'ENCOL' and codigo = '…'`. Uno que no está, tipeado en Encolado,
  pregunta «¿Lo registro igual?» y avisa por Telegram como cualquier código fuera de la lista. En `gt.movimientos`, Montaje
  descuenta «encolado» sólo de lo que se encola. `sql/gt_v154_encolado_solo_cuadros_deco.sql`.
- `tests/letras.cjs` (320 y 390 px: la E en Corte y Emblistado, sin la E en Encolado, poner y sacar, 781 sin la E, el foco,
  «¿con qué seguís?»).

### 1.35 — al celular le faltaban los códigos de 5 áreas (Elías, 02/10/2026)

- Elías: *«estoy en guardado y no me aparece nada al poner 224»*. La API de Supabase corta cada respuesta en **1.000
  filas** y `gt_codigos_area()` tiene **2.273** (317 productos en 6 áreas + los propios de Corte, Grampeado, Deco y
  Recibir), ordenadas por área: al celular le llegaban Contraído, Corte, Deco, Emblistado y 127 de los 317 de Encolado,
  y **nada** de Gancho, Grampeado, Guardado, Montaje ni Recibir. Ahí no se mostraba qué producto era lo tipeado, no se
  preguntaba «¿Lo registro igual?» y Montaje / Gancho no preguntaban la medida de un set de 3 (1.17). El aviso de
  Telegram por código no registrado sí andaba (lo hace la base). Desde el 01/10; medido el 02/10: 7 aperturas con
  código en esas áreas, ningún set.
- `public.gt_codigos_area2()` (gt_v148) devuelve la misma lista en **una sola fila** (json, 26 KB comprimido); la app
  la usa y, si no está, cae a la 1. ⚠ **Cualquier RPC que pueda pasar de 1.000 filas tiene que devolver json en una
  fila** (o paginar): la API corta sin avisar.
- `tests/codigos.cjs`: base simulada que corta en 1.000 como la real; con la 1.34 fallaban Guardado, Grampeado, el «no
  está en la lista» y la medida del set; con la 1.35 pasan. `sql/gt_v148_codigos_area_completa.sql`.

### 1.26 — paquete terminado en Corte y surtidos repartidos (Thomas, 01/10/2026: D11, D15)

- **D15:** las varillas miden **2 m en promedio** y cada moldura trae otra cantidad por paquete. **03 = 100 varillas
  = 200 m** (cargado en `gt.moldura_paquete`). Para las demás: *«cuando terminen un paquete pongan terminé (en Corte)
  así empezás a tener registros»* → Corte pregunta al terminar **«¿Terminaste el paquete de moldura?» Sí / No**
  (`gt.rubro_pasos`, momento `terminar`; queda en `detalle.paquete`). No hubo que tocar la app.
- `gt.corte_paquetes`: un paquete = los metros de piezas cortadas de esa moldura y color entre un «Sí» y el siguiente
  (piezas × largo del código de Corte). El primero de cada moldura empezó antes del registro y no cuenta como completo.
  `gt.moldura_paquete_medido`: promedio por moldura de los completos y **aprovechamiento %** contra lo cargado
  (lo que no llega a 100 % es despunte y desperdicio de los cortes a 45°).
- **D11:** surtidos = **reparto parejo** entre sus colores (1/n si `proporcion` está vacía); 690 a 694 cargados en
  1/4 por color (Roble, Verde, Marrón, Cedro). `gt.producto_aro` da **una fila por color** con `cant × proporción`
  (columnas nuevas `color` y `proporcion`); «Sin marco» sale con `receta = 'sin marco'` y no descuenta aro.
- Colores de Thomas: 080–089 y 362/366/370 (importados) **sin marco**; 183 y 211 negro; 217, 233, 275 y 276 natural.
- `sql/gt_v127_surtidos_paquete_corte.sql` (rollback: `sql/gt_producto_aro_v126_vivo.sql`).

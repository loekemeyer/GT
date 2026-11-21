# Botonera y registro — reglas de GT

_Parte de `docs/REGLAS-GT-APP.md` (índice). Partido por tema el 21/11/2026; texto sin cambios, secciones en el orden del original._

### Qué registra el operario (Thomas, 01/10/2026)

**Etapa 1 — sólo el ÁREA.** La botonera son las 9 áreas de `gt.rubros`:

| área | al terminar cuenta |
|---|---|
| Corte | unidades cortadas |
| Grampeado | unidades grampeadas |
| Encolado | cajas encoladas |
| Montaje | cajas fabricadas |
| Gancho | cajas puestas de gancho |
| Emblistado | cajas emblistadas |
| Contraído | cajas contraídas |
| Pedidos | **no pregunta** (v5.0: armar uno puede llevar mucho; `pide_cantidad = false`) |
| Deco | unidades fabricadas |
| Guardado a góndola | cajas guardadas (v5.0) |

- Tocar un área = **Empecé** (`opcion = 'AREA'`, `rubro`, `ts_inicio` NULL).
- Tocar el área abierta = **Terminé**: pide la cantidad en la unidad del área (`ts_inicio` = hora de
  apertura, `cantidad`). Tocar **otra** área con una abierta cierra la anterior (con su cantidad) y
  empieza la nueva en el mismo paso.

**Etapa 2 — a definir con Thomas:** dentro de cada área, qué **código** empezó y cuántas cajas hizo;
al terminar pregunta el siguiente código. Va en `gt.tareas` (por rubro); el registro ya tiene
`rubro` y `cantidad`.

### v9.0 — al terminar, «¿con qué seguís?» en la MISMA pantalla (Thomas, 01/10/2026)

Thomas: *«una vez que terminan una tarea te tienen que preguntar con qué seguís, en el mismo momento…
lo más probable es que continúen en el mismo sector: por defecto sugerir seguir ahí y preguntar con
qué código»*. La pantalla de **Terminé** tiene dos partes: la cantidad (si el área la pide) y
**«¿Con qué código seguís en <área>?»**, con la **misma área** propuesta (o la que tocó, si tocó
otra). «Terminar y seguir» graba el cierre y la apertura siguiente juntos; «Cambiar de área / no
sigo» cierra y vuelve a la botonera. En Guardado aparecen ahí también los pendientes de Contraído.

### v5.0 — Pedidos sin cantidad y Guardado a góndola (Thomas, 01/10/2026)

`gt.rubros.pide_cantidad = false` cierra el área sin la pantalla de cantidad. La app lee las áreas
de **`gt_botones()`** (no de `gt_botonera()`: cambió lo que devuelve y un `DROP` no pasa).

### 1.54 — «🧹 Limpieza», igual que Movimientos (05/10/2026)

- Pedido: *«agregá botón limpieza»*. Rubro **`LIMP`** 🧹 (sin código ni cantidad, `productivo = false`, `todas_plantas`, orden 32).
  Desde la botonera es una tarjeta más: «Terminé» la cierra y vuelve la botonera. Con un área abierta es una **pausa** al lado
  de Baño y Movimientos (`PAUSA_DENTRO`): el área queda en pausa, adentro se puede ir al Baño, y «✅ Terminé la limpieza»
  pregunta «¿Seguís con Corte?» (si no, pide las cantidades). El tiempo de limpieza se descuenta del área (celular, admin y
  `gt.pausas_seg`, que mira `productivo`). Se saca con `update gt.rubros set activo = false where codigo = 'LIMP'`.
- **Sin la fila en `gt.rubros` el botón no aparece**: `sql/gt_v165_limpieza.sql`. `tests/pausas.cjs` (Corte → Limpieza → Baño →
  «¿Seguís?» No) y `tests/botonera.cjs` (14 áreas en los 16 tamaños). Fila `LIMP` cargada el 05/10 (Thomas, D80 «aplicalo»).
- **1.55 — la botonera de Javier (17 áreas) en 320×480 y 640×300:** con la tarjeta de 89 px y el ícono al costado no entraban
  7 nombres de una palabra (Movimientos +10 px, Grampeado +7, Facturación +7, Emblistado +6, Recibir mercadería +5, Contraído +2,
  Contraído a ISIS +2) y se partían a mitad de palabra; pasaba desde 1.52 (16 áreas). No era «Guardado a góndola»: la
  lectura de antes estaba mal. Ahora `acomodarAreas()` prueba una forma más, **`sin-ico`** (sólo el nombre, centrado): letra 14 px,
  todo entero. `tests/botonera.cjs` suma a Javier en 3 tamaños (falla con 1.54, pasa con 1.55). D82 (renombrarla «Guardar góndola», sobre
  esa lectura equivocada) se aplicó y **D83 (Thomas: «ok») lo volvió atrás**: sigue «Guardado a góndola». **D84:** quedó en la
  auditoría como corregido con 8055262 («Botonera de Javier (16-17 áreas) corta nombres a mitad de palabra…»).

### 1.71 — «Terminé el día» pide confirmar (Angely, 02/11/2026)

- Pedido: *«¿podés agregar que pida confirmación al terminar el día?»*, a raíz de Javier Burgos: su app «se cerró» y tuvo que entrar con el código. Causa medida: a las 13:53:08 se registró un **FIN** con «Terminé el día» (no fue la actualización de las 13:04); `finDelDia()` borra la sesión del celular y vuelve a la pantalla del código.
- `confirmarCant()`, con `p.modo === "fin"`: después de validar la cantidad y **antes de registrar nada**, `confirm("¿Terminar el día? Se cierra tu sesión: para volver a trabajar hay que ingresar de nuevo con el código de la TV.")`. Si dice que no, **no se registra ni el cierre del área ni el FIN** y se queda en la pantalla «Terminé» con la cantidad tipeada. Vale para los dos caminos (`#cantFinBtn` y `🏁 Terminar día` con un área abierta). Sin área abierta, `terminarDia()` ya pedía confirmar.
- Distancias reales en «Terminé» (Contraído con «Terminar e ir a Armado de cajas», 320/360/390 px): «🏁 Terminé el día» queda a **10 px** a la derecha de «🍽️ Me voy a almorzar» y a **8 px** (320) / **10 px** (360 y 390) debajo de «Terminar e ir a Armado de cajas»; cada botón mide 50 px de alto. El «toque sin querer» de Javier es **[Probable]**, no probado: no hay registro de qué botón tocó.
- `tests/smoke.cjs` (+1 control: dice que no → no registra FIN, sigue en la pantalla con el 30 tipeado; dice que sí → registra).

### 1.43 — tiempo muerto abajo del nombre, invitación cada 5 s y las pantallas de carga entran en celulares chicos (Elías, 02/10/2026)

- **Tiempo muerto** (*«agregale un contador de tiempo muerto abajo del nombre. Se reinicia a 0 cuando empiezan una tarea y
  vuelve a contar cuando le dan a Cambiar de área / no sigo, y también si desde el panel hace Baño o Movimiento (cuando
  termina regresan al panel)»*): abajo del nombre, «⏱ Tiempo muerto m:ss» (h:mm:ss pasada la hora; «T. muerto» en
  pantallas de 360 px o menos). Corre, en naranja, mientras **no hay nada abierto**: desde el último cierre o, al empezar
  el día, desde el ingreso con el código. Con un área, una pausa o el almuerzo abiertos queda en 0:00 gris. Un baño o
  movimiento hecho desde el panel lo pone en 0 y, al terminarlo, vuelve a contar desde 0. Se deduce de los eventos del día
  (`desdeMuerto()` en `app.js`): sobrevive a recargar y no graba nada nuevo en la base.
- **La invitación de pareja se revisa cada 5 s** (antes 15): *«que el revisar si llegó invitación sea cada 5 segundos»*.
- **Pantallas de carga en celulares chicos** (*«¿en estas partes y otras de los botones también es responsive?»*). Medido en
  los 16 tamaños de `nombres16.cjs`: el ancho, los textos y los botones ya se acomodaban; lo que no entraba era el **alto**
  (Terminé pedía bajar 81 a 161 px en celulares chicos y la clave, el código y «¿Con quién?», con el celular acostado).
  Con 620 px de alto o menos se compactan encabezado, tarjetas y campos (botones de 48 a 50 px); con 520 o menos, en
  Terminé «Cambiar de área», «Almorzar» y «Terminé el día» van en una fila y la clave va sin el logo; acostado, Terminé
  pone las dos tarjetas lado a lado y «¿Con quién?» va en 3 columnas. Ahora todo entra sin bajar en los 16 tamaños.
- `tests/muerto.cjs` (ingreso, área, baño adentro, «no sigo», movimiento desde el panel, almuerzo, más de una hora,
  320 px) y `tests/parejas.cjs` (la pregunta aparece sola en menos de 7 s).

### 1.36 — Baño también dentro de un Movimiento (Elías, 02/10/2026)

- Elías: *«y dentro de movimiento también puede ir al baño»*. Con un Movimiento abierto (desde la botonera o dentro de un
  área) aparece **🚻 Baño**; «Volví del baño» vuelve al Movimiento. La pila puede tener 3: área → Movimiento → Baño
  (`pilaAbierta()`: Baño va encima de un área o de un Movimiento; Movimiento, sólo encima de un área). `enPausa()` es lo
  que quedó justo debajo.
- **El baño de adentro se descuenta una sola vez**: el tiempo del área resta la UNIÓN de sus pausas (celular:
  `pausasDentro`; admin: `pausaMs`), y el Movimiento descuenta el baño que tuvo adentro. En la base (`gt_admin_ritmo2`,
  gt_v149) sólo cuentan las pausas que no están dentro de otra. Probado en transacción abortada: Corte 12:00–12:30,
  Movimiento 12:05–12:25, Baño 12:10–12:15 → Corte 10 min netos (no 5).
- `tests/pausas.cjs` (Baño dentro del Movimiento desde la botonera y dentro de Corte, y el reloj de Corte 20 − 10 = 10
  min), `tests/smoke.cjs` (admin: −0:35 de pausa, no −0:40). `sql/gt_v149_bano_dentro_de_movimiento.sql`.

### 1.34 — el reloj del área abierta y el Resumen de hoy no cuentan las pausas (Elías, 02/10/2026)

- Elías: *«tenía 2 min encolando, fui al baño 6-7 y al regresar aparecieron 9 min de encolando»*. En 1.33 el ritmo y la
  Producción del admin ya restaban las pausas, pero el celular no: el reloj del área abierta medía desde la apertura y el
  Resumen de hoy daba la duración entera del tramo.
- `pausasDentro(área, desde, hasta)` en `app.js` suma las pausas (Baño, Movimiento) ya cerradas que caen dentro del tramo;
  el reloj (`.ab-tiempo`, también el refresco de cada 30 s) y el Resumen las descuentan, y el Resumen lo aclara: «0:03
  (sin 0:06 de pausa)».
- `tests/pausas.cjs`: el caso de Elías (encolando desde hace 9 min con 6 de baño) → reloj 3 min y Resumen 0:03; con la
  1.33 daba 9 min y 0:09.

### 1.31 — «Baño» como Movimientos y sin «Cambiar de planta» en la botonera (Elías, 02/10/2026)

- Pedido: *«de la botonera sacá el botón de cambiar planta, y añadí Baño, funciona de igual forma que Movimientos»*.
- **Baño** (`BANO`, 🚻): una fila en `gt.rubros` igual a la de Movimientos (sin código ni cantidad, `todas_plantas = true`,
  orden 31) y `PAUSAS = ["ALMU", "MOVIM", "BANO"]` en `app.js`: al terminar propone volver al área productiva anterior.
  En la base Movimientos no tenía ningún trato aparte (sólo `'ALMU'` se excluye en producción, ritmo y jornada), así que
  Baño sale igual: aparece en Producción del admin con su tramo y cuenta como «llegó» en Asistencia.
  ⚠ **Cambia lo que Thomas había dicho en D31** (*«una sola: Movimientos»*, y Baño no existía). Se saca con
  `update gt.rubros set activo = false where codigo = 'BANO'`.
- **Sin «🏭 Cambiar de planta»**: quien trabaja en dos plantas (Darío, Luis Luna) cambia saliendo con ‹ y volviendo a
  entrar con el código del monitor; la pregunta «¿En qué planta trabajás hoy?» sigue al entrar.
- Con 13 áreas en Pellegrini, en pantallas de hasta 500 px de alto el encabezado y los márgenes de la botonera se
  achican, la tarjeta puede bajar a 48 px y, si es baja, el ícono va al costado del nombre (los dos centrados).
  `tests/botonera.cjs` y `tests/smoke.cjs` (Baño en las dos plantas, «¿seguís en Guardado?» al terminarlo, cambio de
  planta saliendo y entrando).

### 1.30 — la botonera de áreas entra entera en cualquier pantalla, con ícono y nombre centrados (Elías, 02/10/2026)

- Pedido: *«ahora aplicá lo mismo a esta botonera, y centrá el texto y la imagen al botón»*. Antes: tarjetas de 104 px
  en 2 o 3 columnas fijas, con el ícono y el nombre a la izquierda; en un iPhone 13 había que bajar para ver las 12 de
  Pellegrini y los botones de abajo.
- `acomodarAreas()` (`app.js`) usa la misma elección que «¿Quién sos?» (`elegirGrilla`): mide el lugar que dejan el
  encabezado y los botones de abajo y elige columnas y alto. Tarjeta de 56 a 120 px de alto (48 desde 1.31) y 88 px de ancho o
  más, para las áreas que haya (12 en Pellegrini y 4 en Esnaola; 13 y 5 con Baño, 1.31). Queda 3 × 4 en el celular chico, 2 × 6 en el grande, 6 × 2
  acostado, 3 × 4 o 4 × 3 en tablet y PC. Se rehace al girar o cambiar la ventana.
- Ícono y nombre **centrados** en la tarjeta. La letra baja (de 19 a 12 px) hasta que el nombre entra sin partir
  palabras; si la tarjeta es baja (menos de 84 px), sin el «Empezar» (lo dicen todas).
- Botones de abajo (`.pie`): con hasta 600 px de alto, Almuerzo, Terminar día y Resumen en una sola fila de 48 px (1.31,
  ya sin «Cambiar de planta»).
- Con un área abierta no cambia nada: sigue sólo «✅ Terminé».
- `tests/botonera.cjs`: los mismos 16 tamaños que `nombres16.cjs` con las 12 áreas reales, más Darío (dos plantas, un
  botón más) en los 4 más chicos y el giro del celular. Todo a la vista, sin scroll, centrado, el nombre entero.

### 1.28 — «Movimientos» en la botonera (Thomas, 01/10/2026: D31 «movimientos»)

- Pedido: qué pausas van además de Almuerzo → **una sola: Movimientos** (mover material, racks, etc.). Es una tarjeta más
  (🔄), sin código ni cantidad, y **en las dos plantas**: `gt.rubros.todas_plantas = true` hace que `gt_botones2` la
  devuelva una vez por planta activa (misma firma: sin `DROP`), y el celular filtra por la planta elegida.
- Al terminar Movimientos el celular propone **volver al área productiva anterior** (como al volver de almorzar):
  `PAUSAS = ["ALMU", "MOVIM"]` en `app.js`, y Recibir mercadería no cuenta como productiva. Baño, limpieza y demás no
  existían (D31); desde 1.31 Baño sí, a pedido de Elías.
- No mueve stock (`gt.movimientos` lo ignora), no entra al ritmo (sin cantidad) y cuenta como «llegó» en Asistencia.
- `sql/gt_v143_movimientos_area.sql`, `tests/smoke.cjs` (Movimientos en Pellegrini y en Esnaola, y el «¿seguís en
  Guardado?» al terminar).

### 1.11 — salidas desde «Terminé», Recibir sin «¿con qué seguís?» y control del monitor (Thomas, 01/10/2026)

- **D31:** con un sector abierto tampoco están Almuerzo ni Terminar día en la botonera: la pantalla de
  **Terminé** tiene «🍽️ Me voy a almorzar» y «🏁 Terminé el día» (piden la cantidad igual).
- **D29 (corregido en 1.12):** Recibir mercadería **no pregunta** Insumo / Moldura
  (`gt.rubros.pide_codigo = false` para `RECIB`, aplicado con el «sí» de Thomas); al terminar **no pide
  cantidad** (1.13, D30: `pide_cantidad = false`) y cierra con «Listo». Se retira la lectura de 1.11 (preguntar al empezar).
- **D27:** lunes 08:01, si nadie puso la clave del monitor entre 07:00 y 08:00 → aviso
  (`gt.alerta_monitor_lunes`). Y una clave puesta EN horario pero desde **otro equipo** que el de siempre
  también avisa (el caso del celular de Javier desde otro lugar). `sql/gt_v111_monitor_lunes_sin_clave_y_equipo.sql`.
- ⚠ El conector de Supabase también frena (60 s, sin llegar a la base) un `delete` o un `update` sin
  `where`, aunque sea dentro de una prueba que aborta.

### 1.8 — con un sector abierto, sólo «Terminé» (Thomas, 01/10/2026)

Con un área abierta la botonera no muestra las otras: sólo un botón grande **✅ Terminé**, que pide
cuánto hizo y, en la misma pantalla, «¿con qué seguís?». Para pasar a otra área: Terminé → «Cambiar de
área / no sigo». Desde 1.11 Almuerzo y Terminar día se eligen dentro de Terminé.
Con el almuerzo abierto, sólo «Volví de almorzar».

### 1.2 — aviso de código no registrado y actualización sola (Thomas, 01/10/2026)

- **Código fuera de la lista → Telegram «GT Avisos»**: trigger `gt_alerta_codigo_nuevo` sobre `gt.registros`
  (al EMPEZAR un área). Uno por cada apertura desde gt_v160 (antes, uno por área + código + día). Vive en la base para que avise aunque el celular
  tenga la app vieja. `sql/gt_alerta_codigo_no_registrado.sql`.
- **La app se actualiza sola**: cada 2 min lee `version.json`; si hay una más nueva y el operario no está
  cargando nada, recarga con `?v=<nueva>` (saltea la caché de 10 min de GitHub Pages). Si ya recargó con
  esa versión no lo repite. `tests/autoupdate.cjs`.

### Diseño para celular (v1.1, Thomas: *«que sea más lindo… se va a usar desde un celular»*)

- **Pulgar:** las acciones de cada pantalla van **justo debajo del campo** (`.acciones`, 1.9: fijas abajo las tapaba el teclado del iPhone), el encabezado fijo arriba con
  el «‹» de volver de 44 px. Todo lo que se toca mide **48 px o más**.
- **Campos de 16 px o más** de letra: menos que eso y el iPhone hace zoom al tocarlos.
- Áreas en **tarjetas con ícono** (`ICONO` en `app.js`; un área nueva sin ícono usa 🏷️), centradas y en las columnas
  que hagan falta para que entren todas (1.30). El área abierta va arriba con el **tiempo que lleva** (se actualiza cada 30 s).
- Resumen del día en tarjetas **dentro de un pop-up** (1.10, `#histPop`; ✕, tocar afuera o Esc cierran), horas en 24 h, **modo oscuro** si el celular lo tiene.
- Colores en variables de `:root` (`styles.css`); el modo oscuro las redefine.

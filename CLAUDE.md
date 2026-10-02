# CLAUDE.md — Producción GT

App web (PWA, sin framework) de **operario** para la planta **GT**. Copia el molde de la app de
operario de Gestión Virgilio: **código del monitor + nombre → botonera de tareas → cada toque es un
evento**. Se sirve por GitHub Pages desde `main`. Pedido de Thomas, 01/10/2026.

## Cómo está armada

| pieza | dónde |
|---|---|
| app de operario | `index.html` + `app.js` + `styles.css` (sin dependencias) |
| módulo admin (monitor) | `admin.html` |
| config (URL + clave **publishable**) | `config.js` |
| base | proyecto Supabase **`hrxfctzncixxqmpfhskv`** (el de Virgilio), **schema `gt`** |
| estructura de la base | `sql/gt_schema_v3.sql` (con rollback en la cabecera y los datos iniciales al final) |
| prueba | `node tests/smoke.cjs` (base simulada, no pega a Supabase) · `node tests/nombres16.cjs` (16 operarios en 16 tamaños de pantalla) · `node tests/botonera.cjs` (las áreas, ídem) · `node tests/pausas.cjs` (el tiempo sin las pausas) · `node tests/codigos.cjs` (la lista de códigos entera, con el tope de 1.000 filas de la API) |

### Cómo entra el operario (≡ clave de la TV de Virgilio, v23.82)

1. El **monitor** (`admin.html`) muestra el **código de ingreso**: 4 dígitos que **cambian cada
   minuto** (`public.gt_clave_actual`). Vale también el del minuto anterior.
2. En el celular el operario escribe el código → `public.gt_clave_validar` devuelve la lista de
   empleados activos → **elige su nombre**.
3. La sesión dura **el día**: al recargar no se vuelve a pedir el código.

⚠ **No es un candado**: el monitor lee el código con la clave pública. Sirve para que se entre
estando en la planta. La semilla es propia (`:gt-clave:`): el código de GT nunca coincide con el
de Virgilio.

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

### v10.0 — tipear el código y códigos nuevos (Thomas, 01/10/2026)

- **Sin lista desplegable**: en el iPhone el `datalist` tapaba el campo y no dejaba tipear. Abajo del
  campo se muestra qué es lo tipeado («03 Bco · 10 cm»). Teclado numérico si todos los códigos del
  área son números.
- **D7 hecho (01/10):** ya no existen `gt.*_v1` ni las funciones viejas (`gt_login`, `gt_areas`, `gt_botonera`,
  `gt_codigos`, `gt_clave_actual`, `gt_tareas()`, `gt_registros_hoy(text)`).
- **Un código que no está en la lista se pregunta** («¿Lo registro igual?») y, con el segundo toque,
  se registra. Para identificarlos después: `select * from gt.codigos_no_identificados order by ultima desc;`
  (01/10, D33: el **1000** en Corte de las 14:05 fue una prueba de Thomas, no se carga.)

### v9.0 — al terminar, «¿con qué seguís?» en la MISMA pantalla (Thomas, 01/10/2026)

Thomas: *«una vez que terminan una tarea te tienen que preguntar con qué seguís, en el mismo momento…
lo más probable es que continúen en el mismo sector: por defecto sugerir seguir ahí y preguntar con
qué código»*. La pantalla de **Terminé** tiene dos partes: la cantidad (si el área la pide) y
**«¿Con qué código seguís en <área>?»**, con la **misma área** propuesta (o la que tocó, si tocó
otra). «Terminar y seguir» graba el cierre y la apertura siguiente juntos; «Cambiar de área / no
sigo» cierra y vuelve a la botonera. En Guardado aparecen ahí también los pendientes de Contraído.

### Estado de los códigos al 01/10/2026 (cargados con el «sí» de Thomas, D13 + D10)

| área | pide código | lista |
|---|---|---|
| Corte | sí | 168 propios (Corte 45°; 157 y 158 entraron con D22, 159 a 168 con D27) |
| Grampeado | sí | 130 propios (234 a 240 entraron con D22 y D26) |
| Encolado · Montaje · Gancho · Emblistado · Contraído | sí | 323 productos (6 discontinuos desde D22: no se listan) |
| Guardado a góndola | sí | los 323 productos + pide cajas. **Se nutre de Contraído** (v8.0): al empezar muestra como botones lo contraído y todavía no guardado (`gt_contraido_pendiente`). Acepta **cualquier** producto, pero si no salió de Contraído **avisa y pide confirmar** (v11.0, D17) |
| Deco | sí | 71 de operación (tablero «08. Sector Deco» completo) |
| Pedidos | no | — (y no pide cantidad) |
| Almuerzo (`ALMU`) | no | botón aparte, no tarjeta; sin cantidad |
| Recibir mercadería | **no** (1.12, D29) | — ; al terminar no pide cantidad (1.13, D30) |
| Movimientos (`MOVIM`, 1.28, D31) | no | — ; sin cantidad. En **todas** las plantas. Es una pausa: al terminar propone volver al área productiva anterior |
| Baño (`BANO`, 1.31, Elías) | no | igual que Movimientos |

Avisos de llegada: van al grupo de Telegram **«GT Avisos»** (`gt.config.telegram_chat = -5397417174`,
configurado y probado el 01/10/2026). El bot es `@Faltantes_Virgilio_bot`, el mismo que vacía
`public.telegram_outbox` (manda sólo de 07:00 a 21:00). ⚠ Un link de invitación (`t.me/+…`) **no** sirve
como destino: hace falta el número del grupo. Se saca con `getUpdates` del bot por `net.http_get` (el
token está en el Vault, `telegram_bot_token`; nada más en el sistema lee los updates del bot).

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

### v5.0 — Pedidos sin cantidad y Guardado a góndola (Thomas, 01/10/2026)

`gt.rubros.pide_cantidad = false` cierra el área sin la pantalla de cantidad. La app lee las áreas
de **`gt_botones()`** (no de `gt_botonera()`: cambió lo que devuelve y un `DROP` no pasa).

### v4.0 — clave del monitor y código en Grampeado (Thomas, 01/10/2026)

- **El monitor pide clave.** La valida la base (`public.gt_monitor_clave`); está guardada **cifrada**
  en `gt.config` (`monitor_pass`, bcrypt), que `anon` no puede leer. **La clave no se escribe en el
  repo.** Se recuerda en esa máquina hasta «Salir». `gt_clave_actual()` sin clave queda revocada
  para `anon`: si no, el código se leería salteando la pantalla.
- **Un área con `gt.rubros.pide_codigo`** (hoy **Grampeado**) pregunta al empezar *«¿Qué vas a
  grampear?»*. El código va en `texto` de la apertura y del cierre, y la cantidad se pide *«del 505»*.
- **`gt.codigos`**: vacía, acepta cualquier código; con filas, sólo los de esa área o los sin área.
  Cargar los códigos es un `insert`, no un deploy.

### Base: schema `gt`

| tabla | qué es |
|---|---|
| `gt.empleados` | id, **nombre** (único), legajo (opcional), activo |
| `gt.rubros` | las **áreas**: código, nombre, **unidad** (lo que se cuenta al terminar), orden, activo |
| `gt.tareas` | (etapa 2) los códigos de cada área: código, descripción, `tipo`, `rubro`, `pide_texto` + `etiqueta_texto`, `fila`/`orden` |
| `gt.empleado_rubro` | (etapa 2) qué áreas tiene cada empleado. **Sin filas, ve todo** |
| `gt.registros` | el log de eventos, mismo formato que `Registros_Produccion_Virgilio`: apertura con `ts_inicio` NULL, cierre con `ts_inicio` = hora de la apertura, más `rubro` y `cantidad`. `client_id` único = sin duplicados |

- **El celular NO lee el schema `gt`**: RLS prendida y todo revocado para `anon`/`authenticated`.
  Entra sólo por RPC SECURITY DEFINER: `gt_clave_actual`, `gt_clave_validar`, `gt_areas`, `gt_tareas(empleado)`,
  `gt_registrar` (lote, contesta fila por fila `ok` / `rechazados`) y `gt_registros_hoy(empleado)`.
  Por eso **no hace falta exponer el schema en la API**.
- **La botonera NO está en el código**: agregar o sacar una tarea, un rubro o un empleado es un
  `insert`/`update` en el schema, no un deploy.
- **Una sola tarea abierta por operario.** La tarea abierta no se guarda: se deduce de los eventos
  del día (servidor + cola local), así sobrevive a una recarga.
- **Cola offline** en `localStorage` (`gt_queue_v3`), reintento cada 30 s y al volver la red. Una fila
  rechazada sale de la cola y queda en `gt_rechazados_v3` (no traba al resto — lección v25.20 de Virgilio).

### ⚠ El conector de Supabase NO deja correr un `DROP` desde la sesión

Medido el 01/10/2026: con `execute_sql` y `apply_migration` en «permitir siempre», todo `DROP`
(tabla o función) se queda esperando una confirmación aparte del conector y **se corta a los 60 s
sin llegar a la base** (no aparece en `pg_stat_statements`). `CREATE`, `ALTER`, `INSERT` y `UPDATE`
pasan. Por eso las tablas de la v1 se **renombraron** (`gt.operarios_v1`, `gt.tareas_v1`,
`gt.registros_v1`, vacías) en vez de borrarse. Un cambio que necesite borrar algo se escribe sin
`DROP` (renombrar, revocar) o lo corre el dueño en el SQL Editor de Supabase.

⚠ **Y también frena un `UPDATE` / `INSERT` cuyo texto lleva un `;` adentro de las comillas**
(medido el 01/10/2026 sobre `planify.tasks`: 4 de 4 con `;` en el literal se cortaron a los 60 s, 3 de 3 sin
`;` pasaron). El conector parte el pedido por `;` y lo que queda después no es una sentencia. En una nota o
descripción larga: sin `;` (va `.` o `·`), y si hay que buscar un texto que ya tiene `;`, se escribe con
`regexp_replace` y un `.` en su lugar.

**Datos al 01/10/2026:** 9 áreas en `gt.rubros` y 9 empleados en `gt.empleados`, sin legajo
(Thomas los pasa después).

### Cargar datos (con el «sí» del dueño, regla BD)

```sql
insert into gt.empleados (nombre) values ('<Nombre Apellido>') on conflict (nombre) do nothing;
insert into gt.rubros (codigo, nombre, unidad, orden) values ('<COD>', '<Área>', '<cajas …>', 10) on conflict do nothing;
insert into gt.tareas (codigo, descripcion, tipo, rubro, pide_texto, etiqueta_texto, fila, orden)
values ('<COD>', '<Descripción>', 'tarea', '<rubro o null>', false, null, 1, 1) on conflict do nothing;
```

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

### 1.34 — el reloj del área abierta y el Resumen de hoy no cuentan las pausas (Elías, 02/10/2026)

- Elías: *«tenía 2 min encolando, fui al baño 6-7 y al regresar aparecieron 9 min de encolando»*. En 1.33 el ritmo y la
  Producción del admin ya restaban las pausas, pero el celular no: el reloj del área abierta medía desde la apertura y el
  Resumen de hoy daba la duración entera del tramo.
- `pausasDentro(área, desde, hasta)` en `app.js` suma las pausas (Baño, Movimiento) ya cerradas que caen dentro del tramo;
  el reloj (`.ab-tiempo`, también el refresco de cada 30 s) y el Resumen las descuentan, y el Resumen lo aclara: «0:03
  (sin 0:06 de pausa)».
- `tests/pausas.cjs`: el caso de Elías (encolando desde hace 9 min con 6 de baño) → reloj 3 min y Resumen 0:03; con la
  1.33 daba 9 min y 0:09.

### 1.33 — ingreso vs. primer trabajo, Baño y Movimiento como pausa dentro del área, filtros en Producción (Elías, 02/10/2026)

- **Ingreso ≠ primer trabajo productivo.** Elías: *«una cosa es el horario de ingreso, cuando ponen el código, y otra el
  del primer mensaje productivo… llegan antes de las 8 porque entran a desayunar, pero el primer mensaje productivo tiene
  que comenzar a las 8»*. El celular graba `opcion = 'INGRESO'` al elegir el nombre después del código (no al recargar;
  fila `INGRESO` en `gt.tareas`, como `FIN`). Primer productivo = el primer «Empecé» de un área con
  `gt.rubros.productivo` (false: Almuerzo, Movimientos, Baño; Recibir y Pedidos cuentan). Asistencia
  (`gt_admin_asistencia2`): columnas **Ingreso** y **1.er trabajo**, chips «Arrancó N min tarde» (más de la tolerancia
  contra la entrada del horario) y «Sin trabajo productivo». Avisos (`gt.alerta_llegada`): 08:05 «no habían ingresado» /
  «ingresaron pero no empezaron a trabajar»; 10:30 «ingresaron después de las 08:00» / «empezaron a trabajar después de
  las 08:05 (N min tarde) · ingresó HH:MM».
- **Baño y Movimiento dentro del área.** Elías: *«el baño es sólo una pausa, no rompe nada: si estaba haciendo algo, va a
  continuar… al regresar de movimiento te va a preguntar si vas a continuar; si no, hay que poner las cantidades»*. Con un
  área abierta, debajo de «✅ Terminé» están **🚻 Baño** y **🔄 Movimientos**: el área queda en pausa (no se cierra).
  «Volví del baño» sigue en el área sin preguntar; «Terminé el movimiento» pregunta «¿Seguís con Corte?» y, si no, pide
  las cantidades de Corte y vuelve la botonera. En el celular es una pila (`pilaAbierta()`: abajo el área, arriba la
  pausa); en la base son tramos anidados del mismo operario.
- **El tiempo de la pausa no cuenta** (*«corte de 12:00 a 12:30 con baño de 12:15 a 12:30 = 15 min de corte»*):
  `gt_admin_ritmo2` resta las pausas que caen dentro de cada tramo (y los 2 min mínimos son netos); en Producción la
  duración sale neta con «−0:15 pausa» debajo. `gt.jornada_estado`: «área abierta» = apertura sin cierre.
- **Movimientos pregunta «¿Qué estás haciendo?»**, con respuesta escrita (una pregunta de `gt.rubro_pasos` sin opciones
  ahora se contesta escribiendo; va a `detalle.que`). Tocado desde la botonera (sin área abierta), «Terminé» lo cierra y
  vuelve la botonera, sin proponer el área anterior. Baño desde la botonera, igual.
- **Producción del admin: filtros por área, operario y familia** (valen para las tres tablas).
- `sql/gt_v147_ingreso_primer_productivo.sql` (probado en transacción abortada: corte 12:00–12:30 con baño 12:15–12:30 →
  30 piezas en 0,25 h; ingreso 07:40 y 1.er trabajo 12:00; área abierta con un movimiento cerrado adentro), `tests/smoke.cjs`.

### gt_v146 — en ENCOLADO la familia es sólo la medida (Elías, 02/10/2026)

- Elías: *«cuando se hace encolado la moldura no es un factor, solamente la medida»*. Cambia, **sólo para Encolado**, la
  regla de Thomas de 1.16 (*«misma moldura + misma medida = misma demora en cualquier proceso»*).
- `gt.rubros.familia_sin_moldura` (hoy `true` sólo en `ENCOL`) y `gt.familia(área, código, medida)`: con la marca, la
  familia es la medida («10*30»; un set de 3, «Set x3 · 15*21 + 20*30 + 30*40»); sin ella, `gt.grupo_tramo` como
  siempre. La usan el ritmo (`gt_admin_ritmo2`, también el promedio de 4 semanas, que se recalcula solo) y Producción
  (`gt_admin_produccion3`). Otra área que no dependa de la moldura: `update gt.rubros set familia_sin_moldura = true
  where codigo = '…'`. Las recetas de insumos por grupo no cambian.
- Medido sobre los 279 productos que GT fabrica: en Encolado pasan de **123 grupos de comparación a 59**, y los que van
  solos de 88 a 34. El 173 (Mold 03) y el 185 quedan juntos en «10*30»; el 224 (Mold 30mm) en «30*40», con cualquier
  30*40. En Montaje, Gancho, Emblistado y Contraído sigue «Mold 03 · 10*30».
- Probado con los tramos del 02/10 (clave cambiada en una transacción abortada): Luis Luna · Encolado · 10*30 (173, 185)
  y 30*40 (224); Walter Saucedo · Emblistado · Mold 03 · 30*40 (183). `sql/gt_v146_familia_encolado_medida.sql`.

### 1.32 — la FAMILIA de cada tramo en Producción del admin, y por qué el ritmo sale vacío (Elías, 02/10/2026)

- Pregunta: *«en admin no muestra el ritmo ni la familia, ¿están las familias subidas a la base? el encolado de la foto
  es 10*30»*. **Las familias están**: es el grupo de fabricación de 1.15 (moldura + medida), calculado de la descripción
  y la medida de `gt.codigos` por `gt.grupo_tramo()`: 224 de 317 activos tienen familia, el resto va solo. El 173
  (Cuadro Mold 03 Grafic Work, 10*30) es «Mold 03 · 10*30», con 130, 140, 154, 164, 180, 185, 215, 230 y 444.
- **El ritmo vacío era la regla D35**: sólo cuentan tramos de 2 min o más con cantidad, y el encolado de Luis duró 43 s
  (10:23:26 → 10:24:09). La tabla decía «Sin tramos con cantidad ese día», que confundía: ahora dice que hubo tramos y
  que duraron menos de 2 min.
- **La familia sólo salía en la tabla de Ritmo.** Ahora «Por operario» tiene la columna **Familia** (un código que va
  solo, «—»). `public.gt_admin_produccion3` = la 2 + `familia`, con la misma cuenta que el grupo del ritmo; es función
  nueva porque cambiar las columnas de la 2 pide `DROP`. `admin.html` llama a la 3 y, si falla, a la 2.
  `sql/gt_v145_admin_produccion_familia.sql`. Probado con la clave cambiada en una transacción abortada (3 tramos:
  173 → Mold 03 · 10*30, Movimientos sin familia, 224 → Mold 30mm · 30*40) y en `tests/smoke.cjs`.

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

### 1.29 — «¿Quién sos?» entra entera con 16 operarios, en cualquier pantalla (Elías, 02/10/2026)

- Pedido: *«que puedan aparecer 16 operarios en la pantalla… de cualquier dispositivo, tiene que ser responsive»*. La
  lista pasó de una columna de botones de 64 px (entraban 7 en un iPhone SE) a una **grilla que ocupa el lugar libre**.
- `acomodarNombres()` en `app.js` mide el lugar y prueba de 1 a 6 columnas: gana lo que entra sin scroll (fila ≥ 48 px,
  columna ≥ 88 px) y, entre eso, el botón más parejo (fila topeada en 96 px). Queda 2 × 8 con el celular parado, 4 × 4
  o 6 × 3 acostado, 3 × 6 en tablet o PC. Se rehace al girar el celular o cambiar la ventana.
- Se arma **siempre para 16** (`NOMBRES_LUGARES`) aunque haya menos: con los 9 de hoy el botón mide lo mismo que con 16
  y no cambia al dar de alta a alguien. Con más de 16 se arma para todos; si no entran, scroll dentro de la lista.
- La letra baja (de 20 a 13 px) hasta que cada palabra del nombre entra entera; si la columna es angosta, sin el círculo
  de iniciales y el nombre centrado.
- `tests/nombres16.cjs`: 16 tamaños (celulares de 320 a 430 de ancho, parados y acostados, tablet, PC, ventana cuadrada)
  con 16 nombres, 7 inventados y largos («Maximiliano Bustamante»). Todo a la vista, sin scroll, botón ≥ 48 px, nombre
  adentro. Además: al girar se reacomoda · con 9 mide lo mismo que con 16 · con 30 no se pasa de ancho.

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

### Admin: Monitor · Producción · Asistencia (1.5, Thomas — D26)

`admin.html` pide la clave del monitor (guardada cifrada en `gt.config.monitor_pass`, nunca en el
repo) y tiene cuatro pestañas:

| pestaña | RPC | qué muestra |
|---|---|---|
| Monitor | `gt_monitor_clave` | el código de ingreso |
| Producción | `gt_admin_produccion(pass, día)` | total por área (cantidad y unidades = cajas × UxB) y cada tramo por operario, con lo en curso |
| Asistencia | `gt_admin_asistencia(pass, día)` | entrada, almuerzo y salida contra lo previsto, con chips (llegó tarde, tolerancia, no vino, sin almuerzo, no terminó el día…) |
| Pedidos (1.27, D29) | `gt_admin_pedidos(pass, cerrados)` · `gt_admin_pedido_armar(pass, id, items, estado, nota)` | los pedidos de la página de TN (NP, cliente, días, vence, VENCIDO, cajas armadas / pedidas) con sus renglones; se escribe cuántas cajas se armaron por renglón y se marca cargado, entregado o cancelado |

Las dos RPC exigen la clave (`gt.pass_ok`): con clave mala devuelven 0 filas. Se elige el día; hoy se
refresca solo cada 60 s. `sql/gt_v15_admin_produccion_asistencia.sql`.
**Tolerancia de 5 min CON aviso** (D24): lo que cae dentro sale igual en Telegram, en su bloque.
**No se trabaja sábado** (D19). Javier Burgos: sólo el almuerzo es rotativo.
**Empleados ordenados por legajo** (1.7) en la lista del celular, Producción y Asistencia (`gt.legajo_num`).

### 1.27 — el ARMADO de pedidos se lleva desde el ADMIN (Thomas, 01/10/2026: D29 «por ahora solo desde el admin»)

- **📦 Pedidos** en `admin.html`: un bloque por pedido (NP · cliente · pedido de la página · fecha · días · **vence** y
  **VENCIDO** en rojo · cajas armadas / pedidas · nota) con la tabla de renglones (código · descripción · medida · UxB ·
  pedidas · **armadas**, editable). Botones: **💾 Guardar armado** (manda las cajas armadas por renglón y la base
  decide el estado: 0 = abierto, algunas = parcial, todas = armado) · **✔ Todo armado** (llena los campos, no graba) ·
  **🚚 Cargado al camión** (vale con armado parcial: D17, *sale parcial*) · **✕ Cancelar pedido** · en un cargado,
  **✅ Entregado** y **↩ Volver a armado**. La casilla «ver entregados y cancelados» trae los de 30 días.
- **El estado lo decide la base**, no la pantalla: `gt_admin_pedido_armar` topea lo armado a lo pedido, no deja tocar
  el armado de un pedido cargado / entregado / cancelado, exige cajas armadas para cargar y «cargado» para entregar.
  Las dos RPC exigen la clave del monitor (`gt.pass_ok`) y, como las otras del admin, las llama la página con la clave
  pública: con clave mala, lista vacía / `{ok:false}`.
- **No mueve stock todavía**: el movimiento góndola → pedido queda para cuando el stock esté vivo (`stock_pedidos_activo`).
  El área Pedidos del celular sigue sin pedir nada. **La pestaña no se refresca sola** (pisaría lo que se está tipeando):
  ↻ Actualizar, o después de cada acción.
- Probado en transacción abortada (parcial 2/26 → cargado → editar cargado rechazado → entregado · 11 cajas + 100 →
  topea a 11 y queda armado · clave mala no lista ni escribe) y en `tests/smoke.cjs` con la pantalla corriendo.
  `sql/gt_v139_admin_pedidos.sql`.

### Pedidos y qué fabricar — la base, sin app todavía (Thomas, 01/10/2026: D13, D17, D18, D20)

**Thomas:** *«góndola: tiene máximo y se debe llenar eso + los pedidos»* (D18) · *«máximo 14 días, OC de súper se
turnan»* (D20) · *«sale parcial o se lo espera algunos días»* (D17) · armado pedido por pedido, después (D13). En GT
el pedido es una **orden de fabricación**, no de despacho: no se arma y sale en 1-2 días como en Virgilio.

| objeto | qué es |
|---|---|
| `gt.producto_max` | los DOS máximos por producto, en cajas: `maximo_cajas` (góndola) y `maximo_consumo_cajas` (consumo). D25: vienen con el archivo de D19. Vacía |
| `gt.stock_inicial` | conteo inicial por depósito (en la unidad del depósito); los movimientos posteriores al conteo se suman encima. Vacía |
| `gt.stock` | saldo por depósito y código = conteo + `gt.movimientos` posteriores; `con_conteo = false` cuando no hay conteo |
| `gt.pedidos` + `gt.pedido_items` | la copia local de los pedidos (venga de donde venga): `pedido_ref` único por origen, `np`, `es_super`, `plazo_dias` (14), `estado` abierto → parcial → armado → cargado → entregado / cancelado; cajas y cajas armadas por renglón. Las llena `gt.sync_pedidos_tn()` desde la página de TN (D12, cada 10 min) |
| `gt.demanda_producto` | **sólo lo que GT fabrica** (`gt.codigos.fabrica`, D37) · **objetivo = máximo que rige + pedidos abiertos** (rige el consumo —calculado desde TN, o cargado a mano— y si no el de góndola: `maximo_rige`, `supera_gondola_cajas`, `consumo_cajas_mes`); `a_fabricar` = objetivo − góndola; `a_empezar` descuenta además lo que ya está en proceso (encolado a contraído). Sin conteo la góndola vale 0 y lo dice la `nota` |
| `gt.demanda_aros` · `gt.demanda_corte` | eso traducido a aros a grampear y piezas a cortar con las recetas de 1.23–1.26, menos lo que ya hay en stock |
| `gt.pedidos_plazo` | cada pedido contra su plazo (días, vence, vencido), % armado y si **puede salir completo o parcial** con la góndola de hoy |

- Probado en transacción abortada: 183 con máximo 100, 50 cajas contadas y 30 pedidas → fabricar 80 cajas = 1.280
  aros 03 Negro 27,5*40 = 5.120 piezas de corte; el 690 (surtido) reparte 120 aros por color; un pedido de 20 días
  sale `vencido` y `puede_salir_parcial`.
- `puede_salir` mira la góndola contra ESE pedido solo: dos pedidos que compiten por las mismas cajas salen los dos como
  cubribles. Es la primera versión; el orden de fabricación (D19) espera el archivo de Thomas.
- Todo es `security_invoker` y revocado a `anon` / `authenticated`: lo lee el MCP o una RPC futura, no el celular.
- `sql/gt_v131_pedidos_demanda.sql` (rollback en la cabecera).

### D22 y D25 (Thomas, 01/10/2026): discontinuos, aros nuevos, 713/714 Roble y el máximo por consumo

- **D25** *«máximo por góndola + máximo por consumo, se necesitan ambos»* → `gt.producto_max` lleva los dos
  (`maximo_cajas` = góndola, `maximo_consumo_cajas` = consumo; alcanza con uno). **Regla tomada de las OCs de
  Virgilio (*«la proyección es rey»*): rige el de CONSUMO si está cargado, si no el de GÓNDOLA**, y lo que el
  consumo supera a la góndola se fabrica igual y se guarda aparte (`supera_gondola_cajas`). Es lo elegido mientras
  llega el archivo de D19: si Thomas lo quiere al revés, es un cambio en `gt.demanda_producto`, no en los datos.
  Probado: 183 con góndola 100, consumo 150 y 50 en góndola → objetivo 150, fabricar 100, supera 50.
- **D22 discontinuos**: 115, 604, 640, 641, 642 y 645 (643 y 644 no existen) → `gt.codigos.activo = false` +
  `discontinuado_en` / `discontinuado_nota`. Salen de la lista del operario (`gt_codigos_area`) y de la demanda; si
  alguien lo tipea igual, entra como código no registrado y avisa por Telegram. `select codigo, discontinuado_nota
  from gt.codigos where not activo;`
- **D22 aros nuevos** en Grampeado (hay que agregarlos al tablero físico): **234** 3P 3/4 Bco P 30*40 y **235** 3P 3/4
  Negro 30*40 (224 Porta Gigante), **236** Bco P 60*80 y **237** Negro 60*80 (220), **238** 03 Negro 15*21 (sets 408 /
  409), **239** 012 Nat 10*10 (281). Y dos piezas de Corte, **157** 03 Negro 15 cm y **158** 03 Negro 21 cm, porque el
  tablero de Corte no las tenía y sin ellas el 238 quedaba sin receta. Todas resuelven solas (`gt.aro_piezas`).
- **D22 713 y 714 son Roble** → aros 017 / 020. **Un color se cambia con `select gt.color_fijar('713',
  array['Roble'], 'Thomas')`**: lo que no está en la lista queda `activo = false` en `gt.codigo_color` (no se borra:
  queda la historia, y el conector no deja `DELETE`); `gt.producto_aro` lee sólo las activas.
- **D22 «012 cedro para 30x40, no va» + D26 «marrón»**: el 214 (Diploma 012 c/Vidrio, 30*40) es **Marrón** y su aro es
  **240** 012 Marron 27.5*40 (nuevo, también va al tablero). ⚠ Al existir un solo aro 012 de 27,5×40, las bandejas de cama
  **540, 542 y 547** (sin color cargado) cayeron solas a ese aro (`receta = 'auto'`): vale sólo si son marrones. Se
  confirma cuando Thomas pase el color de los de deco. `sql/gt_v133_d26_214_marron.sql`.
- Resultado: **273 de 301 pares producto→aro resueltos** (antes 264 de 305). Los 28 sin resolver: 6 de los
  discontinuos y **22 sin color cargado** (deco, 045 y el 817).
- `sql/gt_v132_d22_d25_discontinuos_aros_consumo.sql` (rollback en la cabecera). Probado en transacción abortada.

### El CONSUMO (la Est. Madre de GT) vive en el Supabase de TIERRA NATIVA (Thomas, 01/10/2026)

**Thomas:** *«La lógica del consumo tiene que estar en Supa de Tierra Nativa»*. La proyección de venta de cada
producto se calcula **en el proyecto de TN**, sobre SUS ventas (`sales_lines`: 40.369 líneas, 10/2020 → 13/08/2026),
y Gestión sólo la lee. Es la misma regla que la Est. Madre de LK (`fn_proyeccion_oc_virgilio`), sin la parte de
empresas: **ventana de 6 meses cerrados, proyección = el mayor entre la media y el 4.º mejor mes; si en 6 no vendió,
12; reincorporados con 2+ meses cerrados → promedio desde que volvieron si da más; los de 5 dígitos no se proyectan;
excluidos y remaps de la propia página** (hoy 0 y 0). Parámetros en `app_settings` de TN (`gt_proy_meses_ventana` 6,
`gt_proy_piso_mejor_mes` 4, `gt_proy_meses_fallback` 12).

| paso | quién | qué |
|---|---|---|
| 1 | Thomas, SQL Editor de TN (✅ corrido el 01/10, `codigos_con_proyeccion: 314`) | `sql/gt_tn_consumo_1_lado_tierra_nativa.sql`: `gt_proy_cfg`, `gt_proy_window`, vista **`gt_proyeccion`** (cod · cajas/mes · uxb · fuente), con SELECT para `gt_reader` |
| 2 | Claude, Gestión (✅ aplicado, `gt_v138_consumo_tn`) | **`gt.consumo_tn`** (copia local, una fila por código), **`gt.sync_consumo_tn()`**, y `gt.demanda_producto` lee el consumo |
| 3 | Claude, Gestión (✅ hecho el 01/10 22:19 ART) | `sql/gt_tn_consumo_3_lado_gestion_despues.sql`: import de `gt_proyeccion` a `gt_tn`, primera corrida (**314 códigos · 206 en GT · 0 en cero**), cron **`gt-sync-consumo-tn`** diario 06:35 ART (jobid 127) |

- **Máximo por consumo = proyección mensual × `gt.config.consumo_meses_cobertura`** (1,5 por defecto, el índice de las
  OCs de Virgilio; D19 fija el real). Un `maximo_consumo_cajas` a mano en `gt.producto_max` gana (`maximo_rige =
  'consumo manual'`). **Un producto con consumo entra a la demanda aunque no tenga pedidos ni máximo de góndola**: se
  fabrica para reponer. Columnas nuevas al final de `gt.demanda_producto`: `consumo_cajas_mes`, `consumo_fuente`.
- **Validado el 01/10 con una copia de las tablas de TN** (schema temporal, transacción abortada; por el FDW directo
  se cortaba a los 60 s): **314 códigos con proyección, 12.551 cajas/mes; 206 son productos de GT**. Fuentes: 167
  ventana 6, 66 ventana 12, 81 reincorporados. Los 108 que no son de GT son Loeke/otros que TN también vende (582E,
  583E, 590E…) y la demanda los ignora. Cálculo: 677 ms sobre 40 mil líneas. Probado el máximo: 134 vende 55,83
  cajas/mes → máximo 84.
- **Lo que da la demanda con el consumo vivo (01/10, 22:20):** 210 productos — 203 rigen por consumo (`maximo_rige =
  'consumo'`) y 7 sólo por pedidos (082, 088, 132, 449, 538, 565, 745: no vendieron en la ventana de TN). Los 3
  discontinuos con venta (604, 640, 642) quedan afuera. **1.665 cajas a fabricar → 77 aros / 22.332 a grampear → 99
  piezas / 85.166 a cortar.** ⚠ Ese número está INFLADO a propósito hasta que entre el conteo inicial (D19): sin
  conteo la góndola vale 0 y `a_fabricar` = el máximo entero. Lo real es máximo − lo que hay en góndola.
- ⚠ **La última venta cargada en TN es del 13/08/2026**: la Est. Madre vale lo que valga la carga de ventas de TN.
  Si nadie sube las ventas, la proyección envejece sin avisar (mismo pozo que `watchdog_frescura_datos` en Virgilio).
- ⚠ `fetch_size` del servidor `tn_db` subido a **10.000** (default 100): con el default, 40 mil filas eran 400 viajes
  y una sola lectura entera pasaba los 60 s del conector.

### Pedidos de Tierra Nativa — acceso de sólo lectura, UNA sola vez (D12) · ✅ CONECTADO el 01/10/2026

**Thomas:** *«¿solo una vez?»* — sí. Fueron dos pasos y ninguno se repite, salvo que se cambie la contraseña:

| paso | quién | qué |
|---|---|---|
| 1 | Thomas, en el SQL Editor del proyecto de Tierra Nativa (`zjvpzqhbekxnwxdczpof`) | `sql/gt_tn_fdw_1_lado_tierra_nativa.sql`: crea el rol `gt_reader` (sólo SELECT, con una política de lectura por tabla con RLS, el mismo molde de `lk_ppp_reader` en Virgilio) |
| 1b | Thomas, en el Vault de Gestión (`hrxfctzncixxqmpfhskv`) | guarda esa contraseña como `tn_fdw_pass` |
| 2 | Claude, en Gestión | `sql/gt_tn_fdw_2_lado_gestion.sql`: servidor `tn_db` (host directo `db.<ref>.supabase.co:5432`, como LK → Virgilio), user mapping leyendo la contraseña **del Vault**, y las tablas de TN en el schema `gt_tn` (revocado a `anon`) |

**La contraseña nunca pasa por el chat ni por el repo**: el paso 2 la lee de `vault.decrypted_secrets`.

**Qué quedó andando (01/10, 20:44 ART):**

- Servidor `tn_db` + schema **`gt_tn`** con las **48 tablas** de la página de TN (misma estructura que la página LK:
  `orders`, `order_items`, `customers`, `products`, `customer_delivery_addresses`…), sólo lectura y revocado a `anon`.
  Cada consulta abre una conexión entre proyectos (~2,4 s): no se lee desde el celular ni en cada pantalla.
- **`gt.sync_pedidos_tn()`**, cron **`gt-sync-pedidos-tn`** (jobid 126, `4-59/10 * * * *`): copia a `gt.pedidos` /
  `gt.pedido_items` todo pedido de TN desde **`gt.config.pedidos_tn_desde`** (hoy `2026-09-01`) que no esté todavía,
  con NP **`TN 0001`, `TN 0002`…** en orden de llegada (lock, sin huecos), y marca `cancelado` lo que la página cancele
  si acá no salió. **Lo que ya está en GT no se pisa**: el estado lo mueve GT. Renglones borrados en la página después
  de entrar no se sacan (no hay `DELETE`). Los 358 renglones de TN matchean los 323 productos de `gt.codigos`.
- **Medido:** la página tiene **24 pedidos, todos `pendiente`**, del 01/04 al 09/09, ninguno enviado a compras (la
  página de TN no tiene el cron del mail). Con el corte en 2026-09-01 entraron **2**: `TN 0001` = pedido 29 (Huang
  Chun Chieh, 26 cajas) y `TN 0002` = pedido 30 (Bazares y Mas, 11 cajas), los dos ya **vencidos** contra los 14 días.
  La demanda con esos dos: 31 productos → 19 aros → 24 piezas de corte. **Los 22 anteriores: D28** (si ya salieron,
  no se cargan; si no, se corre el corte: `update gt.config set valor = '2026-04-01' where clave = 'pedidos_tn_desde'`).
- El armado pedido por pedido se lleva desde el **admin** (1.27, D29); el área Pedidos del celular sigue sin pedir nada
  y el `stock_pedidos_activo` sigue apagado.
- `sql/gt_tn_fdw_2_lado_gestion.sql` (aplicado como `gt_v136_tn_fdw_lado_gestion`), `sql/gt_v136_sync_pedidos_tn.sql`
  (aplicado como `gt_v137_sync_pedidos_tn`).

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

### 1.25 — Pintado cuenta paquetes y el Porta Cubo (Thomas, 01/10/2026: D6, D7, D8)

- **D8:** Pintado, al terminar, pide **paquetes** («¿Cuántos paquetes de moldura 03?»). Cuántos metros trae un
  paquete **depende de la moldura**: va en `gt.moldura_paquete` (moldura → metros por paquete; 03 = 200 m desde
  1.26, el resto se mide con el paquete terminado de Corte). Movimientos: Pintado + `moldura_pintada` (paquetes, con el color) y − `moldura_lijada`
  «sin anilina» en metros = paquetes × metros por paquete; sin el dato sale «sin receta» con la nota de lo que falta.
- **D6 / D24:** el **Porta Mold 30mm Cubo** (814 / 815 / 816) arma con los aros **3P 3/4 Bco T chicos** (063 / 064 /
  065): *«Bco T es cubo»* (Thomas). Se retira la lectura de 1.25 (Bco P 066 / 067 / 068). Corte los resuelve solo con
  las piezas **3P 3/4 Bco Total** 136 a 141. Los Bco P chicos quedaron con esas mismas piezas en `gt.receta_corte`
  (D6: «sí, se arman con Bco Total») y hoy ningún producto los usa. `sql/gt_v129_porta_cubo_bco_t.sql`.
- **D23 (Thomas, 01/10: «ok»):** los aros **Bco P** con lados de 20, 25 y 27,5 cm —**069** 20×25, **117** 20×27,5,
  **070** 20×30, **103** 27,5×40— toman esos lados de las piezas **Bco Total** de Corte (140 = 20, 142 = 25,
  143 = 27,5 cm) y los de 30 y 40 de la lista «3P 3/4 Bco» (114, 116). En Corte la 3P 3/4 blanca sólo existe como
  «Bco Total» por debajo de 30 cm: el «parcial» se define después, no al cortar. `gt.receta_corte`,
  `sql/gt_v134_d23_bco_p_lados_cortos_bco_total.sql`.
- **D27 (Thomas, 01/10: «creemoslos»):** las piezas de Corte que les faltaban a los 10 aros sin receta. Nuevas **159 a
  168** (Trav 20mm Celeste 62 · 03 Bco 27, 62, 29 y 67,5 · 03 Negro 30 · 03 Natural 23 · 3P 3/4 Negro 27,5 · 3P 1/2 Bco 120 ·
  3P 3/4 Bco Total 29, ésta para el 116 por la regla D23). Los **Trav 20mm** ya estaban en Corte (151, 153, 154, 155,
  156) **sin medida** —no se leía en la foto— y se les puso la que piden sus aros, con el código más bajo como lado
  más corto: **[Adivinando]** cuál etiqueta del tablero es cuál. Hoy ninguno de esos 10 aros lo usa un producto,
  salvo el 148 (lo usa el 146). Resultado: **todos los aros tienen con qué cortarse** (`select * from gt.aro_piezas
  where pieza is null` vacía). `sql/gt_v135_d27_piezas_corte_faltantes.sql`.
- **D7:** la anilina de Lijado se pregunta **al empezar** (como quedó en 1.24).
- `sql/gt_v125_pintado_paquetes_cubo.sql`. La vista completa vigente: `sql/gt_movimientos_vivo.sql`.

### 1.24 — Esnaola: moldura, anilina, color y metros (Thomas, 01/10/2026)

| área | al empezar | al terminar |
|---|---|---|
| Moldurado | ¿Qué moldura? | metros |
| Lijado | ¿Qué moldura? · ¿Le ponés anilina? · si Sí, color (Marrón, Cedro, Roble, Verde) | metros |
| Pintado | color (Blanco parcial, Blanco total, Negro, Verde, Celeste, Rosa, Beige) · ¿Qué moldura? | paquetes (1.25) |

- **Las preguntas viven en `gt.rubro_pasos`**, no en el código: orden, botones, condición (`si_campo` =
  `si_valor`) y `momento` (`empezar` / `terminar`). Cambiar una pregunta o pasarla al final es un `update`.
  La app las lee con `gt_pasos()` (con caché offline).
- **Las molduras salen de Corte** (`gt.molduras`: el prefijo de las descripciones del sector 1 de Pellegrini):
  03, 05, 012, 3P 1/2, 3P 3/4, 045, Trav 20mm. Una moldura nueva en Corte aparece sola.
- La moldura va en `gt.registros.texto`; anilina y color en **`gt.registros.detalle`** (jsonb). El cierre lleva
  el detalle de la apertura más lo que se pregunte al terminar. Lo de hoy se lee con `gt_registros_hoy3`.
- Movimientos internos: Moldurado **+ moldura** (metros); Lijado **− moldura, + moldura_lijada** (con
  «anilina Cedro» / «sin anilina» en la columna medida). Pintado: ver 1.25.
- El admin muestra la anilina / el color en la descripción del tramo; el 012 de Moldurado no se cruza con el
  producto 012. `sql/gt_v124_esnaola_pasos.sql`.

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
  TN. **D37 (Thomas, 01/10: «sí») → `gt.codigos.fabrica`** (gt_v144): false = reventa / importado, no entra a
  `gt.demanda_producto` ni a lo que cuelga de ella. En false: los 14 que nombró Thomas (cajas 661 a 663, cestos 619 a
  626, estantes 898 y 899, jabonera 920, set 900) y [Probable] 24 hermanos de reventa sin demanda ese día (jarrones,
  libros, frascos, individuales, macetas, canasto 901, set 902). Todo lo que lleva «Mold», los sets de bandejas (518,
  519, 660), Cartel Flecha 527, Org.Canasta 615, Percheros 632 y Secaplatos 557 siguen como fabricados. Medido: la
  demanda pasó de 210 a 198 productos y de 1.665 a 1.644 cajas; aros, ganchos y film no cambiaron. Marcar otro es
  `update gt.codigos set fabrica = false where codigo = '…'`. `sql/gt_v142_insumo_reglas.sql`,
  `sql/gt_v144_demanda_solo_fabricados.sql`.

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

### 1.22 — plantas: Pellegrini y Esnaola (Thomas, 01/10/2026)

- Después del código de la TV y el nombre, **quien trabaja en más de una planta** elige *«¿En qué planta trabajás
  hoy?»*. **Pellegrini: los 9 empleados. Esnaola: Darío Méndez (6) y Luis Luna (5)**; el resto entra siempre en
  Pellegrini y no ve la pregunta. (Se cargó primero como «Aula», mal dictado: la fila `AULA` quedó inactiva.)
- La botonera muestra sólo las áreas de esa planta: un área (`gt.rubros.planta`) **sin planta es de la principal**
  (la de menor `orden` en `gt.plantas`). En **Esnaola** se moldura, se lija y se pinta (las molduras que después
  se cortan en Pellegrini): áreas **Moldurado · Lijado · Pintado** (desde 1.24 preguntan moldura, anilina, color y metros: ver 1.24).
- La planta queda en la sesión del día y viaja en cada evento (`gt.registros.planta`). «🏭 Cambiar de planta» se sacó
  en 1.31: se cambia saliendo con ‹ y volviendo a entrar.
- Quién trabaja en qué planta = `gt.empleado_planta` (sin filas = sólo la principal). Agregar a alguien es un `insert`.
- La app lee `gt_botones2()` (trae la planta); si falla, cae a `gt_botones()`. `sql/gt_v122_plantas.sql`.

### 1.18 — deco se agrupa por modelo (Thomas, 01/10/2026)

Bandejas, cajones, percheros, cuelgas…: sólo van juntos si la descripción es la misma salvo el diseño
(modelo antes de «Mold» + moldura + medida): 540 = 542, 563 = 583, 564 = 584, 565 = 585. Cuadros, porta,
espejos, diplomas y múltiples siguen con moldura + medida. Excepciones (1.19, en `gt.codigo_grupo`): 818 con
456/536 (Mold 12 = 012), 547 con 540/542, 541 solo. `sql/gt_v118_grupo_deco.sql`.

### 1.17 — sets de 3 (Thomas, 01/10/2026)

- Un **set de 3** («Set x3» en la descripción) se compara **sólo con sets de 3** en todo el proceso: grupo
  «Set x3 · Mold 03 · 15*21 + 20*30 + 30*40» (medidas ordenadas). Hoy: 7 + 4 cuadros, 2 bandejas, 900, 902.
- En **Montaje y Gancho**, con un set de 3 la app pregunta **qué medida** va a montar / ponerle gancho
  (3 botones). Va en `gt.registros.medida` (apertura y cierre) y ese tramo se compara con **moldura + esa
  medida** (los cuadros sueltos de esa medida). Al seguir con el mismo set, la vuelve a preguntar.
- La app lee lo de hoy con `gt_registros_hoy2` (trae la medida). `sql/gt_v117_sets_medida.sql`.

### 1.15 — grupo de fabricación (Thomas, 01/10/2026)

Misma **moldura (o MDF) + misma medida** = misma demora en cualquier proceso (1.16, Thomas: el tipo NO
entra; se retira el «tipo + moldura + medida» de 1.15; **salvo Encolado, que va sólo por medida: gt_v146, Elías**): el 134 y el 183 son «Mold 03 · 30*40» (38 códigos:
cuadros, diplomas y espejos). El ritmo del admin (`gt_admin_ritmo2`) agrupa por ese grupo y
compara contra el promedio **del grupo** en el área (4 semanas). 226 de 323 códigos en 64 grupos; el resto
va solo. Excepción a mano: `gt.codigo_grupo`. `sql/gt_v115_grupo_fabricacion.sql`.

### 1.14 — celular nuevo / compartido, cierre automático y ritmo (Thomas, 01/10/2026: D33, D34, D35)

- **D33 (trigger `gt_alerta_dispositivo` sobre `gt.registros`):** cada evento trae el id del celular. Avisa a
  «GT Avisos» si un operario con días anteriores entra desde un celular que **nunca usó**, y si un mismo
  celular lo usan **2+ operarios el mismo día**. Un aviso por caso. El primer celular de cada uno no avisa.
- **D34 (cron `gt-cierre-automatico`, lun-vie 18:30 AR):** lo que quedó abierto se cierra a la hora de salida
  de ese operario, **sin cantidad**, con `dispositivo = 'sistema:cierre'`, y avisa la lista. Si después llega
  el cierre real del celular (cola offline), el del sistema pasa a `opcion = 'AREAX'` y deja de contar
  (trigger `gt_cierre_real_reemplaza`). En el admin se ve «🔒 cerrado solo» (`gt_admin_produccion2`).
- **D35 (`gt_admin_ritmo`):** en Producción, por operario y área: lo hecho (en unidades si hay UxB), horas,
  por hora y el promedio del área en las 4 semanas anteriores (rojo ≤ −20 %, verde ≥ +20 %). Cuentan sólo
  tramos de 2 min o más con cantidad; con menos de 15 min en el día no se informa el ritmo.
- `sql/gt_v114_dispositivo_cierre_ritmo.sql`. Probado en transacción abortada (avisos, cierre, reemplazo).

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

### 1.6 — el monitor se abre el LUNES 07:00–08:00; fuera de eso, aviso (Thomas, 01/10/2026)

- Todos los lunes ~07:30 Javier pone la clave en la PC. La clave guardada **vence el lunes 07:00**
  (hora AR): ese día el monitor la pide de nuevo («Es lunes: volvé a poner la clave»).
- Cada clave **tipeada** pasa por `public.gt_monitor_login` y queda en `gt.monitor_ingresos` (ok, en
  horario, equipo, navegador). Clave buena **fuera** de la ventana → 🔐 aviso a «GT Avisos». La lectura
  del código cada minuto (`gt_monitor_clave`) no cuenta como ingreso.
- Ventana en `gt.config` (sin fila = default): `monitor_login_dow` 1 · `monitor_login_desde` 07:00 ·
  `monitor_login_hasta` 08:00. `sql/gt_v16_monitor_login_lunes.sql`.
- Consulta: `select * from gt.monitor_ingresos order by ts desc;`

### 1.4 — horario por día de la semana (Thomas, 01/10/2026)

`gt.horario_dia` (empleado, día 1–7): manda sobre `gt.horario_empleado` y `gt.config`. `sin_almuerzo` = de corrido.

| empleado | días | entrada | almuerzo | salida |
|---|---|---|---|---|
| Lautaro Durante | lun, mié, jue, vie | 08:00 | 12:40–13:00 | 17:30 |
| Lautaro Durante | martes | 08:00 | de corrido | 13:30 |
| Javier Burgos | todos | 08:00 | **flexible** | 17:30 |
| el resto | todos | 08:00 | 12:00–13:00 | 17:30 |

Los avisos miden a cada uno contra **su** horario del día y lo muestran entre paréntesis.

### 1.3 — unidades por caja y jornada completa (Thomas, 01/10/2026)

- **Unidades por caja** en `gt.codigos.uxb` (los 323 productos). Las áreas 3 a 7 se analizan en unidades:
  `select * from gt.produccion` da cada tramo con `cantidad` (cajas) y `unidades` (cajas × UxB).
- **Jornada**: todos entran a las **08:00**, almuerzan de **12:00 a 13:00** y se van a las **17:30**
  (`gt.config`). **Javier Burgos** tiene almuerzo flexible (`gt.horario_empleado`); **Lautaro** tiene horario fijo por día (1.4).
- En la app: **🍽️ Almuerzo** (cierra el área con su cantidad; al volver propone el área anterior) y
  **🏁 Terminar día** (evento `FIN`; desde 1.20 vuelve a la pantalla del código de la TV y cierra la sesión; si vuelve a entrar ese día puede trabajar pero avisa por Telegram, 1.21). Si no lo tocan, el día **no** figura terminado.
- **Avisos a GT Avisos**: 08:05 y 10:30 (entrada), **13:10 almuerzo** (no ficharon / salieron antes /
  volvieron tarde; los flexibles, informativo) y **17:45 salida** (no terminaron el día / se fueron antes /
  flexibles con almuerzo de más de 1 h). Lun a vie, sin feriados. `gt.alerta_jornada`, `gt.jornada_estado`.

### 1.2 — aviso de código no registrado y actualización sola (Thomas, 01/10/2026)

- **Código fuera de la lista → Telegram «GT Avisos»**: trigger `gt_alerta_codigo_nuevo` sobre `gt.registros`
  (al EMPEZAR un área). Uno por área + código + día. Vive en la base para que avise aunque el celular
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

### Versión (Thomas, 01/10/2026)

**La app arrancó de nuevo en 1.0** (lo anterior, v1.0 a v12.0, fue el armado). Cada modificación sube
el número de a uno: **1.0 → 1.1 → … → 1.9 → 1.10 → … → 1.99 → 2.0**. Se sube con el script, que mueve
los 4 lugares juntos (`APP_VERSION` en `config.js`, `SW_VERSION` en `sw.js`, `version.json` y los `?v=`
de `index.html` y `admin.html`):

```bash
node scripts/bump-version.cjs        # la siguiente
```

⚠ 1.10 es **mayor** que 1.9: si algún día se comparan versiones, se comparan por número, no como texto. Commits `vX.Y: descripción`, directo a `main`, con el trailer
`Hecho-por: <Nombre> (employee_id <N>)`.

---

> Los bloques de abajo son las reglas que valen para **todos** los repos, copiadas textuales del
> `CLAUDE.md` de `loekemeyer/gestion-virgilio` (regla 6 de Planify). Si chocan con algo de arriba,
> manda lo de arriba sólo en lo que es propio de GT.

## ⚠ CÓMO RESPONDER (vale para TODOS los repos — copiar este bloque entero al `CLAUDE.md` del repo nuevo)

Pedido de Elías, 28/09/2026. Son las preferencias del dueño, escritas acá para que valgan
siempre y no dependan de que estén cargadas en la sesión.

### ROL

- Actuá como **asesor, no asistente**. Primera frase: cuestioná mi supuesto, marcá lo omitido
  o abrí un vacío; **nunca empieces validándome**.
- Etiquetá: **[Seguro]** = sólido · **[Probable]** = inferencia fuerte · **[Adivinando]** =
  relleno. Si predomina especulación, avisalo.
- **Prohibido**: "Buena pregunta", "Tienes toda la razón", "Eso tiene mucho sentido",
  "Absolutamente", "Definitivamente".
- Si discrepás: *"No estoy de acuerdo porque [razón]. En su lugar haría [alternativa]. El
  riesgo es [riesgo]"*.
- **Verdad incómoda primero.** Si me contradigo, no retrocedas salvo info nueva; "pero yo
  creo…" no cuenta.
- Respuestas **breves y numeradas**; actor + acción por punto.
- Claude Code / UI: evitar 100% de ancho y huecos.

### DATOS

- Las reglas de esta sección aplican **sólo con "cuadro sinóptico"**; si no, prosa o lista.
- Tabla con **3+ filas comparables**; si no, lista. **Nunca 2 columnas para una oración.**
- Tabla: unidad y período si aplica. Sin "varios / algunos / muchos": **número exacto o nada**.
- Ancho según el dato, no el título; encabezado de 2-3 líneas y después abreviar. Sin ancho
  fijo, relleno, color ni espacio muerto.
- **Coma decimal, punto de miles**; gramos con 2 decimales.
- Ordenar por **gravedad o dinero, mayor → menor**; nunca alfabético.
- Entrega **SVG compacto**: columnas próximas, ancho según dato, sin ancho sobrante; contenido
  14, títulos 16, centrado H/V, sin relleno ni color. Si no hay SVG, markdown normal sin
  columnas vacías ni `&nbsp;`.

### CORRECCIÓN

- Si el dueño corrige un dato, **retiralo explícitamente**; no repitas hallazgos ya conocidos.
- Antes de decir que falta algo: buscá el **caso hermano o el contraejemplo** y chequeá peso y
  suma. Si no cierra, decilo; **no inventes**.
- Cerrá con **decisiones pendientes: máximo 3, por impacto**. **Sin resumen.**
  ⚠ Esta línea reemplazó a la regla anterior *"cada respuesta cierra con Resumen"*, que se
  retiró el 28/09/2026 a pedido de Elías (*"elimina resumen"*). Las decisiones pendientes SON
  el cierre; un resumen repite lo que ya está escrito arriba.

### BD

- **Nunca INSERT / UPDATE / DELETE sin un "sí" del dueño EN ESE MOMENTO.** Antes hay que
  mostrar el **SQL exacto y sus efectos en cadena**. Un "espera" **anula** la autorización.
- ⚠ **Precisión de Thomas (01/10/2026, GT):** *«No hace falta que me preguntes solamente para que te diga el sí, cuando
  es algo que yo ya te expliqué y te dije»*. Si la escritura es la ejecución directa de lo que el dueño pidió, se hace
  sin pedir el «sí». Se pregunta sólo cuando algo no se entendió, cuando se haría de otra manera o cuando la idea es
  de Claude (una sugerencia).
- **Después de escribir: SELECT de verificación.** Siempre.
- **EXCEPCIÓN — Planify**: sólo **crear y cerrar tareas** va automático. Cualquier otro cambio
  requiere el "sí". **Auditoría**: toda escritura requiere confirmación, sin excepción.

### PLANIFY y AUDITORÍA

Las reglas completas están más abajo en este mismo archivo (bloques *"preguntar QUIÉN habla"*
y *"auditar en Supabase cada problema"*). **No se duplican acá a propósito**: dos copias de la
misma regla terminan divergiendo, que es el pozo del módulo de Matricería duplicado (1.0.67 →
1.0.71). Tres puntos donde la versión corta que circula está **desactualizada**, corregidos
el 28/09/2026:

1. **Thomas Loekemeyer es el `employee_id` 3, NO el 20.** El 20 es **Tomás Beviglia**. Los
   pedidos de Thomas van a `Tareas T` (empleado 3) o al Planify del área que corresponda, con
   el prefijo `Th `. Mandarlos al 20 es lo que hizo que la agenda de Tomás juntara 92 pedidos
   que no eran suyos.
2. **La pregunta "¿Falta algo más para dar por cerrada la tarea?" está PROHIBIDA.** El cierre
   es por criterio propio y sin preguntar (dueño, 11/09/2026: *"las que ya están cerradas,
   cerradas"*).
3. **La nota de la tarea lleva el formato obligatorio**, no "1-3 líneas sueltas":
   `Falta: <qué hay que hacer>. Pedido de <Nombre> · cargada por Claude, sesión <url>`.

### DECISIONES PENDIENTES CON CÓDIGO (Thomas, 29/09/2026)

- Cada decisión que se le pide al dueño lleva un **código único D1, D2, D3…** que **no se reusa nunca**
  en la sesión. Él contesta *"D2 sí"*. Una decisión ya contestada se retira y su código no vuelve.
- Se responde **sólo lo pendiente**, conciso: el análisis arriba y las decisiones al final.
- **El cierre lista TODAS las decisiones pendientes de la sesión**, no sólo las del último mensaje
  (*"culminás siempre el mensaje con el resumen de todos los pendientes, todos juntos en uno solo"*).

### ⚠ ANTES DE EMPEZAR A TOCAR UN REPO: mirar el semáforo

Pedido de Elías, 28/09/2026: *"con esto podés poner 'estás haciendo push o commit ahí' y
leerlo de ahí para saber si tenés que esperar o si tenés vía libre"*.

**Al arrancar el trabajo en un repo** (antes de escribir la primera línea, no antes de
pushear):

```sql
-- 1) ¿hay alguien más adentro? Cero filas = vía libre.
select * from planify.planify_proyecto_via_libre(<tu_employee_id>, '<owner/repo>');

-- 2) registrarse (idempotente: llamarla de nuevo sólo renueva el latido). Un repo nuevo se da de alta solo.
select planify.planify_proyecto_sesion_abrir(
  <tu_employee_id>, '<owner/repo>', '<url de esta sesión>', '<qué vas a tocar>', '<branch>');

-- 3) antes de pushear, marcar el estado
select planify.planify_proyecto_sesion_abrir(
  <tu_employee_id>, '<owner/repo>', '<url de esta sesión>', null, null, 'pusheando');

-- 4) al terminar
select planify.planify_proyecto_sesion_cerrar(<tu_employee_id>, <sesion_id>);
```

**El repo va por nombre** (`'loekemeyer/gt'`; mayúsculas, la URL de GitHub o el `.git` dan igual), **no hace falta
darlo de alta antes** (Elías, 02/10/2026: *«no deberías tener que hacer un SQL por cada nuevo repo»*). Hasta ese día
las dos funciones pedían el `repo_id` de `github_repo_problemas.repos`, y un repo que nunca había registrado un problema
—GT— no estaba ahí: el semáforo no se podía usar sin un `insert` a mano. Ahora `sesion_abrir` lo da de alta (después de
chequear el permiso) y `via_libre` sólo lo busca: sin alta, nadie adentro. Las versiones con `repo_id` siguen andando
igual (la página de Planify las llama así). `sql/planify_semaforo_repo_por_nombre.sql`.

**Estas cuatro escrituras van AUTOMÁTICAS, sin pedir el "sí"** — misma excepción que crear y
cerrar tareas de Planify. Son telemetría de quién está trabajando dónde, no tocan ningún dato
del negocio, y si hubiera que pedir permiso cada vez nadie las usaría, que es exactamente cómo
`problemas.sesion_url` terminó cargada en 14 de 580 filas.

⚠⚠ **ESTO NO ES UN CANDADO Y NO PUEDE SERLO.** Frena a quien lo lee, no a quien no lo lee.
**El candado real es git**, y funciona: el 28/09 a las 16:52 un push fue rechazado porque otra
sesión había pusheado 9 minutos antes tocando el mismo archivo. Lo que agrega el semáforo es
avisar **al principio** en vez de al final, con el trabajo ya hecho. Si el semáforo dice verde
y git rechaza, **manda git**.

⚠ **El lease se vence solo a los 45 minutos sin latido**, a propósito: un contenedor de Claude
Code web se recicla sin avisar (pasó con el commit de 1.0.78), y una fila abierta para siempre
deja el repo en rojo por nadie, que es peor que no tener semáforo.

**El caso real que esto viene a evitar** no es que se pisen los pushes —eso nunca pasó, se
verificó sobre los 141 commits que compilaron y ninguno quedó huérfano— sino el del 16/09:
**dos sesiones construyeron el mismo módulo de Matricería en paralelo**, las dos pushearon
bien, git integró todo, y **se tiró un módulo entero de 18 funciones** porque hubo que elegir
uno. Git cuida la integridad; no cuida el trabajo duplicado.

### El commit dice QUIÉN LO HIZO

Todo commit lleva este trailer, con la persona que estaba en la sesión de Claude — **el que
hace, no el que pide**:

```
Hecho-por: <Nombre> (employee_id <N>)
```

Y sólo **cuando difiere**, se agrega también quién lo pidió:

```
Pedido-por: Thomas Loekemeyer
```

⚠ **Por qué hace falta, medido el 28/09/2026 sobre los 309 commits de Planify**: **275 (89%)
tienen exactamente el mismo autor de git** (`Claude <noreply@anthropic.com>`) y todos los
pushes salen de la misma cuenta de GitHub. **Por git es imposible saber quién trabajó.** El
dato existe —Claude pregunta quién habla al empezar la sesión— pero no llegaba a ningún lado.

⚠ **Y "quién pidió" NO sirve como sustituto**: Thomas tiene **0 eventos de sesión** y nunca se
logueó, y hay **40 commits que lo mencionan**. En esos 40, quien pidió no puede ser quien hizo.
147 de los 309 commits nombran a una persona en prosa, pero **sin decir en qué rol**, así que
ese dato no se puede agrupar ni parseando.

El precedente de que un trailer fijo funciona es `Claude-Session:`, presente en **238 de 309
commits (77%)**.

## 🟥 REGLA RECTORA (Luis, 28/09/2026): OPTIMIZACIÓN DE ESPACIO EN TABLAS Y VISUALES

**Vale para TODOS los repos y TODA pantalla, tabla, ficha o reporte** (copiar este bloque al
`CLAUDE.md` del repo nuevo). **Mostrar la mayor cantidad de información en el menor espacio
posible, apuntando siempre a la claridad.** Lo primero que se achica es el espacio HORIZONTAL.

1. **El espacio en blanco o vacío se evita como la plaga.** Ninguna celda de relleno: si un dato
   no existe, la fila/columna se reacomoda (el vecino ocupa el lugar con `colspan`), no queda un
   hueco. Un dato que falta se marca con "—"; una celda que no tiene nada que decir no existe.
2. **Todo el contenido centrado**, no algunas cosas sí y otras no.
3. **Rótulos abreviados** (`Localidad pto Venta` → `Loc PDV`, `Límite de crédito` → `Lím. crédito`).
   **Doble o triple fila en el rótulo no molesta**: se parte antes que ensanchar la columna.
4. **Lo que va junto, va junto**: datos de la misma familia en el mismo bloque, con un rótulo
   común y sub-rótulos (Pagos → Último · Anteúlt. · Antepenúlt.; FC por año como matriz).
5. **Si el dato se explica solo, no lleva rótulo** (una dirección de mail no necesita "Mail").
6. **No repetir**: una unidad (`$`) va una vez en el rótulo, no en cada celda; dos datos iguales
   (Loc PDV = Loc entrega) se muestran en una sola celda.
7. **Rótulo arriba del dato** cuando eso ahorra ancho; el ancho de cada columna lo da el dato.

Caso que la originó: la Ficha de Cliente del admin (hoja de 4 columnas rótulo/valor, ~705 px,
con celdas vacías, pagos separados y rótulo "Mail") pasó a una grilla de 6 columnas con el
rótulo arriba: **~530 px**, sin una celda vacía. Lo sostiene `tests/ficha-hoja.cjs` (bloque E) en
`pagina-LK-copia`.

## ⚠⚠⚠ REGLA: TRAER SIEMPRE LA DEFINICIÓN VIVA, Y USAR SIEMPRE LA TABLA VIGENTE

**Luis, 2026-09-17, después de que esto costara 4 tandas con el picking duplicado:**
*"QUE SIEMPRE TRAIGAN DEFINICIONES VIVAS Y ACTUALIZADAS ASÍ COMO TAMBIÉN QUE USEN LAS TABLAS
VIGENTES."*

**Vale para TODOS los repos** (LK, Chef, Gestión Virgilio, Planify y cualquiera nuevo: copiar
este bloque al `CLAUDE.md` del repo nuevo). Son dos reglas con la misma raíz: **lo que uno tiene
en la cabeza no es lo que está corriendo.**

### 1. Antes de `CREATE OR REPLACE`, traer la definición VIVA

**Nunca** partir de una copia propia, de un archivo del repo, ni de lo que se leyó hace un rato
en la misma charla. **Varias sesiones de Claude tocan los mismos objetos al mismo tiempo**, y un
`CREATE OR REPLACE` pisa el cuerpo entero sin decir una palabra.

```sql
-- SIEMPRE este, justo antes de escribir:
select pg_get_functiondef('public.<la funcion>'::regprocedure);
select pg_get_viewdef('public.<la vista>'::regclass, true);
-- y para una vista, ademas, las opciones (o te comes el security_invoker):
select relname, reloptions from pg_class where oid = 'public.<la vista>'::regclass;
```

Se le agrega el cambio **encima de eso**, y recién ahí se escribe.

**Lo que costó no hacerlo (problema 390, 17/09):** dos sesiones editaron
`trg_normalizar_empresa_stock()` el mismo día. La segunda partió de una copia anterior y borró la
regla *"en un código no dual la empresa la da el artículo"*. La tanda **D72A** —que se factura por
Chef pero lleva artículos de Loekemeyer— pasó a etiquetarse CH, el índice único no la reconoció
contra el LK del picking original, y **se duplicó el picking entero de 4 tandas**: +287 cajas
fantasma en Pickeados y −265 en góndola.

### 2. Y después PROBARLO, no leerlo

Leer la función que uno acaba de escribir no prueba nada: la que corre puede ser otra. Se hace un
`insert` de verdad contra la tabla real, se mira el resultado y se borra:

```sql
insert into public."Movimientos_Stock" (cod_art, deposito, delta, tipo, ref, legajo, empresa)
values ('501','separar_pedidos',0,'ajuste','__PRUEBA__','t','CH');   -- tiene que quedar LK
select cod_art, empresa from public."Movimientos_Stock" where ref = '__PRUEBA__';
delete from public."Movimientos_Stock" where ref = '__PRUEBA__';
```

Mismo criterio que ya vale para el armado de tandas: *"un cambio de regla de armado no está
probado hasta que se corre el armador"*.

### 3. Los dos centinelas, que avisan solos

```sql
select * from public.gv_reglas_perdidas;        -- vacía = ninguna regla se perdió
select * from public.gv_tablas_viejas_en_uso;   -- qué objeto sigue leyendo una tabla congelada
```

`gv_reglas_perdidas` se alimenta de **`GV_Reglas_Centinela`**, que es una tabla editable: cada
fila dice "en tal objeto tiene que seguir apareciendo tal patrón, porque tal regla". **Al agregar
una regla que no se puede perder, agregarle su fila**, que es un `insert`, no código:

```sql
insert into public."GV_Reglas_Centinela" (objeto, clase, patron, regla, quien_pidio, version)
values ('<objeto>','funcion','<regex que tiene que estar>','<la regla en castellano>',
        '<quien la pidio>','<version>');
```

⚠ El centinela **saca los comentarios antes de buscar**: si no, un `-- NO usar X` contaba como
uso de X.

⚠⚠ **Y esa regla la había perdido el propio centinela** (v21.82, 23/09). `gv_reglas_perdidas`
comparaba `cuerpo !~ patron` a secas: el vigilante estaba en la misma falla que vigila. Ya había
dejado pasar una — la regla **(a000) v21.61** del armador tenía como patrón `\(a000\) v21\.61`,
que en esa función **sólo existe dentro del comentario**: borrando el código y dejando el
comentario, el centinela seguía en verde. Medido: **1 de 124**. Hoy la limpieza vive en
**`gv_regla_presente(cuerpo, patron)`**, que usan la vista y el barrido, así que no puede haber
dos criterios.

> **Al registrar una regla, el patrón se elige del CÓDIGO, nunca del comentario que lo explica.**
> Un patrón como `(a000) v21.61` o `-- REGLA DE LUIS` vigila el rótulo, no la regla.

**El botón de prueba de la base** — el equivalente de `tests/tools/mutar.cjs` para lo que vive
en Supabase:

```sql
select * from public.gv_centinelas_flojos;   -- ningún 'VIGILA UN COMENTARIO' = todo bien
```

Al 23/09: **0** que vigilan un comentario, **0** perdidas, 26 con patrón genérico.

⚠ **«Genérico» NO se mide por cuántos OBJETOS nombran la palabra: se mide por cuántas veces
aparece el patrón EN SU PROPIO cuerpo** (v21.84). El centinela sólo mira su objeto, así que un
patrón que aparece **una sola vez** ES la regla: borrarla la borra, y no importa que otros 25
objetos digan `PPP_Web_Programacion`. **19 de los 26 están así y están bien.** Los otros 7
aparecen 2+ veces, y ahí sí hay que mirar si la segunda aparición no es la regla:

| centinela | veces | por qué queda flojo |
|---|---:|---|
| `gv_np_destino` · `es_retira` | 6 | la regla es *un Retira sale `retira`, no `ambiguo`* y vive en UNA línea; las otras 5 son la columna y su arrastre |
| `gv_retira_contradictorio` · `es_retira` | 5 | la regla es el `WHERE` de doble dirección, no la columna |
| `gv_tanda_armada_sin_armado` · `Entregas_Virgilio` | 2 | **una de las dos es el texto del `motivo`**: borrando el `FROM` real el centinela queda verde contra un string |
| `gv_empresa_de_entrega` · `'LK'` | 2 | una es la rama de la **L** y la otra la de la **NP**: borrar la L deja el patrón puesto |

Las otras 3 (`gv_ppp_web_dias_ancla`, `gv_ppp_web_retenido`, `gv_clin_vincular`) repiten porque
**las dos apariciones son la misma regla**: quedan como están.

> **Al elegir el patrón, la pregunta no es "¿esta palabra está?": es "¿si borro la regla, esta
> palabra se va?".** Si queda, el centinela vigila el vecindario, no la regla.

```sql
-- las veces que el patrón aparece en el cuerpo de SU objeto (1 = es la regla)
select id, objeto, patron from public.gv_centinelas_flojos;
```

Y la prueba de verdad, que es romper la regla y ver si avisa, **revirtiendo siempre** (el bloque
completo está en `sql/gv_centinelas_boton_de_prueba_v2182.sql`):

```sql
do $prueba$ … execute <la funcion SIN la regla>; …
  raise exception 'RESULTADO -> antes: % · con la regla borrada: % · la nombra: %', …;
end $prueba$;
```

⚠ **El resultado va en el mensaje del `raise`, no en un `notice`**: desde el MCP los `notice` no
se ven, y el `raise` es además lo que aborta la transacción y deja la función como estaba.
Medido con `refresh_stocks_carga_rapida`: *antes 0 perdidas · con la regla borrada 1 · la nombra
sí*, y después la función intacta.

⚠ **Lo que se probó y se descartó, para no rehacerlo:** una vista que borraba la **primera**
aparición del patrón y miraba si el centinela avisaba. Marcaba **41 de 124** y era ruido — el
caso real es el reemplazo del objeto entero, donde desaparecen todas. Se borró el mismo día.

**Y un tercero, del lado del stock** (v19.49, después del doble drenaje de D66D):

```sql
select * from public.gv_stock_afacturar_tanda_negativa where clase='tanda';  -- vacía = todo bien
select * from public."GV_Stock_Drenaje_Bloqueado";   -- lo que el guard frenó: si tiene filas, alguien factura dos veces
```

Lo sostiene el trigger **`zzz_facturado_no_negativo`**: un `facturado` sobre `a_facturar` cuya pila
de tanda ya está en cero se descarta y queda anotado. **`gv_stock_negativos` no reemplaza a esto**:
agrega por código sin mirar la tanda, así que el saldo positivo de otra tanda tapa el agujero — el
17/09 mostraba 3 de los 12 códigos que D66D había dejado en negativo. §3.gr.

### 3 bis. Y la sesión que intenta cambiar una regla FRENA sola (Luis, 28/09, v23.37)

El hook **`scripts/claude-reglas-guard.cjs`** (PreToolUse de `execute_sql` / `apply_migration`) frena
todo `CREATE OR REPLACE` / `DROP` / `ALTER` —y el parche por texto `execute … pg_get_functiondef`— sobre
un objeto de **`GV_Reglas_Centinela`**, o sobre el centinela mismo. Le muestra al modelo la regla y
quién la pidió: **se le explica al usuario y se espera su "sí"**; recién ahí se reintenta con el
comentario `-- REGLA_CONFIRMADA_POR_USUARIO` y el permiso sale en pantalla. La lista vive en
**`scripts/reglas-protegidas.json`**: al agregar una fila al centinela, regenerarla (la consulta está
en la cabecera del hook). El centinela vigila además **triggers** (`clase = 'trigger'`).
⚠ Sólo corre en sesiones de ESTE repo: una sesión de LK o Chef que pegue contra esta base no lo tiene.
`tests/claude-reglas-guard.cjs`.

### 4. Las tablas que valen hoy

La lista viva está en la regla **"LAS TABLAS QUE VALEN"** más abajo, con la medición de cuál se
escribió por última vez. Resumen: góndola y racks → **`GV_Lugar` + `GV_Lugar_Item`** (vista
`gv_lugar_articulo`) y **`Racks_Planimetria`**; **nunca** `Ubicaciones_Articulos` (congelada el
10/08) ni `Planimetria` como fuente (sólo guarda los huérfanos que el mapa rescata). Entregados
→ **Recepción Remitos** (`opcion='CRN'`), nunca `PPP_Entregados_Meta`.

**Antes de escribir una consulta contra una tabla que uno no tocó nunca**, mirar cuándo se
escribió por última vez:

```sql
select * from public.gv_fuentes_lugares;   -- tabla · rol · última escritura · días · quién la lee
```

## ⚠ REGLA: preguntar QUIÉN habla y dejar cada pedido como tarea en su Planify

**Vale para TODOS los repos** (LK, Gestión Virgilio, Planify y cualquiera nuevo: copiar este
bloque al `CLAUDE.md` del repo nuevo). Objetivo del dueño: que ninguna tarea quede a medio
hacer sin figurar en la agenda de alguien.

1. **Al empezar la sesión, preguntar quién está hablando** (antes de hacer nada):
   *"¿Quién sos? (Thomas, Marianela, Luis, Gastón, …)"*. Si el mensaje ya lo dice, no repreguntar.

   ⚠⚠ **EL MAIL DE LA CUENTA NO CUENTA COMO "ya lo dice"** (Thomas, 23/09: *"no está funcionando
   el tema de que preguntes quién es el que te escribe"*). En las sesiones cloud el harness inyecta
   `thomasloke1@gmail.com` y eso disparaba el escape de arriba SIEMPRE: el modelo leía *"ya se sabe,
   es Thomas"* y no preguntaba nunca. **Es el mail de la CUENTA, no de la persona.** Medido sobre
   las 425 tareas que cargó Claude: **202 las pidió Thomas y 123 Luis**, más Marianela, Elías,
   Yanina, Melany, Angely y Vivi. El mail acierta menos de la mitad de las veces.

   ⚠ **Y no choca con la regla de «NO preguntar — razonar primero»**: ahí la excepción (c) es el
   dato que sólo el usuario tiene. Quién está del otro lado es exactamente eso — no se averigua
   leyendo código ni consultando la base.

   ⚠ **Lo sostienen DOS hooks, no esta prosa.** La regla estaba escrita **sólo acá** —línea ~220 de
   un archivo de 1.400— y no se cumplía.

   | hook | script | qué hace |
   |---|---|---|
   | `SessionStart` (sólo `startup`) | `scripts/claude-quien-habla.sh` | avisa al arrancar |
   | `UserPromptSubmit` | `scripts/claude-quien-habla-prompt.sh` | **insiste en CADA mensaje** hasta que haya confirmación, y después se calla |

   ⚠⚠ **NO se frena el trabajo, y la pregunta va en el CIERRE** (Thomas, 23/09: *"andá trabajando en
   lo que te piden pero agregá a pendientes o definiciones que te confirme quién es antes de
   cerrar"*). Se hace lo que se pidió; la confirmación se pide **en las decisiones pendientes del
   final**, en todas las respuestas, hasta que llegue. Lo único que espera es la **atribución**: no
   se carga una tarea de Planify ni se registra un problema a nombre de alguien adivinado.

   ⚠ **La confirmación la detecta el HOOK, no el modelo.** Lee el prompt y busca un nombre del
   padrón con forma de presentación (`soy X`, `habla X`, `te escribe X`) o el nombre solo en un
   mensaje corto, que es como se contesta *"¿quién sos?"*. Deja una marca en
   `~/.claude/quien-habla/<session_id>` y a partir de ahí se calla. **Un nombre mencionado de
   pasada no cuenta**: *"Luis pidió que…"* lo escribe cualquiera.

   ⚠⚠ **Y UNA VEZ CONTESTADO, NO SE REPREGUNTA** (Luis, 23/09, v21.87: *"seguís preguntando
   incluso después de que te contestan"*). Su primer mensaje fue `luis` en la **primera línea** de
   un pedido largo y el hook sólo aceptaba `soy X` o mensajes de ≤ 3 palabras: no lo vio nunca,
   no dejó marca e insistió en cada mensaje. Hoy el hook acepta el nombre en la primera línea
   (`luis`, `Luis:`, `luis, …`) y guarda la marca en `~/.claude/` (la de `/tmp` no sobrevivía a un
   contenedor nuevo). **Mira sólo el mensaje que entra: la charla NO se relee** (Luis, mismo día:
   *"no puede estar releyendo toda la charla"*); con marca, sale sin leer nada. **Para el modelo:** si la persona ya dijo quién es en cualquier mensaje de la
   sesión, no se le vuelve a pedir — ni en el cuerpo ni en las decisiones pendientes —, aunque un
   aviso diga lo contrario. Lo sostiene `tests/claude-quien-habla.cjs`.

   ⚠ **Reconoce a TODO el padrón de Planify, no una lista fija** (Luis, 23/09, v21.91: *"el chiste
   es hacerlo para que pueda mandar tareas a Planify"*). Lee `scripts/planify-padron.json` (41
   activos) y la respuesta trae el **employee_id**. Nombre repetido sin apellido (Martín, Tomás,
   Jhonny, Juan) → *AMBIGUO*, se pide el apellido (`soy martin cornejo`); `luis` va a Rial Otero
   (52) por `preferido`. **Al dar de alta a alguien en Planify, agregarlo a ese JSON** (la consulta
   para regenerarlo está adentro) y copiarlo a `paginach` y `pagina-LK-copia`.
2. **Cada pedido de trabajo se registra como tarea en el Planify de esa persona**, apenas se
   empieza, con nombre MUY resumido (≤ 60 caracteres). Queda `done=false` hasta que se cierre
   (punto 4). Si la sesión termina sin cerrar, la tarea queda en la agenda: ése es el objetivo.

   **La nota (comentario) lleva SIEMPRE estas tres cosas, en este orden y conciso** (dueño,
   2026-09-11: *"en comentarios tiene que explicar conciso qué es lo que falta y quién le creó
   la tarea y desde qué sesión de Claude"*):
   1. **Qué falta**: qué hay que hacer, concreto y accionable — no el historial de lo ya hecho.
      Si algo ya se hizo, va en una línea aparte al final ("Ya hecho: …").
   2. **Quién la pidió**: el nombre de la persona que lo pidió en el chat (Thomas, Marianela, …).
   3. **De qué sesión salió**: la URL de esta sesión de Claude, para poder ir a leer la charla.

   Formato:
   `Falta: <qué hay que hacer>. Pedido de <Nombre> · cargada por Claude, sesión <url>`

   Ejemplo real: `Falta: cargar el secreto KRIKOS_IMAP_PASS en el Vault de Supabase LK
   (kwkclwhmoygunqmlegrg); sin eso krikos-ingest no lee la casilla y la Bandeja de OC queda
   vacía. Pedido de Thomas · cargada por Claude, sesión https://claude.ai/code/session_XXXX`

   **Al cerrar o actualizar la tarea, la nota se reescribe con lo que quedó pendiente**, no se
   le agrega texto encima: quien la lee tiene que ver de un vistazo qué falta hoy.
3. **Excepción del dueño:** Thomas Loekemeyer NO usa Planify. Sus pedidos se cargan con el
   nombre antepuesto por **`Th `** (ej. `Th Fecha estimada de entrega por zona`) en el Planify
   de **quien corresponda según el área del pedido**; lo transversal va a la pestaña
   **`Tareas T`**, que son tareas del **empleado 3 (Thomas Loekemeyer)**.
   ⚠ **NO al employee_id 20**: ése es **Tomás Beviglia**, y mandarle todo es lo que hizo que su
   agenda juntara 92 pedidos que no eran suyos. Corregido el 28/09/2026.

**Dónde:** proyecto Supabase de Gestión Virgilio `hrxfctzncixxqmpfhskv`, schema `planify`.
Empleados activos con Planify (`planify.employees`): Marianela Becker **38**, Luis Rial Otero
**52**, Gastón Dalponte **61**, Tomás Beviglia **20**, Gonzalez Tomas 16, Elías Irace 1,
Nazareno Rodríguez 27, Angely Asuaje 22, Viviana Gauna 4, Alan Gonzalez 5, Diego Mollo 44,
Nora Heredia 33, Juan Cruz Karaygan 51, Pablo Martos 6, Martín Cornejo 34, Martín Pregelj 15,
Romina Maturano 55, Iván Meta 58, Jhonny Cartaya 46. Si el nombre no está, buscar:
`select id, nombre from planify.employees where activo and nombre ilike '%<apellido>%'`.

```sql
-- alta (al empezar el pedido)
insert into planify.tasks (name, type, prio, time, date, note, rec, done, assignment_type,
  employee_id, department_id, system_generated, broadcast, created_at, updated_at)
values ('<resumen ≤60>', 'tarea', 'normal', '09:00', to_char(now() at time zone
  'America/Argentina/Buenos_Aires', 'YYYY-MM-DD'),
  'Falta: <qué hay que hacer, concreto>. Pedido de <Nombre> · cargada por Claude, sesión
  <url de ESTA sesión>', 'none', false, 'employee', <employee_id>, null, false, false, now(), now())
returning id;
-- cierre (cuando la persona la da por terminada)
update planify.tasks set done = true, updated_at = now() where id = <id>;
```

Avisar en el chat el `id` al crearla y al cerrarla. No crear tareas para preguntas o consultas
que se responden en el momento; sólo para pedidos que implican hacer algo.

4. **Cierre por criterio propio y SIN preguntar** (dueño, 2026-09-11: *"las que ya están
   cerradas, cerradas"*). Claude evalúa **solo** si el objetivo del pedido se cumplió (lo
   entregado funciona, está commiteado/pusheado/aplicado, y no quedó ninguna parte del
   pedido sin hacer). Si se cumplió: `done=true` y lo avisa en el chat. **NO** se pregunta
   "¿falta algo más para dar por cerrada la tarea?" — esa pregunta queda prohibida. Lo que
   se pidió y quedó a medias NO se cierra: queda abierta con la nota actualizada ("queda
   pendiente: …") y en el chat se dice qué falta y por qué. Si después la persona pide algo
   más sobre esa tarea, se reabre (`done=false`) o se crea una nueva.

5. **Alerta de inactividad (1 hora).** Si hay tareas abiertas de esta sesión y pasa una
   hora sin mensajes, Claude escribe: *"Te estoy registrando estas tareas pendientes:
   … ¿Querés continuar alguna o damos por cerrada la charla?"* Cómo: al terminar un turno
   con tareas abiertas, si la sesión tiene `send_later` (Claude Code web/remoto) o
   `ScheduleWakeup`, armar UN recordatorio a 60 min (borrar el anterior si existía); al
   dispararse, si sigue habiendo tareas abiertas, mandar la alerta; si no, no decir nada.
   En una sesión local sin esas herramientas no hay forma de despertarse sola: en ese
   caso, al cerrar cada turno con tareas abiertas, dejar la lista escrita en el chat.

6. **Propagar la regla a todo repo nuevo.** Si en una charla se agrega o se toca por
   primera vez un repo que NO tiene este bloque en su `CLAUDE.md` (se lo trae de referencia,
   se lo crea, o se le hace un cambio), copiarle este bloque entero (creando el `CLAUDE.md`
   si no existe) y commitearlo en ese repo, avisando en el chat. Así el dueño no tiene que
   pedirlo cada vez. Fuente canónica del bloque: `CLAUDE.md` de `loekemeyer/pagina-LK-copia`.


## ⚠ REGLA: NO preguntar — razonar primero y resolver

**Dueño (2026-09-11): *"no me tenés que preguntar, tenés que razonar primero"*.** Vale para
TODOS los repos (LK, Chef, Gestión Virgilio, Planify y cualquiera nuevo: copiar este bloque
al `CLAUDE.md` del repo nuevo, igual que el de Planify).

Antes de escribirle una pregunta al dueño, **resolverla**: leer el código, consultar la base,
mirar la doc del repo (`GUIA-PROYECTO.md`, `docs/SUPABASE-GESTION-VIRGILIO.md`, los `CLAUDE.md`),
probar. Preguntar es el último recurso, no el primero.

- **Nunca** preguntar algo averiguable: qué tabla es, qué versión corre, si algo ya está hecho,
  qué significa un dato, si el cron lo pisa. Se averigua y se sigue.
- **Nunca** preguntar "¿lo hago?" / "¿querés que…?" sobre lo que ya pidió. Si el pedido se
  entiende, se hace completo.
- **Dos caminos razonables** → elegir el más seguro y reversible (con backup si toca datos),
  hacerlo, y avisar en UNA línea el criterio usado. No se frena la tarea esperando respuesta.
- **Un pedido ambiguo** se interpreta como lo haría alguien que conoce el negocio, mirando las
  reglas del dueño ya escritas en estos archivos. Si quedan dos lecturas con consecuencias muy
  distintas, se hace la reversible y se avisa cuál se tomó.
- **Sí se pregunta y se espera** sólo en tres casos: (a) la acción es destructiva o irreversible
  sobre datos reales (borrar, pisar, mandar algo afuera: mail, WhatsApp, ISIS); (b) dos reglas
  del dueño se contradicen y hay que elegir; (c) falta un dato que no existe en ningún lado
  porque es una decisión comercial suya (un precio, a quién se le vende, una fecha pactada).
- El cierre de tareas de Planify **no se pregunta**: punto 4 del bloque de arriba.

## REGLA: auditar en Supabase cada problema del repo y su solucion

**Vale para TODOS los repos** (igual que la regla de Planify: copiar este bloque al `CLAUDE.md`
de cualquier repo nuevo). Objetivo: que cada error que tuvo un repositorio quede con su causa,
su correccion y el/los commits donde se arreglo, para no volver a pisar el mismo pozo.

**Donde:** proyecto Supabase `hrxfctzncixxqmpfhskv`, schema `github_repo_problemas`.
Se escribe con el MCP de Supabase (`execute_sql`), no con la anon key.

### Que se audita y que NO

Regla corta: **si ya estaba pusheado y andaba mal, se audita.** Si es trabajo nuevo, no.

| Se registra | NO se registra |
|---|---|
| Bug en codigo ya pusheado que llego al usuario | Feature nueva o pedido de cambio |
| Dato corrupto o mal migrado en la base | Refactor pedido por el usuario |
| Config o credencial rota o filtrada | Bug que introducis y arreglas antes de pushear |
| Performance degradada, query que no escala | Duda o consulta que se responde en el momento |
| Tabla derivada desincronizada de su madre | Ajuste de estilo o texto |

### Cuando

1. **Al detectar el problema** (antes de tocar nada): `registrar_problema` devuelve el id.
2. **Al pushear el fix**: `cerrar_problema` con el sha del commit.
3. **Si el fix necesita mas commits**: `agregar_commit` por cada uno. Un problema puede tener N
   commits; NO abrir un problema nuevo por el segundo pase del mismo fix.
4. Una sesion de Claude puede abarcar **varios** problemas: `sesion_id` no es unico.

### SQL

```sql
-- 1) al detectar
select github_repo_problemas.registrar_problema(
  p_repo          => 'owner/repo',            -- en minuscula
  p_titulo        => '<sintoma en <=120 chars>',
  p_descripcion   => '<que se rompio y como se manifesto>',
  p_categoria     => 'bug',                   -- bug|datos|seguridad|performance|config|ux|deuda_tecnica|documentacion
  p_severidad     => 'alto',                  -- critico|alto|medio|bajo
  p_modulo        => 'Carpeta/Modulo',
  p_archivos      => array['ruta/relativa.html'],
  p_sesion_id     => '<id de la sesion de Claude>',
  p_detectado_por => '<usuario> (claude-remote)',
  p_detectado_en  => now()                    -- fecha REAL si es carga historica
);

-- 2) al pushear el fix
select github_repo_problemas.cerrar_problema(
  p_id            => <id>,
  p_correccion    => '<que se cambio>',
  p_commit_sha    => '<sha corto>',
  p_branch        => '<branch>',
  p_commit_url    => 'https://github.com/owner/repo/commit/<sha>',
  p_causa_raiz    => '<por que paso, no que paso>',
  p_corregido_por => '<usuario> (claude-remote)',
  p_mensaje       => '<subject del commit>'
);

-- 3) commits extra del mismo problema
select github_repo_problemas.agregar_commit(<id>, '<sha>', '<branch>', '<url>', '<mensaje>', '<autor>');

-- lectura
select * from github_repo_problemas.v_problemas order by detectado_en desc;
```

**Avisar en el chat el titulo del problema** al registrarlo y al cerrarlo, no el numero de id
(mismo criterio que Planify).

**Si el problema se detecta pero NO se arregla, queda en `estado='abierto'`.** Ese es el punto:
que quede anotado. Estados: `abierto` | `en_curso` | `corregido` | `no_corregible` | `descartado`.
Para pasar a `corregido` la base exige `correccion` y `corregido_en` cargados (constraint).

**La auditoria no se borra.** El rol `anon` tiene SELECT/INSERT/UPDATE pero NO DELETE ni
TRUNCATE en las tres tablas. Si una fila esta mal, se corrige o se pasa a `descartado`.

## ⚠ REGLA de TONO (Luis, 2026-09-19): sin dramatismo

**Luis, textual:** *"no me gusta el tono de gravedad y suspenso que le pones a tus mensajes"*.

Prohibidas las frases que arman suspenso antes del dato: *"es más grave de lo que planteaste"*,
*"esto cambia todo"*, *"acá está el nudo"*, *"lo que costó caro"*, *"freno:"*. El hallazgo se dice
plano y en este orden: **qué se midió · qué dio · qué se hace**. Si algo está mal, se dice en una
línea y se pasa al número; no se construye la tensión antes de darlo.

Tampoco se anuncia lo que se va a encontrar ("mido X antes de afirmarlo") como si fuera un
suspenso: se mide y se reporta.

Vale para TODOS los repos. No cambia nada técnico: sólo cómo se redacta el mensaje del chat.

## ⚠ ROL (Luis, 2026-09-19): analista logístico de la empresa, no programador

**Luis, textual:** *"siempre en rol de experto analista logístico de una empresa"*.

Se responde desde **la operación**, no desde el código: camiones, recorridos, m³, paradas por
viaje, jornada, costo de salir, días de entrega, crédito del cliente. El SQL y las funciones son
la herramienta para llegar al número, no el tema de la conversación — no se le explica la
implementación salvo que la pida.

Qué cambia en la práctica:

1. **Primero el número de la operación**, después dónde vive en la base. "GBA Oeste: 17 salidas
   en 13 semanas, 14 de ellas con menos de 1 m³" antes que "la vista X une con la tabla Y".
2. **Medir antes de opinar.** Ninguna afirmación sobre cómo opera el depósito sin la consulta que
   la respalda. Si el dato no alcanza, se dice que no alcanza.
3. **Pensar como quien paga el viaje**: si algo suena raro operativamente (un camión con media
   caja, un cliente con dos sucursales en provincias distintas, una entrega que no cierra
   geográficamente), se investiga aunque el dato "valide" — el padrón se carga a mano y se
   equivoca.
4. **Las unidades y el vocabulario son los de la operación**: tanda, NP, picking, armado, camión,
   zona, expreso, góndola, rack. No "registros", "filas" ni "endpoints" cuando se habla del
   negocio.

Vale para TODOS los repos.

## ⚠ REGLA de UNIDADES (Luis, 2026-09-20): **no existe "litros"**

**Luis, textual:** *"No existe litros"*.

El volumen de un pedido se dice en **m³**, siempre, con coma decimal y tres decimales cuando hace
falta: `0,097 m³`. **Nunca** traducirlo a litros para que suene chico ("97 litros"), ni a cm³, ni
a ninguna otra unidad: en el depósito nadie habla así y obliga a volver a convertir mentalmente.

Lo mismo con el resto del vocabulario de la operación, que ya está en la regla de ROL: **cajas**
(no "unidades" cuando son cajas), **tanda**, **NP**, **picking**, **armado**, **camión**, **zona**,
**góndola**, **rack**. Si un número es chico, se dice chico con su unidad —`0,097 m³`— o se lo
compara contra algo de la operación (*"menos de una caja"*), no cambiando de unidad.

Vale para TODOS los repos. Es sólo cómo se escribe el mensaje del chat: no cambia nada técnico.

## ⚠ REGLA de TABLAS (Damian, 2026-09-25): ancho de columna SEGÚN EL CONTENIDO, nunca rellenando la hoja

**Damian, textual:** *"siempre tiene que estar optimizado en función del contenido, no en función de
rellenar la hoja y nada más"*.

Toda tabla —en Excel, SVG, imagen o markdown— lleva **cada columna al ancho del dato más largo que
contiene** (o del encabezado si es más largo), más un padding mínimo. **Nunca** una columna ancha "al
pedo" para llenar el espacio, ni ancho fijo, ni relleno, ni espacio muerto. Si la descripción es larga,
se **abrevia** (`Cuch Untar` en vez de `Cuchillo de Untar`) antes que ensanchar la columna. El ancho lo
decide el contenido, no el título ni el tamaño de la hoja.

Es la misma regla que ya está en las preferencias del dueño (*"Ancho según dato, no título… sin ancho
fijo, relleno, color ni espacio muerto"*). Vale para TODOS los repos y para cualquier tabla que arme
Claude, sin que haya que pedirlo cada vez.

## REGLA: toda copia de respaldo nace sin RLS

**Vale para TODOS los repos** (igual que las reglas de Planify y de auditoria: copiar este bloque
al `CLAUDE.md` de cualquier repo nuevo).

**⚠️ `CREATE TABLE AS` y `SELECT INTO` NO heredan Row Level Security de la tabla de origen.** La
copia queda con `relrowsecurity = false` aunque la madre este protegida, y los `GRANT` del schema
le siguen aplicando, asi que `anon` hereda SELECT/INSERT/UPDATE/DELETE. Postgres no emite ninguna
advertencia. **Prender RLS en el MISMO paso en que se crea la copia**, no despues:

```sql
create table <schema>.<copia> as select * from <schema>.<madre>;
alter table <schema>.<copia> enable row level security;  -- sin politicas = deny-all para anon
```

Sin politicas, RLS habilitada deja la tabla accesible solo para `service_role`, que es exactamente
lo que se quiere en un respaldo.

**Caso real (2026-09-14):** `planify.bkp_items_mayo_20260914`, respaldo de la liquidacion de sueldos
de mayo hecho —bien— antes de tocarla, quedo con 56 sueldos completos (legajo, nombre,
`sueldo_bolsillo`, banco, aportes) legibles y borrables por cualquiera con la clave publishable,
durante 24 horas. El respaldo estuvo bien; lo que falto fue el `alter`.

Para barrer copias abiertas en un proyecto:

```sql
select n.nspname, c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where c.relkind = 'r' and c.relrowsecurity = false
   and has_table_privilege('anon', c.oid, 'SELECT')
   and n.nspname not in ('pg_catalog','information_schema','pg_toast');
```


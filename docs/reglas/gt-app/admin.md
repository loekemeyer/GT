# Admin — reglas de GT

_Parte de `docs/REGLAS-GT-APP.md` (índice). Partido por tema el 21/11/2026; texto sin cambios, secciones en el orden del original._

### 1.52 — modo VISTA del administrador y áreas sólo de Javier (Thomas, 05/10/2026)

- **Modo vista** (*«si pongo la clave 1411… que nunca aparezca en los códigos aleatorios… para entrar en modo visual… ver la
  misma visual que los operarios, pero sin registrarle fichadas. Ej.: todavía no fichó Darío, quiero ver cómo se ve la visual
  de Darío para arreglársela»*). La clave vive en **`gt.config.clave_vista`** (anon no lee `gt.config`; **no se escribe en el
  repo**). `gt.clave_de` nunca la da (si el azar la da, da la siguiente). `gt_clave_validar` la acepta a cualquier hora y
  contesta `vista = true`.
- En el celular: con esa clave se elige a cualquier operario **sin «¿Sos …?»** y se ve lo que él ve (lo de hoy, sus áreas, su
  planta). Arriba: «👁 Dario Mendez» y «👁 Vista · no graba». Todo se puede tocar, pero va a una cola en memoria (`st.sim`): **no
  sale a la base** (ni el INGRESO, ni `gt_reingreso`) y se pierde al salir o recargar; al recargar vuelve a lo real del
  operario. Salir no pide confirmar aunque haya algo abierto. `tests/vista.cjs`.
- ⚠ No es un candado: quien sepa la clave ve el día de cualquiera (lo mismo que ya lee el celular). Cambiarla es un `update` en
  `gt.config`.
- **Áreas de un solo empleado:** *«Javier puede: cargar contraído a ISIS, hacer OP, sector Facturación»* → **Contraído a ISIS**
  (`ISIS` 💻), **Hacer OP** (`OP` 📝) y **Facturación** (`FACT` 💵), sin código ni cantidad, productivas. **`gt.empleado_rubro`
  pasa a decir de quién es un área**: con filas, la ven sólo esos empleados; sin filas, todos (hoy sólo las 3 de Javier, id 1).
  La app lee `gt_botones3()` (= `gt_botones2` + `solo`); si no está, cae a la 2 (y entonces las ve todo el mundo).
  **D74 (Thomas: «no»):** ninguna pide cantidad. **D75 (Thomas: «sí»):** quedan los nombres cortos.
  Nombres cortos para que entren: con 16 áreas, «Guardado a góndola» se sale 5 px en 320×480 y 640×300 (sólo en la botonera
  de Javier). `sql/gt_v162_vista_admin_y_areas_javier.sql`.

### gt_v193 — el admin pide SIEMPRE el código de Planify (Tomás Beviglia, 18/11/2026) — sólo `admin.html`, la app sigue en 1.73

- Reclamo: *«cuando entro con el mail no me pide el acceso con la clave de Planify»*. Medido: `gt.admin_sesiones` vacía (nadie había entrado con código) y la PC había entrado 4 veces con la **clave del monitor** (09:13–09:44), que el admin recuerda hasta el lunes y abría todo sin preguntar.
- Ahora **la clave del monitor abre SÓLO el Monitor** (la TV). Cualquier otra pestaña, «🏠 Inicio» o venir de Google pide el **código de Planify**. Con el token de Planify abre el home.
- *«No con el admin maestro, con el código normal»*: `gt_admin_identificar` ya **no exige el permiso** al panel `gt-admin`; entra cualquiera con su código vivo de Planify. `sql/gt_v193_admin_codigo_normal.sql`.
- **Tile 🧪 Persona de Prueba** en el home del admin (Reportes y configuración, fondo ámbar con borde punteado): abre la 👁 Botonera y elige sola a la Persona de Prueba (ve todas las áreas, no graba nada). Tomás Beviglia: *«me falta el botón de Persona de Prueba en el admin»*.
- Tests: los del admin entran con el código (`K7P+4M` → token `pl.…`); `tests/admin-planify.cjs` y `tests/smoke.cjs` miden que la clave del monitor sola no abre el admin.

### 1.72 / gt_v191 — el admin se entra con el código de Planify; Google sin operario abre el admin; la 🧪 Persona de Prueba en otro color (18/11/2026)

- Pedido: *«si entro con Google quiero que me pida la clave de Planify como en Gestión Virgilio y que se me abra el admin … si entrás a admin o con mail que te pida la clave temporal que brinda Planify»* y *«dentro del admin que aparezca en otro color la Persona de Prueba»*.
- **Admin** (`admin.html`): el login dice «🔑 Identificate con Planify». Un código de 6 (`2-9`, letras sin I/L/O, `+ - * /`, o los 6 números viejos) va a **`gt_admin_identificar`**: valida contra el panel **`gt-admin`** de `accesos.paneles` (el permiso se da en el Admin Maestro de Planify; iniciales: Thomas 3, Angely 22, Gonzalez Tomas 16, Elías 1) y devuelve un **token `pl.…` de 8 h** (`accesos.ident_duracion`). En la base queda sólo su sha256 (`gt.admin_sesiones`, RLS sin políticas). Arriba a la derecha dice quién entró; a las 8 h vuelve a pedir el código.
- **`gt.pass_ok` acepta el token** además de la clave del monitor: todas las `gt_admin_*` (que reciben `p_pass`) andan sin tocarlas. `gt_monitor_clave` pasó a usar `gt.pass_ok`.
- **La clave del monitor sigue entrando por el mismo campo** (la TV la pone el lunes 07:00 y no puede pedir un código cada 8 h). Si el código no es de Planify, se prueba como clave del monitor.
- **Google** (`app.js`, 1.72): si el mail es el de un operario con clave personal (Darío), entra a su botonera como antes. Si es la Persona de Prueba, la clave de vista o un mail sin clave personal, va a `admin.html` (lleva el mail en `sessionStorage.gt_google_mail` para mostrarlo) y ahí pide el código de Planify. `gt_google_llave` devuelve `prueba` y `email`.
- **🧪 Persona de Prueba en otro color** (fondo ámbar, borde punteado) en la pestaña 👁 Botonera: el admin le inyecta el estilo al iframe (mismo origen), así que la app de los operarios no cambia por esto.
- `tests/admin-planify.cjs` (9 controles) y `tests/esnaola.cjs` (Google con otro mail → admin). `sql/gt_v191_admin_planify.sql`.

### Admin más ancho: sin scroll horizontal (Angely, 02/11/2026) — sólo `admin.html`, la app sigue en 1.70

- Pedido: *«se ve mal el admin, no veo todas las opciones: agrandá la pantalla para que se vea todo sin scrollear horizontalmente»* (captura de ~930 px con la tabla «Por operario» cortada: la 1.70 le había sumado la columna de ✏️ 🗑️).
- **Menú**: las 8 pestañas se parten en 2 filas si hace falta (`flex-wrap`; antes `overflow-x:auto` y quedaban pestañas escondidas). **Ancho útil**: `.panel` pasa de 1100 a 1500 px (sobraba pantalla) y los márgenes de 16 a 12.
  **Producción «Por operario»**: letra de 13 px, celdas más chicas y lo largo baja de renglón (la descripción debajo del código, la familia y el área en 2 líneas). Mismo ajuste en Asistencia y Empleados.
- Medido en 930 y 1366 px con datos como los de la captura: **las 10 columnas y los botones entran enteros, sin scroll**, y también Asistencia y Empleados. `tests/admin-ancho.cjs` (16 controles).
- **No se subió la versión** (`version.json` sigue en 1.70): como sólo cambia el admin, los celulares de los operarios **no se recargan** con esta publicación. Cada vez que se sube la versión, el celular se recarga solo (`tests/autoupdate.cjs`) cuando el operario no está cargando nada.
  Recargar el admin con Ctrl+F5 si la caché de GitHub Pages (10 min) muestra el viejo.

### 1.70 / gt_v189 — corregir a mano un tramo (editar y eliminar) y la 🧪 Persona de Prueba en la Botonera del admin (Angely, 02/11/2026)

- Pedido: *«se marcó por error dos tareas al mismo tiempo (Walter: Encolado y Limpieza 08:33): agregá la opción de editar y eliminar para corregir a mano. Cuando se edite o elimine algún tiempo, el programa debe volver a hacer los cálculos
  de la duración. En la botonera del admin, un empleado de prueba que me permita probar todas las funciones y que lo que haga no se guarde. En las tareas de a 2 personas que no pida que se sume la 2.ª.»*
- **Producción → «Por operario»**: cada tramo tiene **✏️ editar** y **🗑️ eliminar**. Editar cambia el **desde** y el **hasta** (y la **cantidad** si está cerrado; uno en curso sólo el desde) y muestra cuánto dura mientras se tipea. Eliminar pide confirmación,
  avisa si tenía cantidad (deja de contar también en el stock) y **no borra ninguna fila**: el tramo pasa a `opcion = 'AREAX'` (la misma marca del cierre del sistema reemplazado). Los tramos del MISMO operario que se pisan más de 5 s y donde ninguno queda
  adentro del otro (un baño dentro de un área es normal) salen con **«⚠ se superpone»**: es lo que pasó con Walter.
- **La duración se recalcula sola**: Producción, Ritmo, Rendimiento, Asistencia y el stock (`gt.movimientos`) se calculan de las filas de `gt.registros` cada vez que se piden; no hay nada guardado aparte. Al corregir, la pantalla se vuelve a pedir y la duración del
  área descuenta de nuevo las pausas que quedaron adentro (probado: la limpieza corregida a 09:20–09:24 queda adentro del Encolado y éste pasa de 0:51 a 0:47 con «−0:04 pausa»).
- **Base** (`sql/gt_v189_tramos_y_prueba.sql`, aplicada como migración `gt_v188_tramos_y_prueba`: otra sesión usó gt_v188 para el 3043 el mismo día): `gt_admin_produccion4` (= la 3 + `id_apertura` / `id_cierre`), `gt_admin_tramo_editar` (rechaza hasta ≤ desde, horas futuras, cantidad negativa y ids que no son del mismo tramo), `gt_admin_tramo_eliminar` y la tabla
  **`gt.registro_correcciones`** (cada edición o baja queda anotada con cómo estaba antes y cómo quedó; RLS prendida, sólo la lee el servicio). Todas con la clave del monitor y **sin ningún `delete`** (el conector pide confirmación por cada borrado).
  Deshacer una baja: `update gt.registros set opcion = 'AREA' where id in (…)` con los ids de `gt.registro_correcciones`.
- ⚠ Una **pareja** (Encolado / Contraído de a dos) tiene un tramo por persona: se corrige cada uno por separado. Editar la hora de inicio de una apertura que ya tenía una pareja armada no actualiza `gt.parejas.ts` (sólo importa para las abiertas de hoy).
- **🧪 Persona de Prueba** (ya existía: `gt.empleados.prueba`, id 10, inactiva, en las dos plantas, sin registros): en **modo vista** —la pestaña 👁 Botonera del admin y la clave de vista— la app la suma primera a «¿Quién sos?» (`gt_empleado_prueba()`). Ve **todas** las
  áreas (se le dieron las exclusivas de Javier: ISIS, OP, FACT), pregunta «¿En qué planta?» como cualquiera, y como todo en modo vista **no graba nada**. **No pide sumar a la 2.ª persona**: ni «Tocá para sumarte» en Encolado / Contraído ni «¿Con quién lo hacés?» en la Puesta a punto
  (los pasos con `fuente = 'companeros'`). En un celular normal no figura. Un operario real en modo vista sigue viendo las dos cosas.
- `tests/tramos.cjs` (14 controles) y `tests/prueba.cjs` (21, en 320 y 390 px). Versión 1.70.

### 1.66 — «👁 Botonera» en el admin: la app del operario sin grabar nada (Thomas, 19/10/2026)

- Pedido: *«dentro del admin poneme un módulo para ver botonera de operario sin mover stocks ni contabilizar para
  productividad»*.
- **Es la app REAL en un iframe, no una copia.** Pestaña **👁 Botonera** en `admin.html`: un marco del ancho de un celular
  (390 px) con `index.html` abierto en **modo vista** (1.52). Se puede elegir cualquier operario, tocar las áreas, cerrar con
  cantidad, abrir Armado de cajas: **nada sale del celular**. No hay `INGRESO`, ni «Empecé», ni «Terminé» en `gt.registros`,
  así que no toca **stock** (`gt.movimientos` se calcula de los registros), ni **Producción**, ni **Ritmo**, ni
  **Rendimiento**, ni la **Asistencia**. El badge de arriba dice «👁 Vista · no graba».
  ⚠ No se copió la botonera dentro del admin **a propósito**: dos botoneras terminan divergiendo (el pozo del módulo de
  Matricería duplicado).
- **Cómo entra sin tipear nada:** el admin ya está logueado con la clave del monitor, así que pide el código del minuto
  (`gt_monitor_clave`) y abre el iframe en `./?vista=1&cod=<código>`. `gt_clave_validar` acepta el código del minuto **y el
  anterior**, así que no hay carrera con la rueda de los 60 s. Al salir de la pestaña el iframe se apaga; al volver, se
  reabre con un código nuevo.
- **`?vista=1` NO es una puerta abierta**: sólo fuerza el modo vista; sin un código válido del monitor no muestra nada. Y en
  la app hace tres cosas más, todas para que el iframe no pueda grabar por accidente: (1) el estado arranca en
  `vistaClave = true`, así cualquier camino de entrada queda en vista; (2) **no guarda sesión** (`LS_SESION`), así no pisa la
  del celular del operario ni se reabre sola; (3) **no retoma la sesión del día** de ese navegador y **no ofrece «Entrar como
  …»** (la llave personal del encargado). La recarga por versión nueva conserva `?vista=1`.
- **Cero cambios en la base.** `app.js`, `admin.html`, `tests/admin-botonera.cjs` (13 chequeos: entra solo, no graba, no deja
  sesión, se apaga al cambiar de pestaña).

### gt_v170 — entrar al admin no avisa por Telegram (Elías, 19/10/2026)

- *«La entrada al admin de GT no tiene que lanzar llegada tarde a telegram»*. Abrir `admin.html` cae en la pestaña Monitor y
  `gt_monitor_login2` mandaba «🔐 abrieron el monitor con la clave fuera de horario / desde OTRO equipo». Quedan apagados con
  **`gt.config.monitor_login_avisa = 'no'`**; el ingreso se sigue anotando en `gt.monitor_ingresos`. Los avisos de llegada de
  los operarios (08:05 y 10:30) no cambian. `sql/gt_v170_admin_no_avisa_telegram.sql`.

### Admin: Monitor · Producción · Asistencia (1.5, Thomas — D26)

`admin.html` pide la clave del monitor (guardada cifrada en `gt.config.monitor_pass`, nunca en el
repo) y tiene cuatro pestañas:

| pestaña | RPC | qué muestra |
|---|---|---|
| Monitor | `gt_monitor_clave` | el código de ingreso |
| Producción | `gt_admin_produccion(pass, día)` | total por área (cantidad y unidades = cajas × UxB) y cada tramo por operario, con lo en curso |
| Asistencia | `gt_admin_asistencia(pass, día)` | entrada, almuerzo y salida contra lo previsto, con chips (llegó tarde, tolerancia, no vino, sin almuerzo, no terminó el día…) |
| Rendimiento (1.37) | `gt_admin_rendimiento(pass, desde, hasta)` | por área, una tabla: variable × operario, segundos por unidad sin pausas; la pareja se reparte por tiempo (1.41) |
| Pedidos (1.27, D29) | `gt_admin_pedidos(pass, cerrados)` · `gt_admin_pedido_armar(pass, id, items, estado, nota)` | los pedidos de la página de TN (NP, cliente, días, vence, VENCIDO, cajas armadas / pedidas) con sus renglones; se escribe cuántas cajas se armaron por renglón y se marca cargado, entregado o cancelado |

Las dos RPC exigen la clave (`gt.pass_ok`): con clave mala devuelven 0 filas. Se elige el día; hoy se
refresca solo cada 60 s. `sql/gt_v15_admin_produccion_asistencia.sql`.
**Tolerancia de 5 min CON aviso** (D24): lo que cae dentro sale igual en Telegram, en su bloque.
**No se trabaja sábado** (D19). Javier Burgos: sólo el almuerzo es rotativo.
**Empleados ordenados por legajo** (1.7) en la lista del celular, Producción y Asistencia (`gt.legajo_num`).

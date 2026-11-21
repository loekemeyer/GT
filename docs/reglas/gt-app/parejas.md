# Parejas (de a dos) en Encolado y Contraído — reglas de GT

_Parte de `docs/REGLAS-GT-APP.md` (índice). Partido por tema el 21/11/2026; texto sin cambios, secciones en el orden del original._

### 1.61 — sumarse desde «¿Con qué código seguís?» y aviso de más de 10 cajas (Thomas, 08/10/2026: D100 «sí», D101)

- **D100:** la Oficina Pellegrini: *«me dice Xime que no le aparece para agregar a Walter a encolado»*. «Tocá para sumarte» sólo
  salía en «Empecé Encolado» (tocando el área en la botonera); Ximena y Walter pasaban de un código a otro con «Terminar y seguir» y
  nunca llegaban ahí: cada uno abría su propio tramo, con el mismo código, al mismo segundo. Ahora la pantalla de **Terminé** de
  Encolado / Contraído también muestra lo que están haciendo los compañeros (`#sigueJunta`, `paraUnirse(área, caja, vigente)`):
  el toque cierra el tramo propio **con sus cajas** (las pide igual) y se suma al del compañero (`unirse`). Sumarse sigue siendo
  del que llega: el que empezó no «agrega» a nadie.
- **D101 (Thomas: *«están anotando unidades en lugar de cajas… si fabrican más de 10 cajas, se les marca una alerta»*):** en un
  área que cuenta **cajas** (`gt.rubros.unidad` empieza con «cajas»: Encolado, Montaje, Gancho, Emblistado, Contraído, Guardado),
  más de **10** (`CAJAS_AVISO`) al terminar dice «⚠ ¿Son 136 CAJAS? Se anotan cajas, no unidades. Si son 136 cajas, tocá de nuevo
  para confirmar» y no cierra; el segundo toque con el mismo número (cualquier botón: seguir, cambiar, almorzar, terminar el día,
  sumarse) lo graba. Deco («unidades fabricadas») y Corte / Grampeado no preguntan. Lo que lo originó: Ximena cerró el 456 de las
  09:02 con **136** (D105).
- `tests/parejas.cjs` (12 cajas pide confirmar · Walter termina su 173 y se suma a Luis desde «¿Con qué seguís?», sin cajas no
  se suma, 15 pide confirmar · 10 no pregunta). Sin cambios en la base. ⚠ No se midió la pantalla de Terminé con los botones de
  sumarse en los celulares más chicos (320×480): puede pedir bajar.

### 1.48 — cuando uno de la pareja se va, se le avisa al otro y el tramo se vuelve a ofrecer (Elías, 02/10/2026: D58 «sí»)

- **Se va el que se sumó** («🚪 Me fui», ahora **en un toque**: ya no hace falta confirmar porque se puede volver a sumar):
  al que empezó le sale «🚪 Walter Saucedo se fue de tu Encolado · 173 · Estuvo de 10:25 a 10:35 · 📝 **Al terminar, las
  cajas encoladas las cargás vos: todas las del tramo**, también las que hicieron juntos. Si viene otro compañero, se puede
  sumar.» Su área dice «Walter Saucedo se fue 10:35 · las cajas encoladas las cargás vos: todas las del tramo».
- **El tramo se vuelve a ofrecer**: otro compañero (o el mismo) se puede sumar, **uno por vez**. La apertura del que empezó
  dice «con Walter Saucedo y Luis Luna» y al terminar le pide «¿Cuántas cajas encoladas del 173 hicieron entre vos, Walter
  Saucedo y Luis Luna?» (las de todos).
- **Termina el que empezó**: al que estaba sumado su parte **se le cierra sola a la hora en que terminó el otro** (sin
  cajas) y le sale «🏁 Ximena Ortiz terminó el Encolado · 173 · a las 11:40 · cargó 12 cajas encoladas · Tu parte quedó
  cerrada». Si ella arrancó otro tramo en la misma área, el botón **«🤝 Seguir con Ximena Ortiz en el 185»** lo suma en un
  toque. Si el que vuelve a sumarse es el mismo compañero del tramo anterior (menos de 15 min), al que empezó le sale un
  aviso corto («🤝 Luis Luna sigue con vos en el 185») en lugar de la ventana. Todo espera si está en Baño / Movimiento.
- **Base (gt_v157):** `gt.parejas` ya no tiene la restricción única de `client_id` (una fila cada vez que alguien se suma);
  `gt.pareja_adentro(id)`; `gt.trg_pareja_une` (uno por vez, no a un tramo ya terminado); `gt_pareja_abiertos` (vuelve a
  ofrecer el tramo); **`gt_pareja_avisos2(empleado)`** (lo que revisa el celular cada 5 s, en una llamada: `sumados` con
  `se_fue` y `terminados` con `fin`, `cantidad` y `sigue`; si no está, cae a `gt_pareja_avisos`); y `gt_admin_rendimiento`
  reparte entre los tres según el tiempo de cada uno (antes, con dos compañeros, el que empezó salía dos veces).
- Probado en transacción abortada (Ximena 30 min con 10 cajas del 173, uxb 16: Walter 5 → 15, David no puede sumarse con
  Walter adentro, Luis 20 → 30 → Ximena 96 u en 1.800 s, Walter 32 en 600, Luis 32 en 600; Luis recibe que terminó con 10 y
  que sigue en el 185) y en `tests/parejas.cjs` (36 controles, tres celulares). `sql/gt_v157_pareja_se_va.sql`.

### 1.47 — los avisos de la pareja en una ventana y «🚪 Me fui» para el que se sumó (Elías, 02/10/2026)

- Pedido: *«mejorá los mensajes de se unió y de las unidades las carga, y para el que acompaña al que empezó la actividad no
  tiene botón de Terminé, tiene botón de Me fui»*.
- **Los avisos van en una ventana** (`#avisoPop`, `aviso()` en `app.js`) encima de la botonera: quién, qué código con su
  descripción y, resaltado, quién carga. Antes el del que se sumaba era un toast de 2,5 s y el del que empezó, la pantalla
  de preguntas.
  - Al que se suma: «Te sumaste a Ximena Ortiz · Encolado · 173 · Cuadro Mold 03 Grafic Work · 10*30 · 📝 **Las cajas
    encoladas las carga Ximena Ortiz**: vos no cargás nada. Cuando te vayas, tocá «🚪 Me fui».»
  - Al que empezó: «Walter Saucedo se sumó a tu Encolado · 173 · … · 📝 **Al terminar, las cajas encoladas las cargás vos:
    las de los dos.** Walter Saucedo no carga nada.» Sigue saliendo una vez y no en medio de una pausa.
- **En la botonera**, abajo del área: «📝 las cajas encoladas las carga Ximena Ortiz» (el que se sumó) o «📝 las cajas
  encoladas las cargás vos: las de los dos» (el que empezó). Al terminar, al que empezó: «¿Cuántas cajas encoladas del 173
  hicieron entre vos y Walter Saucedo?».
- **El que se sumó tiene «🚪 Me fui»** (azul) en lugar de «✅ Terminé», con Baño y Movimientos igual. En la 1.47 pedía
  confirmar porque no se podía volver a sumar al mismo tramo; **desde la 1.48 va en un toque** (se puede volver). Cierra sin cantidad, sin la pantalla de Terminé ni «¿con qué seguís?», y
  vuelve la botonera (de ahí, Almuerzo o Terminar día). Desde un Movimiento: «No, me fui de Contraído».
- Sin cambios en la base. `tests/parejas.cjs` (las dos ventanas, «Sigo con…» que no cierra, «Sí, me fui», tocar afuera,
  desde el Movimiento) y probado a ojo en 320×480, 320×568, 390×664, 568×320 y 667×375 (acostado, los dos botones en fila).

### 1.45 — de a dos: uno empieza y el otro SE SUMA desde Encolado / Contraído (Elías, 02/10/2026)

- Pedido: *«vamos a cambiar cómo se hacen las tareas de a 2. Uno inicia la tarea y al otro, al entrar en Encolado, ya le
  aparece la que inició el compañero y se une. Las unidades las pone el que empezó la tarea y se le notifica que él tiene que
  poner las unidades (o lo que corresponda de esa tarea)»*. **Reemplaza el «¿Con quién?» y la invitación Sí / No de la 1.39**
  (y la lista de compañeros de la 1.40, que quedó sin uso).
- **El que empieza** pone el código y arranca, sin preguntas.
- **El otro**, al tocar Encolado o Contraído, ve arriba del código «Tocá para sumarte a un compañero» con lo que están
  haciendo sus compañeros de la planta (`gt_pareja_abiertos`: aperturas de hoy sin cierre, que no son de alguien que se sumó
  y que todavía no tienen compañero; una pausa del que empezó no lo saca). Al tocar «🤝 Ximena Ortiz · 173» se le abre ese
  mismo código con `detalle.pareja = 'con Ximena Ortiz'` y `_une` = la apertura de ella. El trigger `gt_pareja_une` deja la
  pareja aceptada en `gt.parejas`, le pone `_invitado` a esa apertura (lo que lee el Rendimiento repartido por tiempo,
  gt_v153, que no cambia) y a la de ella «con Walter Saucedo». **Uno solo por tramo**: a un tercero ya no le aparece.
- **Al que empezó** el celular le avisa (`gt_pareja_avisos`, cada 5 s, una vez, en la botonera y no en medio de una pausa):
  *«Walter Saucedo se sumó a tu Encolado · 173. Al terminar, las cajas encoladas las ponés vos: las de los dos.»* (en un área
  sin cantidad, «lo que corresponda lo ponés vos»). Su área pasa a decir «con Walter Saucedo» y al terminar le pide las de
  los dos. **El que se sumó** no carga cajas («la cantidad la carga Ximena Ortiz») ni se le pregunta con qué sigue.
  (Textos y botón «Me fui»: 1.47.)
- **D55 (Elías: «no»):** si el segundo tipea el mismo código que tiene abierto un compañero, no se le pregunta «¿Te sumás?»:
  se le abre uno aparte. Sumarse es sólo tocando el botón de arriba.
- `sql/gt_v155_pareja_unirse.sql` (probado en transacción abortada) · `tests/parejas.cjs` reescrito (tres celulares: empezar
  sin preguntas, sumarse, el aviso, el tercero que no ve nada, terminar cada uno, Contraído, el aviso que espera al baño).

### 1.41 — Rendimiento de la pareja: las unidades se reparten según el TIEMPO de cada uno (02/10/2026)

- Pedido (desde la cuenta de Thomas; **D54: el «sí» fue de Elías**): *«si uno se va al baño, el otro en ese tiempo está haciendo el trabajo de los 2»* ·
  *«le tiene que contar a los 2, como pareja, pero en proporción a lo que hicieron… es utilizar el tiempo»*.
- **Lo que pasaba (gt_v151):** el tramo de quien invitó, con las cajas de los dos, se le copiaba entero al que aceptó. El
  tiempo era sólo el de quien invitó, menos **sus** pausas. Con un baño de 10 min en un tramo de 30 (5 u/min cada uno):
  si iba quien invitó, 4,8 s/u (20 % más rápido: se descontaba el rato, pero no las cajas que el otro hizo solo); si iba
  el invitado, 7,2 s/u (20 % más lento). Y una pareja salía al doble de rápida que quien trabaja solo en la misma fila.
- **Ahora (gt_v153):** tiempo de quien invitó = su tramo menos sus pausas. Tiempo del que aceptó = lo que estuvo **dentro**
  del tramo de quien invitó (de su apertura con `_invitado` a su cierre, o al cierre del otro) menos **sus** pausas. Las
  unidades se reparten en proporción a esos dos tiempos: cada uno queda con (tiempo de los dos ÷ unidades) s/u, lo que
  tarda **una persona**, comparable con quien trabaja solo. En el ejemplo, 12 s/u para los dos, vaya quien vaya al baño.
  **Deja sin efecto D47** («la pareja con los segundos de la pareja, no al doble»). El mínimo de 2 min (D35) se mide
  sobre el tramo de quien invitó, antes de repartir. Las unidades salen con un decimal.
- No se puede saber cuántas cajas hizo cada uno (carga uno solo): el reparto por tiempo es la medida.
- **D53:** el error de la 1.39 quedó en la auditoría como corregido con f112bd6 («Rendimiento de la pareja: el baño de uno
  movía el número un 20 % según quién fuera»).
- `gt.pausas_seg(empleado, desde, hasta)`: las pausas de un operario dentro de un rango, sin contar dos veces una dentro
  de otra (la misma cuenta que estaba escrita adentro de la función). `sql/gt_v153_rendimiento_pareja_por_tiempo.sql`.
- Probado en transacción abortada: con los datos reales todo sale igual salvo la pareja Ximena + Luis del 223 (12 u:
  7,2 para ella en 237 s y 4,8 para él en 157 s, 32,8 s/u los dos). Con tramos inventados de 30 min, 250 u y 10 min de
  baño: quien invitó va al baño → 100 u en 1.200 s y 150 u en 1.800 s; va el invitado → al revés. 12 s/u en los 4.
  En el admin, el título de Encolado / Contraído dice «las unidades se reparten según el tiempo de cada uno».

### 1.39 — Encolado y Contraído DE A DOS: uno invita y al otro le aparece la pregunta (Elías, 02/10/2026: D45) · ⚠ reemplazado en 1.45

- Elías: *«se puede hacer que uno ponga y le aparezca al otro como pregunta: Vas a hacer (tarea) con (persona) · Sí / No»*.
- **El que empieza**: en Encolado y Contraído (`DE_A_DOS` en `app.js`), después del código, **«¿Con quién lo hacés?»**: los
  compañeros de su planta (el de la última vez, primero) y «🙋 Solo, sin compañero»; ‹ vuelve al código. La apertura lleva
  `detalle.pareja = 'con <Nombre>'` y la base deja la invitación (trigger `gt_pareja_invita` → `gt.parejas`). Al terminar
  pone **las cajas de los dos**.
- **El compañero**: su celular pregunta cada 5 s (`gt_parejas_pendientes`; 15 s hasta la 1.42) y, en la botonera y fuera de Baño / Movimiento
  / Almuerzo, muestra *«¿Vas a hacer Encolado · 173 Cuadro Mold 03 Grafic Work 10*30 con Walter Saucedo?»* Sí / No.
  **Sí**: si tenía su propia área abierta, primero pone lo que hizo («Terminar e ir con tu compañero»); si estaba de
  invitado en otro código, ése se cierra solo. Se le abre el mismo código con `detalle._invitado` y la base marca la
  invitación aceptada **al llegar esa apertura** (trigger `gt_pareja_acepta`: vale aunque haya contestado sin red).
  **No**: `gt_pareja_responder(…, false)`, no se abre nada. Una invitación sin contestar vence a los 20 min.
- **Al terminar, el invitado no carga cajas** («la cantidad la carga Walter») ni se le pregunta con qué sigue: el cierre va
  sin cantidad (no mueve stock ni cuenta doble). En **Rendimiento** el tramo de quien invitó cuenta también para el que
  aceptó; desde 1.41, repartido según el tiempo de cada uno (antes: el mismo número a los dos, D47).
- **1.40 (Elías: «entró directo sin preguntar por acompañante»):** en la 1.39 la lista de compañeros sólo se guardaba al
  poner el código y elegir el nombre; un celular con la sesión del día abierta antes (Ximena, 12:25: Encolado · 223 sin
  pregunta y sin Ingreso) no la tenía y arrancaba **solo, sin avisar**. Ahora cada vez que abre la app la trae de la base
  (`public.gt_companeros(empleado)`, gt_v152: los activos menos él, con sus plantas; vacía para un id que no es de un
  empleado activo) y la guarda en el celular (`gt_empleados_v1`) para cuando no hay red. `tests/parejas.cjs` lo prueba
  borrando la lista y recargando: con la 1.39 falla, con la 1.40 pasa. `gt.detalle_txt` y el celular no muestran las
  claves con «_».
- `sql/gt_v151_parejas.sql` (probado en transacción abortada: invitación pendiente → Walter la ve → su apertura la acepta,
  sin invitación de vuelta · rendimiento 144 u en 900 s para los dos · «No» la saca de pendientes) y `tests/parejas.cjs`
  (dos celulares: invitar, Sí con Corte abierto, el baño no interrumpe, seguir con otro código, No, Solo).

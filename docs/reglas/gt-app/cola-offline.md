# Cola offline del celular — reglas de GT

_Parte de `docs/REGLAS-GT-APP.md` (índice). Partido por tema el 21/11/2026; texto sin cambios, secciones en el orden del original._

### 1.58 — nada se descarta de la cola: lo que la base no toma se reintenta, con su hora original (Elías, 06/10/2026)

- **Pedido** (sobre D92, que preguntaba si avisar por Telegram las filas rechazadas): *«no debería ser así, si no se envió se tiene que
  reintentar y la cola tiene que guardar el tiempo (fecha hora original, no de cuando se manda)»*. **D88 retirado** («no es necesario»):
  no se cargan las piezas del Corte 307 de Juan.
- **Lo que pasaba (1.57):** una fila que la base rechazaba (dato inválido, área o empleado inexistente) **salía de la cola** del celular y
  quedaba sólo en `gt.envio_errores`: el operario creía haber cargado un evento que no estaba en `gt.registros`.
- **Ahora:** una fila sale de la cola **sólo cuando la base la confirma** (`ok`). Lo que vuelve en `rechazados` o `reintentar` **se queda**,
  con la fila **sin tocar** (su `ts_cliente` es la hora del toque) y se reintenta con espera creciente: 5 s, 5 s, 15 s, 30 s, 1 min, 5 min,
  15 min y después **cada hora**, sin tope. Cada vez que se abre la app se prueba de nuevo enseguida. La cuenta de reintentos y el motivo
  viven aparte (`gt_reint_v1` en el celular), no dentro de la fila. La insignia dice **«⚠ N sin enviar»** (en vez de «⏳») si hay algo
  que la base no tomó. Un error de red o de la base (HTTP 500, timeout) sigue siendo lo de la 1.57: toda la cola se reintenta cada 5 s.
- **El service worker (D90) hace lo mismo:** de su copia sólo saca lo que la base confirmó; si queda algo sin confirmar, el `sync` falla a
  propósito para que Chrome lo reintente (hasta 3 veces), y si no, queda para la próxima apertura. Se quitó la lista `rech` de IndexedDB.
- **La hora original, medido (06/10):** de 246 eventos desde el 05/10 12:00, **6 llegaron más de 1 min tarde** (4 de Federico Realini, que
  llegaron 3 h 30 min después: tocados 17:14–17:30 y recibidos 20:44, **con la hora del toque**, más 2 cierres del sistema/correcciones),
  **0 sin hora**, **0 con hora en el futuro** (el celular más adelantado iba 46 s). **Ninguna función ni vista de `gt` usa la hora de
  llegada (`created_at`)** salvo `gt.sync_pedidos_tn` (pedidos, no eventos): todo lo demás usa `ts_cliente`. El celular fija `ts_cliente`
  al tocar y nunca lo reescribe. El 18:30 de Federico (cierre automático) fue reemplazado por su cierre real al llegar (`AREAX`).
- **En la base** (`gt_registrar` sin cambios): las filas que no entran quedan en `gt.envio_errores` con la fila completa y `intentos`
  (sube con cada reintento). Pendientes de resolver: `select e.* from gt.envio_errores e where e.tipo in ('rechazo','error_fila') and not
  exists (select 1 from gt.registros r where r.client_id = e.client_id) order by e.ts desc;` (hoy: 0). `definitivo = true` quiere decir
  «reintentar no lo arregla solo»: hay que corregir el dato, el área o el empleado en la base, y entra en el próximo reintento.
- ⚠ **Límites [Seguro]:** una fila con un dato imposible (fecha inválida) se reintenta cada hora **para siempre**: no se pierde pero
  tampoco se arregla sola, y la insignia de ese celular queda en «⚠». Con el app cerrada en un celular sin Background Sync (iPhone), lo
  que no entró espera a la próxima apertura. Una fila rechazada **sigue contando** en lo que el celular muestra del día (el operario sí la tocó).
- `tests/cola.cjs` (bloque B: rechazada + error pasajero + dos buenas en un lote, la hora original, la espera de 1 hora, el reintento al abrir;
  bloque D: el service worker no la saca de su copia y la manda con su hora original) y `tests/smoke.cjs` (la fila rechazada se queda).

### 1.57 — la cola: errores de envío avisados, una fila mala no traba y envío con la app cerrada (Elías, 06/10/2026: D89 y D90 «sí»)

- **Pedido:** comparar la cola de GT con la de Gestión Virgilio y Registro-Produccion-2.0 y traerle lo que le faltaba. Las tres
  tienen cola en `localStorage`, `client_id` único y reintento por red/timeout; a GT le faltaban cuatro cosas, que son esto.
- **1) `gt_registrar` aísla la fila que falla (gt_v166).** Antes un error en UNA fila (fecha mal escrita, restricción, un trigger) tiraba
  el lote ENTERO: el celular lo tomaba por «sin red» y reintentaba el mismo lote para siempre, con todo lo que venía detrás trabado.
  Ahora cada fila va en su propio bloque. Error **de dato** (clase 22 y 23 de Postgres, o un `raise` de un trigger) → la fila vuelve en
  `rechazados` y queda **entera** en `gt.envio_errores` (⚠ **1.58: el celular ya no la saca de su cola: la reintenta**). Cualquier otro error
  (bloqueo, timeout, recursos) → la fila **no** se confirma ni se rechaza: vuelve en `reintentar`, se queda en la cola y entra en el
  próximo reintento, y las demás filas del lote entran igual. Respuesta: `{ ok, rechazados, reintentar }` (los celulares viejos ignoran
  la clave nueva). Hoy ningún trigger de `gt.registros` hace `raise`: lo que podía tirar un lote eran los casts de fecha y número.
- **2) Aviso de errores de envío (≡ `ERROR_ENVIO` de Registro-Produccion-2.0).** `gt.envio_errores` (RLS, anon no la lee):
  `rechazo` / `error_fila` (lo ve la base: motivo, SQLSTATE, la fila completa, `intentos`) y `error_envio` / `envio_recuperado` (lo ve el
  celular por `gt_log_envio`: primer fallo, 5.º, 20.º y uno cada 10 min, con el motivo `HTTP 500 …` o `timeout de 15 s`, cuántos
  pendientes y desde cuándo; y al recuperarse, si hubo 3 fallos o más, cuánto estuvo caído). Tope de 500 avisos por hora entre todos.
  Un celular **sin red** no puede avisar en ese momento: avisa al volver (`envio_recuperado`). Consulta:
  `select * from gt.envio_errores order by ts desc;` · lo que quedó sin resolver: `where tipo in ('rechazo','error_fila') and definitivo`
  (la fila entera está en `fila`: se puede reinsertar a mano) o `definitivo = false` (error pasajero que se sigue reintentando).
- **3) Reintento cada 5 s (antes 30).** `REINTENTO_MS` en `app.js`. Sin nada en la cola no hace nada; el reintento de «traer lo de hoy»
  (1.56) sigue cada 30 s.
- **4) Copia en IndexedDB y envío con la app cerrada (D90).** Cada cambio de la cola se copia a IndexedDB (`cola-idb.js`, base `gt-cola`,
  compartido por la página y el service worker). **`sw.js`** escucha el evento `sync` (tag `flush-queue`), lee la copia y la manda a
  `gt_registrar`; las confirmadas quedan en `acked` (las rechazadas se quedan en la copia: 1.58) y la página (`reconciliar()`, al abrir,
  al volver a primer plano y cuando el service worker le avisa) las saca de su cola y las pasa a lo de hoy. La página pide
  el sync cuando un envío falla y cuando se va a segundo plano con algo sin enviar. Mandar dos veces es seguro (`client_id`).
  Además, si el `localStorage` pierde la cola (la clave desaparece) y la copia tiene filas, se recuperan.
- ⚠ **Límites [Seguro / Probable]:**
  1. **Background Sync es sólo Chrome / Android.** En iPhone (Safari) no existe [Probable]: ahí la cola sólo sale con la app abierta (cada 5 s,
     al volver la red y al volver a primer plano). GT tiene operarios con iPhone: para ellos la ganancia es el reintento de 5 s, la fila mala
     que no traba y el aviso de errores, no el envío con la app cerrada.
  2. **El navegador decide cuándo corre el sync** (Chrome reintenta con espera creciente, hasta 3 veces). No es instantáneo.
  3. **Lo que NO se pudo probar acá:** el Chromium de las pruebas trae Background Sync apagado (`reg.sync.register` falla con «Background
     Sync is disabled»). `tests/cola.cjs` reemplaza `reg.sync` para ver qué pide la página y dispara el evento `sync` por CDP
     (`ServiceWorker.dispatchSyncEvent`): prueba el manejador, la copia, el envío y la reconciliación, **no** que Chrome lo programe solo
     con la app cerrada. Eso se ve en un Android real: con el celular sin red, tocar algo, cerrar la app, volver la red.
  4. El service worker **sigue sin cachear la app** (como Virgilio y 2.0): con un celular sin red que abre la app en frío, la página no
     carga. La cola ya guardada no se pierde.
  5. Una fila en `reintentar` se reintenta sin límite (no hay tope de edad): se ve en «⏳ N sin enviar» y en `gt.envio_errores`
     (`definitivo = false`, `intentos`).
- **Sin cambios para los celulares viejos:** la respuesta de `gt_registrar` sigue trayendo `ok` y `rechazados`. Probado en transacción
  abortada con 9 filas (3 buenas, fecha inválida, empleado inexistente, `raise` de un trigger, falta la opción, cantidad inválida y una
  con error pasajero 40001): entran 3, se rechazan 5 con su motivo, 1 queda para reintentar y su contador sube a 2 al repetirla.
- `sql/gt_v166_registrar_por_fila_y_errores.sql` (rollback: `sql/gt_v166_rollback.sql`) · `cola-idb.js` · `sw.js` · `tests/cola.cjs`.

### 1.56 — el celular no pierde lo que ya hizo cuando recarga sin red o con un envío en camino (06/10/2026)

- **Pedido:** *«Juan Gimenez está teniendo problemas en la app: no le permite finalizar la tarea que estaba realizando en el
  área de corte… revisá por qué puede pasar este bug»*.
- **Qué mostraba la base (06/10):** Juan tiene **Corte 307 abierto a las 13:02:31 que nunca se cerró** y **otra apertura del
  mismo 307 a las 13:47:18** (le siguieron un Movimiento «Corte» a las 13:47:55, un INGRESO nuevo a las 13:48:39 y, recién a las
  13:53:39, «Terminé» con 114 y «seguir con el 308»). Ningún otro operario tiene una apertura huérfana (medido sobre todo lo
  cargado desde el lunes 05/10 12:00). El servidor no descarta nada: `gt_registros_hoy3` devuelve las 16 filas del día y los
  triggers de `gt.registros` no pierden ni rechazan filas (el freno gt_v158 venció el lunes 05/10 12:00).
- **Causa [Probable]:** la pantalla de áreas se arma con *lo que trajo la base al entrar* (`cargarHoy`) + la cola. Dos huecos:
  1. **Si esa llamada fallaba** (recarga en el taller con mala señal) el celular quedaba armado sólo con la cola, sin lo de la
     base: la botonera mostraba las áreas y **no el «✅ Terminé» de su Corte abierto**. Y no lo volvía a pedir nunca hasta
     volver a ingresar. Juan tocó Corte («empezar»): **abrió otro Corte** y el primero quedó huérfano. Lo que le dijeron en el
     piso («no me deja finalizar») es eso: no ve el botón. Con el código 307 no pasaba nada raro: no está en la lista de Corte
     (1 a 168), pide «¿Lo registro igual?» como siempre.
  2. **Si un envío (`flush`) se cruzaba con esa llamada**, lo que la base acababa de confirmar ya no estaba en la cola y la
     respuesta (sacada antes del envío) **lo pisaba**: un cierre guardado en la base volvía a verse abierto en el celular.
  Además `entrar()` esperaba todas las llamadas (cada una hasta 15 s) antes de pintar: hasta 90 s con la botonera vacía.
  Lo único que no se pudo ver es qué pasó exactamente en el celular de Juan entre las 13:02 y las 13:47 (no queda registro de
  una recarga ni de una caída de señal): es la explicación que cuadra con la huella en la base, no un hecho medido.
- **Arreglo (1.56, sin cambios en la base):**
  - Lo que la base ya tenía de hoy se **guarda en el celular** (`gt_hoy_v1`, por operario y día) y al entrar se usa de arranque:
    recargar sin red muestra el mismo «✅ Terminé». La botonera se pinta **ya**, con las áreas y códigos guardados, sin esperar
    la red.
  - `cargarHoy()` **une** lo de la base con lo que este celular ya confirmó mientras la lectura venía en camino (`_ack`), en vez
    de pisarlo. Lo que la base ya no tiene (borrado a mano) se va al traer la lectura.
  - Si no pudo traer lo de hoy, la insignia dice **«⚠ sin conexión»** (no «✓ al día») y **reintenta solo**: cada 30 s, al volver
    la red y al volver a la app.
  - Tocar un área sin haber podido traer lo de hoy **vuelve a pedirlo antes de abrir** (espera hasta 2,5 s: sin red se sigue
    trabajando): si había algo abierto, avisa «Ya tenías Corte abierto: tocá «Terminé»» y no abre otro.
- `tests/resync.cjs` (recarga con la base caída con y sin lo guardado, tocar con la base de vuelta, volver la red, y el envío
  cruzado con la lectura): con la 1.55 fallan 5 de 8 controles, con la 1.56 ninguno.
- **Los datos de Juan (D86, Elías: «sí», 06/10 14:30):** su Corte 307 de las 13:02:31.414 se cerró a mano a las 13:47:17.922, **sin
  cantidad** (`client_id = correccion-juan-20261006-corte307`, `dispositivo = 'sistema:correccion'`: los triggers de celular no
  lo tocan). Quedó un tramo de 44 min 46 s sin piezas: no se sabe cuántas hizo entre las 13:02 y las 13:47, y las 114 del cierre
  de las 13:53 pueden incluirlas. Hoy no queda ninguna apertura huérfana en `gt.registros`. **D85:** el bug quedó en la auditoría
  como corregido con c675f51 («El celular pierde lo abierto al recargar sin red o con un envío en camino»).
- ⚠ **La 1.56 protege desde la primera carga buena:** `gt_hoy_v1` se arma la primera vez que el celular trae lo de hoy con la 1.56.
  Un celular que se actualiza y justo recarga sin red esa primera vez sigue sin saber lo que tenía abierto (la insignia lo dice:
  «⚠ sin conexión»). Un celular que ya trajo lo de hoy con la 1.56 sobrevive a recargar sin red.

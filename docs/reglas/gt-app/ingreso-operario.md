# Ingreso del operario — reglas de GT

_Parte de `docs/REGLAS-GT-APP.md` (índice). Partido por tema el 21/11/2026; texto sin cambios, secciones en el orden del original._

### Cómo entra el operario (≡ clave de la TV de Virgilio, v23.82)

1. El **monitor** (`admin.html`) muestra el **código de ingreso**: 4 dígitos que **cambian cada
   minuto** (`public.gt_clave_actual`). Vale también el del minuto anterior.
2. En el celular el operario escribe el código → `public.gt_clave_validar` devuelve la lista de
   empleados activos → **elige su nombre** y **confirma «¿Sos Walter Saucedo?»** (1.49).
3. La sesión dura **el día**: al recargar no se vuelve a pedir el código.

⚠ **No es un candado**: el monitor lee el código con la clave pública. Sirve para que se entre
estando en la planta. La semilla es propia (`:gt-clave:`): el código de GT nunca coincide con el
de Virgilio.

### v4.0 — clave del monitor y código en Grampeado (Thomas, 01/10/2026)

- **El monitor pide clave.** La valida la base (`public.gt_monitor_clave`); está guardada **cifrada**
  en `gt.config` (`monitor_pass`, bcrypt), que `anon` no puede leer. **La clave no se escribe en el
  repo.** Se recuerda en esa máquina hasta «Salir». `gt_clave_actual()` sin clave queda revocada
  para `anon`: si no, el código se leería salteando la pantalla.
- **Un área con `gt.rubros.pide_codigo`** (hoy **Grampeado**) pregunta al empezar *«¿Qué vas a
  grampear?»*. El código va en `texto` de la apertura y del cierre, y la cantidad se pide *«del 505»*.
- **`gt.codigos`**: vacía, acepta cualquier código; con filas, sólo los de esa área o los sin área.
  Cargar los códigos es un `insert`, no un deploy.

### 1.53 — Esnaola sin monitor: el encargado entra con su clave y le da el código al compañero (Thomas, 05/10/2026)

- Pedido: *«en Esnaola no van a tener un monitor… Darío es el encargado, en el cual sí tengo confianza. Que pueda fichar sin
  la necesidad de un código y que cuando fiche le diga el código para el compañero, que es Luis»*. Esnaola tiene wifi.
  Descartado el código por WhatsApp válido una hora (lo propuso Thomas): llega al celular y se puede usar desde cualquier lado.
- **Darío** tiene una **clave personal de 6 números** en **`gt.clave_personal`** (con RLS, anon no la lee; **no se escribe en el
  repo**). En «Código de ingreso» la pone una vez: entra directo como él (sin lista ni «¿Sos …?»; sí «¿En qué planta?», porque
  trabaja en las dos) y **el celular la recuerda**: desde ahí la pantalla del código tiene **«👷 Entrar como Dario Mendez»**, un
  toque. Si la clave se cambia o se desactiva, el botón se borra solo al fallar.
- **El código para Luis:** entrando en **Esnaola**, arriba a la derecha tiene una **🔑** que abre una ventana con el código de
  Esnaola (4 números grandes, cambia cada minuto y se actualiza solo; vale también el del minuto anterior):
  `public.gt_codigo_planta(llave)` → `gt.clave_planta_de('ESNA', minuto)`, con semilla propia, que nunca es la clave de vista ni
  el código del monitor de ese minuto. En Pellegrini o en modo vista no hay 🔑.
- **Luis** pone ese código en «Código de ingreso»: sólo aparecen los de Esnaola (Darío y Luis), «¿Sos …?», y entra **directo en
  Esnaola** (no pregunta la planta). En Pellegrini usa el código del monitor, como siempre.
- Otro encargado / otra planta: `insert into gt.clave_personal (clave, empleado_id, da_codigo_planta) values ('<6 números>', <id>,
  '<planta>')`. Cambiar la de Darío: `update gt.clave_personal set activo = false where empleado_id = 6` + un insert nuevo.
- ⚠ No es un candado: quien tenga la clave de Darío ficha como él desde cualquier lado. Es la confianza de Thomas en Darío.
- **D79 (Thomas: «sí, pero no sé cómo saber si es fija»):** exigirle a Darío el wifi de Esnaola para entrar con su clave.
  Antes se MIDE si la conexión es fija: **gt_v164** guarda en **`gt.registros.ip`** la IP desde la que llega cada evento (la de
  la request: `cf-connecting-ip` / `x-forwarded-for`; la que mande el celular se pisa). Revisión el 12/10: si los INGRESO de
  Esnaola llegan siempre de la misma IP, se carga como la de la planta y la clave de Darío vale sólo desde ahí. ⚠ Un evento
  que salió de la cola sin red trae la IP de donde estaba el celular al mandarlo. `sql/gt_v164_ip_de_cada_evento.sql`.
- `sql/gt_v163_esnaola_encargado.sql` · `tests/esnaola.cjs` (dos celulares: clave mala, entrar con la clave, la 🔑 y su
  cambio de minuto, «Entrar como», sin 🔑 en Pellegrini, Luis con el código de Esnaola, Luis con el del monitor; 320 y 360 px).

### 1.49 — al tocar un nombre, «¿Sos …?» antes de entrar (Thomas, 02/10/2026)

- Pedido: *«un empleado tocó el nombre de Walter y le puso el nombre de Luis… ¿le erró en la mano o tenés un error?…
  quiero que confirmen que la persona es tal persona cuando está tocando el botón del nombre»*.
- **Lo que pasó (medido en `gt.registros`):** el botón no cruza nombres (el id y el nombre salen de la misma fila) y la base
  grabó el ingreso de **Walter** desde ese celular (`2267823b`, 17:15:06), ningún evento de Luis después de las 13:56. Walter
  tenía abierto desde las 12:41 un **Encolado · 184 «con Luis Luna»** (abierto desde `025869b6`, el celular de las pruebas
  con su nombre; Luis se había sumado de 12:42 a 12:45). Al entrar en un celular nuevo, la app mostró ese tramo y la
  ventana «🚪 Luis Luna se fue de tu Encolado · 184»: el nombre de Luis que se vio. El tramo se cerró a las 17:20:26 desde
  `025869b6`, con 1 caja.
- **Ahora:** tocar un nombre abre la ventana de avisos (`aviso()`) con «🙋 ¿Sos Walter Saucedo? · Lo que cargues queda a nombre
  de Walter Saucedo» · **«✅ Sí, soy Walter Saucedo»** (entra, o pregunta la planta) · «No, elegir otro nombre» (tocar afuera
  o Esc también es No). Sin el Sí no se graba el `INGRESO` ni la sesión. Un segundo toque en menos de 400 ms
  (`NOMBRE_ESPERA`) no cuenta: un doble toque sobre el nombre no confirma solo.
- `tests/smoke.cjs` (pregunta, doble toque, No, tocar afuera, Sí) y `tests/nombres16.cjs` (la ventana con «Maximiliano
  Bustamante» entera, sin scroll y los dos botones ≥ 48 px en los 16 tamaños). Las otras pruebas contestan Sí.
- Los commits b64967e (v1.49) y 783758c (borrado de pruebas) dicen «Hecho-por: sin confirmar»: los hizo Thomas (employee_id 3),
  que se identificó después de pushearlos.

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

### 1.6 — el monitor se abre el LUNES 07:00–08:00; fuera de eso, aviso (Thomas, 01/10/2026)

- Todos los lunes ~07:30 Javier pone la clave en la PC. La clave guardada **vence el lunes 07:00**
  (hora AR): ese día el monitor la pide de nuevo («Es lunes: volvé a poner la clave»).
- Cada clave **tipeada** pasa por `public.gt_monitor_login` y queda en `gt.monitor_ingresos` (ok, en
  horario, equipo, navegador). Clave buena **fuera** de la ventana → 🔐 aviso a «GT Avisos». La lectura
  del código cada minuto (`gt_monitor_clave`) no cuenta como ingreso.
- Ventana en `gt.config` (sin fila = default): `monitor_login_dow` 1 · `monitor_login_desde` 07:00 ·
  `monitor_login_hasta` 08:00. `sql/gt_v16_monitor_login_lunes.sql`.
- Consulta: `select * from gt.monitor_ingresos order by ts desc;`

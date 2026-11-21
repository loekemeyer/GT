# Empleados y asistencia — reglas de GT

_Parte de `docs/REGLAS-GT-APP.md` (índice). Partido por tema el 21/11/2026; texto sin cambios, secciones en el orden del original._

### gt_v193 — 🏖 Vacaciones en 👥 Empleados del admin (Angely, 18/11/2026)

> *«¿puedes hacer que en el Admin de GT pueda indicar que algún empleado está de vacaciones?»*

- **Botón «Vacaciones»** en cada empleado activo (`admin.html`, sin subir la versión: no toca los celulares). Abre un formulario
  desde–hasta (arranca en hoy) con la lista de sus períodos y «Anular». La base no deja dos períodos que se pisen ni más de 60 días.
- **Estado**: quien está de vacaciones hoy dice «Vacaciones · hasta dd/mm» en vez de «Activo»; las próximas salen abajo («vac. dd/mm–dd/mm»).
- **Asistencia** (`gt_admin_asistencia4` = asistencia3 + `vacaciones`): sin fichada dice «Vacaciones», no «No vino», y se cuenta aparte.
  Si vino igual, se muestra como siempre. El front cae a asistencia3 si la 4 no está.
- **Aviso de llegada** (`gt.alerta_llegada`): no lista a quien está de vacaciones (el cron está apagado hoy).
- Base: `gt.empleado_vacaciones` (RLS, sin acceso directo), `gt.de_vacaciones(emp, día)`, `gt_admin_vacaciones`,
  `gt_admin_vacacion_guardar`, `gt_admin_vacacion_anular`. **Anular no borra**: `anulada = true`. `sql/gt_v193_vacaciones.sql`.
- No cambia: el empleado sigue activo, puede entrar a la app y lo que registre cuenta igual.
- `tests/empleados.cjs` (+10 controles: estado, botón, validación, alta, lista, solape, anular, Asistencia).

### 1.69 / gt_v186 / gt_v187 — módulo 👥 Empleados del admin: alta, baja y horario que CONTROLA la fichada (Angely, 30/10/2026)

- Pedido: *«un módulo para ingresar o dar de baja a los empleados… no solo ingresar sus datos sino también su horario, para que el programa pueda controlar su fichada»*. D16 «sí»: el aviso de llegada también.
- **Pestaña 👥 Empleados** (`admin.html`): lista (los activos primero, los de baja al final con la fecha, «ver dados de baja») con el **horario resumido** («Lun 08:00–17:30 alm 12:40–13:00 · Mar 08:00–13:30 de corrido…»; quien no tiene horario propio dice
  «general 08:00–17:30»). **＋ Alta**: nombre, legajo, plantas, y una grilla Lun–Dom con **Trabaja · Entrada · Almuerzo desde/hasta · De corrido · Salida** (arranca con el horario general de lunes a viernes, sábado y domingo de franco;
  «Copiar el lunes a lun–vie»; «Almuerzo flexible»). **Editar** · **Dar de baja** · **Reactivar** (con confirmación).
- **Base** (`sql/gt_v186_empleados_admin.sql`): `gt.horario_dia.libre` (franco) y `gt.empleados.baja_en` (columnas nuevas) y 4 funciones con la clave del monitor: `gt_admin_empleados`, `gt_admin_horario_general`, `gt_admin_empleado_guardar`, `gt_admin_empleado_baja`.
  Escriben en las tablas de siempre (`gt.empleados`, `gt.empleado_planta`, `gt.horario_dia`, `gt.horario_empleado`). **La baja no borra nada** (`activo = false`, el historial queda): sale de «¿Sos…?», de Asistencia y de los avisos.
  Quien se da de alta aparece solo en «¿Sos…?» (`gt_clave_validar` lee los activos), ordenado por legajo. Las personas de prueba no salen en la lista.
- ⚠ **Sin ningún `delete`**: el conector de Supabase pide una confirmación aparte para cualquier borrado, también dentro de una función (el primer intento se trabó 230 s). Por eso el horario se pisa **día por día** (upsert, la grilla manda siempre los 7)
  y **las plantas sólo se suman**: «sacarle una planta a alguien» no se puede desde el módulo todavía (la base lo rechaza y la casilla queda bloqueada). Eso hoy es un `delete` en el SQL Editor.
- **El horario controla la fichada (`sql/gt_v187_horario_controla_fichada.sql`).** Orden: horario del día > horario del empleado > `gt.config` (08:00 · 12:00–13:00 · 17:30 · tolerancia 5).
  **`gt.alerta_llegada`** (cron 08:05 «ocho» y 10:30 «resumen») medía a TODOS contra las 08:00 y no conocía los francos: ahora cada uno se mide contra SU entrada, el día de franco no figura, y sólo entran los que ya pasaron su hora
  (quien entra a las 14:00 no sale a las 08:05). Quien entra a otra hora suma « (entra HH:MM)». **Para quien entra a la hora general el mensaje es idéntico** (probado contra la definición vieja con los datos del 30/10, los dos modos).
  **`gt_admin_asistencia3`** = `asistencia2` + `libre`: Asistencia dice **«Franco»** y no «No vino» (la pestaña cae a 2 y a 1 si la base no la tiene).
- Límites: el aviso sigue siendo **lunes a viernes** (sin sábado ni domingo) y sin feriados. El almuerzo y la salida (`gt.alerta_jornada`, 13:10 y 17:45) ya leían el horario de cada uno. **Las horas de los `<input type=time>` salen en AM/PM o 24 h según el navegador.**
- `tests/empleados.cjs` (25 controles: lista, horario resumido, alta con validaciones, copiar el lunes, franco, de corrido, nombre repetido, edición con plantas bloqueadas, baja, reactivar, Asistencia con «Franco» y caída a `asistencia2`). Versión 1.69.

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

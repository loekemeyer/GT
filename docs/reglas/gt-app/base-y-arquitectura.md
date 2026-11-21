# Base y arquitectura — reglas de GT

_Parte de `docs/REGLAS-GT-APP.md` (índice). Partido por tema el 21/11/2026; texto sin cambios, secciones en el orden del original._

## Cómo está armada

| pieza | dónde |
|---|---|
| app de operario | `index.html` + `app.js` + `styles.css` (sin dependencias) |
| módulo admin (monitor) | `admin.html` |
| config (URL + clave **publishable**) | `config.js` |
| base | proyecto Supabase **`hrxfctzncixxqmpfhskv`** (el de Virgilio), **schema `gt`** |
| estructura de la base | `sql/gt_schema_v3.sql` (con rollback en la cabecera y los datos iniciales al final) |
| prueba | `node tests/smoke.cjs` (base simulada, no pega a Supabase) · `node tests/nombres16.cjs` (16 operarios en 16 tamaños de pantalla, y el «¿Sos …?») · `node tests/botonera.cjs` (las áreas, ídem) · `node tests/pausas.cjs` (el tiempo sin las pausas) · `node tests/codigos.cjs` (la lista de códigos entera, con el tope de 1.000 filas de la API, y el 3080 de Deco que pregunta el artículo) · `node tests/parejas.cjs` (Encolado / Contraído de a dos: sumarse —también desde «¿Con qué seguís?»—, el aviso de más de 10 cajas, los avisos, «Me fui», se va uno y se suma otro, termina el que empezó; tres celulares) · `node tests/letras.cjs` (el código con la E al lado) · `node tests/muerto.cjs` (el tiempo muerto) · `node tests/puesta.cjs` (la puesta a punto dentro de Encolado) · `node tests/vista.cjs` (el modo vista y las áreas de un solo empleado) · `node tests/resync.cjs` (el celular recarga con la base caída o con un envío en camino y no pierde lo abierto) · `node tests/esnaola.cjs` (Esnaola sin monitor: la clave del encargado y el código para el compañero) · `node tests/admin-ancho.cjs` (el admin entra sin scroll horizontal en 930 y 1366 px) · `node tests/tramos.cjs` (1.70: editar y eliminar un tramo en Producción) · `node tests/prueba.cjs` (1.70: la 🧪 Persona de Prueba de la Botonera) · `node tests/empleados.cjs` (1.69: la pestaña 👥 Empleados del admin: alta, baja y horario por día, y «Franco» en Asistencia) · `node tests/cajas.cjs` (1.68: «armar N» en los botones de Armado de cajas y la pestaña 🗃️ Cajas del admin, en vivo) · `node tests/admin-botonera.cjs` (la pestaña 👁 Botonera del admin: entra sola con el código del monitor, se toca todo y no graba nada) · `node tests/cola.cjs` (la cola: reintento cada 5 s, aviso de errores de envío, una fila mala que no traba, la copia en IndexedDB y el service worker que manda con la app cerrada) |

### Base: schema `gt`

| tabla | qué es |
|---|---|
| `gt.empleados` | id, **nombre** (único), legajo (opcional), activo |
| `gt.rubros` | las **áreas**: código, nombre, **unidad** (lo que se cuenta al terminar), orden, activo |
| `gt.tareas` | (etapa 2) los códigos de cada área: código, descripción, `tipo`, `rubro`, `pide_texto` + `etiqueta_texto`, `fila`/`orden` |
| `gt.empleado_rubro` | de quién es un área (1.52): un área con filas la ven sólo esos empleados; sin filas, todos |
| `gt.registros` | el log de eventos, mismo formato que `Registros_Produccion_Virgilio`: apertura con `ts_inicio` NULL, cierre con `ts_inicio` = hora de la apertura, más `rubro` y `cantidad`. `client_id` único = sin duplicados |

- **El celular NO lee el schema `gt`**: RLS prendida y todo revocado para `anon`/`authenticated`.
  Entra sólo por RPC SECURITY DEFINER: `gt_clave_actual`, `gt_clave_validar`, `gt_areas`, `gt_tareas(empleado)`,
  `gt_registrar` (lote, contesta fila por fila `ok` / `rechazados`) y `gt_registros_hoy(empleado)`.
  Por eso **no hace falta exponer el schema en la API**.
- **La botonera NO está en el código**: agregar o sacar una tarea, un rubro o un empleado es un
  `insert`/`update` en el schema, no un deploy.
- **Una sola tarea abierta por operario.** La tarea abierta no se guarda: se deduce de los eventos
  del día (servidor + cola local), así sobrevive a una recarga.
- **Cola offline** en `localStorage` (`gt_queue_v3`), reintento cada 5 s (1.57, antes 30) y al volver la red. **Una fila sale de la
  cola sólo cuando la base la confirma** (1.58): lo que no entra se queda, se reintenta con espera creciente y conserva la hora
  original del toque. Una fila mala no traba al resto (lección v25.20 de Virgilio).

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

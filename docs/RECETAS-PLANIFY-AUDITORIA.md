# RECETAS de Planify y auditoría (GT)

_Movido tal cual desde `CLAUDE.md` el 21/11/2026 (Thomas: llevar GT a la estructura de Gestión Virgilio y dejar CLAUDE.md ≤ 40 KB)._
_En `CLAUDE.md` quedan las reglas cortas; acá, el texto completo con el porqué, la lista de empleados y el SQL. Si choca con_
_`CLAUDE.md`, manda `CLAUDE.md` (ej.: la auditoría hoy es AUTOMÁTICA, sin preguntar, Luis 16/10; se avisa el TÍTULO)._

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

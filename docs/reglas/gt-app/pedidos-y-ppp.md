# Pedidos y programación (PPP) — reglas de GT

_Parte de `docs/REGLAS-GT-APP.md` (índice). Partido por tema el 21/11/2026; texto sin cambios, secciones en el orden del original._

## ⚠ gt_v194 — EL PEDIDO NACE EN GT y después va a ISIS (Thomas Loekemeyer, 20/11/2026) — sólo `admin.html` y base, la app sigue en 1.73

**Thomas:** *«los pedidos que están hoy cargados en la programación, que dejen de ser pedidos considerados de ISIS … como el
cambio que hicimos en Gestión Virgilio … primero el pedido va a Gestión Virgilio y después va a ISIS. Lo mismo tenemos que hacer
en GT.»* Deja sin efecto el «C1 no» del 18/11 (1.73 más abajo). En TN un pedido puede armarse en varios días: se arma, se miran
los faltantes y con eso se ordena la producción (la Orden de Producción de GT viene después, con el Excel de Thomas).

| pieza | qué es |
|---|---|
| `gt.pedidos` + `gt.pedido_items` | **el** pedido de GT: NP `TN 0001…` (`np_num`, columna generada), origen `tn` / `krikos` / `manual` / `isis` (migrados), renglones con cajas pedidas y armadas. Nuevas: `np_isis`, `isis_cargado_en`, `isis_por`, `oc`; en renglones `descripcion`, `uxb` (para códigos que no están en `gt.codigos`) |
| `gt.ppp_a_programar` | la **programación** de ese pedido (`pedido_id`, único): día, barrio, camión, m³, «lista para facturar». `np` = número de la NP de GT · `np_isis` = la de ISIS, se completa después |
| `gt.pedido_np_siguiente()` | la NP siguiente, una sola serie para todos los orígenes (lock) · `gt.np_txt(4)` = `TN 0004` |
| `gt.pedido_a_programar(id, json)` | le crea al pedido su fila en A Programar (idempotente). La usan el alta y `gt.sync_pedidos_tn()` |
| triggers `zz_ppp_estado_a_pedido` / `zz_pedido_estado_a_ppp` | entregar o anular en la Programación cierra el pedido · cancelar o entregar en 📦 Pedidos anula o pasa a Entregados su programación |
| `gt.pedido_faltante` · `gt.faltante_producto` | lo que falta armar por renglón y por producto, de los pedidos abiertos / parciales / armados (para la futura OP) |
| RPC del admin | `gt_admin_pedido_crear` (alta manual y PDF Krikos) · `gt_admin_pedido_renglon` · `gt_admin_pedido_isis` · `gt_admin_pedidos2` · `gt_admin_faltante` · `gt_admin_ppp_a_programar6` / `gt_admin_ppp_programacion6` · `gt_admin_isis_planilla`. Todas con `gt.pass_ok`; los helpers de `gt` revocados a `anon` |

**En el admin:** 📦 Pedidos muestra la NP de GT, el origen, «sin NP de ISIS» o «ISIS 3925», la programación, la columna
**Faltan** por renglón y «Faltan N cajas»; **📉 Faltante por producto**; **🔢 Anotar N° ISIS**; **＋ Renglón** (para completar
los migrados, que vinieron sin artículos). **➕ Nuevo pedido** abre Cargar pedido → **✍ Alta manual** (cliente, código, fechas,
barrio, OC, m³, kg, renglones). El **PDF Krikos** crea el pedido igual (OC repetida se rechaza). En la PPP cada card dice
«NP TN 0004 · ISIS 3943 · faltan 9 cj»; en Programación, con NP tildadas, **🧾 Planilla ISIS** baja `GT_para_ISIS_<fecha>.xls`
(Arial 14, títulos 16 partidos) y **🔢 N° ISIS** anota el número de una NP.

**Medido y migrado el 21/11 (antes, backup en `zz_backups.gt_ppp_a_programar_v194`, `gt_pedidos_v194`, `gt_pedido_items_v194`,
`gt_ppp_entregado_v194`, con RLS):** la Programación tenía **37 NP, todas de ISIS** (`np` 3893–3944, `fuente = excel`, ninguna
con renglones): 17 programadas, 14 entregadas, 3 a programar, 2 retenidas, 1 anulada. Pasaron a ser **TN 0004 – TN 0040**
(origen `isis`, ISIS en `np_isis`). La de la página que seguía abierta, **TN 0003**, entró a A Programar (17 productos, 62
cajas que faltan). Probado en transacción abortada: alta manual → parcial 4 de 12 → faltan 13 → programar → lista → tarea de
Gabriel con «NP TN 0041» → planilla con lo armado → ISIS 5000 → entregar cierra el pedido y Entregados guarda «TN 0041» ·
PDF Krikos y OC repetida rechazada · cancelar anula la programación.

**Decisiones tomadas en piloto automático (Thomas):**
- **P1** NP de GT = la serie que ya existía, `TN 0001…`, para todos los orígenes: ya la usaba la página de TN y no choca con las de ISIS (3893+).
- **P2** Un solo pedido = `gt.pedidos`; la Programación quedó como su logística (`pedido_id`), no una segunda copia: así siguen andando sin reescribirse las 20 RPC de la PPP, los camiones, la marca de Javier y la tarea de Gabriel.
- **P3** `ppp_a_programar.np` pasa a ser el número de GT y el de ISIS va a `np_isis`. El celular (`gt_ppp_para_armar`, sin tocar la app por la regla de Angely) muestra «NP 4» en vez de «NP TN 0004» hasta la próxima versión de la app.
- **P4** Los 37 de la Programación se migraron enteros (también entregados y el anulado) para que haya un solo modelo; sin renglones porque el Excel de TN no los traía: se completan con ＋ Renglón.
- **P5** Los pedidos de la página de TN entran **solos** a A Programar (como el pedido web en GV). Los dos ya entregados (TN 0001 / 0002) no.
- **P6** Paso a ISIS: no hay evidencia de qué ISIS ni qué importador usa TN (`isis_lk` / `isis_ch` no tienen a sus clientes 1919, 2094, 798) → **planilla para cargar a mano**, no el Excel de importación de GV. Va lo **armado** si el pedido tiene armado; si no, lo pedido (columna «Según»).
- **P7** La tarea de Gabriel (72) sigue igual; ahora nombra la NP de GT (y la de ISIS si ya la tiene) y dice dónde está la planilla.
- **P8** Las RPC con otra forma salieron con nombre nuevo (`…6`, `gt_admin_pedidos2`) porque el conector no deja `DROP`; el admin cae a las viejas si no están. `gt_admin_ppp_crear_pedido` (el alta vieja del PDF) ahora crea el pedido en GT.
- **P9** El faltante cuenta sólo pedidos abiertos, parciales o armados (no cargados ni entregados) y no descuenta la góndola: es lo que falta ARMAR; la OP decidirá cuánto fabricar.

`sql/gt_v194_pedidos_primero_en_gt.sql` · `sql/gt_v194_migrar_datos.sql` · `tests/pedidos-gt.cjs` (23 controles) · proceso en `procesos` (Ventas › 11) Tierra Nativa y otros, sección «Tierra Nativa: pedido primero en GT»).

### 1.73 / gt_v192 — PPP como Gestión Virgilio: camiones por día, «lista para facturar» desde el celular y tarea a Gabriel (Tomás Beviglia, 18/11/2026)

- Pedido: *«la programación de pedidos dentro del admin … lo más posible a GV … cómo separar en camiones … que Javier marque desde ahí las notas de pedido listas para facturar … con alguna alerta en el Planify de Gabriel»*. Aprobado: C2, C3, C4, C6, C7, C8. **No** (C1, C5): los pedidos se siguen cargando **primero en ISIS**; GT sólo los controla, y no hay módulo de Facturación en GT. ⚠ **C1 quedó sin efecto el 20/11 (gt_v194): el pedido nace en GT y después va a ISIS.**
- **Zonas** (`gt.ppp_zonas`, barrio → zona): Norte (Munro, Tigre, Tortuguitas) · Capital Sur (Pompeya, Soldati) · Capital (Paternal) · Retira. Barrio sin fila = «Sin zona (barrio)»: se agrega con un `insert`.
- **Camión** (`gt.ppp_camion_de`): súper (Cencosud, Coto, La Anónima, Inc) = su propio camión · Retira sin camión · el resto, la zona. La columna `camion` lo pisa a mano (admin: «🚚 Pasar a ese camión»; vacío = vuelve al automático).
- **Admin · Programación** (`gt_admin_ppp_programacion5`, cae a la 4): día → camión con NP, paradas, m³ y kg; aviso si un camión pasa los **40 m³** (`jornada_camion_m3_cap` de GV); día pasado con pedidos = **VENCIDO**; ⏱ demora (días desde la recepción) en rojo desde **14**, también en A Programar; chip «✅ Lista p/ facturar · Javier hh:mm» y «↩ Quitar «lista»».
- **Celular** (1.73): con «Pedidos» abierto aparece **🧾 Pedidos listos para facturar**: las NP programadas de 7 días atrás a 7 adelante (`gt_ppp_para_armar`), tilda las armadas → `gt_ppp_marcar_listos` (rechaza inactivos y la persona de prueba; en modo vista no graba). Va directo, no por la cola: sin red, avisa y no marca.
- **Tarea a Gabriel (72)**: `gt.ppp_fact_tarea_sync(día)` arma **una tarea de Planify por día de entrega** («GT a facturar 20/11: 2 NP listas») con las NP listas sin entregar; la nota se reescribe al sumar o mover NP y se **cierra sola** cuando se entregan o se les quita la marca. La dispara el trigger `zz_ppp_fact_tarea` de `gt.ppp_a_programar` (nunca frena el cambio). Probado en transacción abortada: marcar → tarea · mover una NP de día → dos tareas · entregar → las dos cerradas.
- `tests/ppp-camiones.cjs` (15 controles). `sql/gt_v192_ppp_camiones_listos.sql`.

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
  Negro 30*40 (224 Porta Gigante), **236** Bco P 60*80 y **237** Negro 60*80 (220; ⚠ gt_v180: apagados, el tablero ya los
  tiene como **105 / 107** — NO agregarlos), **238** 03 Negro 15*21 (sets 408 /
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

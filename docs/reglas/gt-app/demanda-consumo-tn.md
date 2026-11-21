# Demanda y consumo desde Tierra Nativa — reglas de GT

_Parte de `docs/REGLAS-GT-APP.md` (índice). Partido por tema el 21/11/2026; texto sin cambios, secciones en el orden del original._

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

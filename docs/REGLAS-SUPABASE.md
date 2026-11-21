# REGLAS de Supabase (GT)

_Movido tal cual desde `CLAUDE.md` el 21/11/2026 (Thomas: llevar GT a la estructura de Gestión Virgilio y dejar CLAUDE.md ≤ 40 KB)._
_En `CLAUDE.md` queda el resumen; acá, el texto completo. Si choca con `CLAUDE.md`, manda `CLAUDE.md`._

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

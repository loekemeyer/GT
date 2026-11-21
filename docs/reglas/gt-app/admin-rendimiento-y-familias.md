# Rendimiento del admin y familias de fabricación — reglas de GT

_Parte de `docs/REGLAS-GT-APP.md` (índice). Partido por tema el 21/11/2026; texto sin cambios, secciones en el orden del original._

### 1.37 — pestaña 📈 Rendimiento en el admin: segundos por unidad, por área, variable y operario (Elías, 02/10/2026)

- Pedido: *«tablas por rendimiento… dentro de la tabla corte, en una columna las diferentes variables y una columna por
  persona»* · *«el rendimiento en montaje, gancho, emblistado, contraído y encolado tiene que estar medido en cuántos
  segundos tardan por unidad… ya te había pasado las unidades por caja»*.
- Una tabla por área de la lista de Elías (Corte, Grampeado, Encolado, Montaje, Gancho, Emblistado, Contraído). **Fila** =
  la variable (`gt.variable_rendimiento`): Corte → moldura de la pieza · Grampeado → moldura + medida del aro, sin color ·
  Encolado → la medida · el resto → la familia (moldura + medida). Ordenadas por unidades, mayor → menor. **Columna** =
  cada operario que trabajó ahí (por legajo) + Prom. **Celda** = segundos por unidad = tiempo neto de pausas ÷ unidades
  (cajas × UxB; piezas y aros en Corte y Grampeado). Verde ≤ −20 % del promedio de la fila, rojo ≥ +20 %. Con menos de
  15 min en la celda sólo sale el tiempo, en gris (D35). Tramos de 2 min o más con cantidad. Período desde / hasta (4
  semanas por defecto). Las áreas sin datos van juntas en una línea.
- **1.38 (Elías: «¿qué es prom?»):** «Prom.» = el de toda la fila (el tiempo de todos ÷ todas las unidades), la vara para
  pintar cada celda. Con menos de 15 min de datos la celda mostraba el tiempo acumulado («0:04» = 4 min) y bajo el título
  «segundos por pieza» parecían segundos: ahora sale siempre el número de segundos por unidad, en gris y sin color
  cuando hay menos de 15 min (el tiempo y las unidades, en el globito).
- **1.46 / gt_v156 (Elías: «el corte es por moldura y por corte (cm)»):** la fila de **Corte** pasa a ser moldura + largo
  de la pieza («Mold 03 · 25 cm», «Mold 3P 3/4 · 30 cm»; coma decimal), sin el color; la columna se llama «Moldura ·
  largo». `sql/gt_v156_rendimiento_corte_moldura_y_largo.sql`. **D57 (Elías: «no»):** los tramos de Corte sin código
  (hoy, uno de David del 01/10) siguen en Rendimiento.
- **D46 y D47 confirmados por Elías (02/10):** las filas quedan como están, y la pareja figura con los segundos por
  unidad **de la pareja** (no al doble en mano de obra). Las parejas de Encolado y Contraído (D45) cuentan desde 1.39.
  ⚠ **D47 quedó sin efecto en 1.41**: la pareja se reparte las unidades según el tiempo de cada uno (s/u por persona).
- `public.gt_admin_rendimiento(clave, desde, hasta)` devuelve json en una fila (el tope de 1.000 filas, 1.35).
  `sql/gt_v150_rendimiento.sql`. Probado con la clave cambiada en una transacción abortada (Luis: Encolado 10*30 2,2 s/u,
  30*40 15,6, 40*50 1,9; Walter: Emblistado Mold 03 · 30*40 3,5) y en `tests/smoke.cjs`.

### gt_v146 — en ENCOLADO la familia es sólo la medida (Elías, 02/10/2026)

- Elías: *«cuando se hace encolado la moldura no es un factor, solamente la medida»*. Cambia, **sólo para Encolado**, la
  regla de Thomas de 1.16 (*«misma moldura + misma medida = misma demora en cualquier proceso»*).
- `gt.rubros.familia_sin_moldura` (hoy `true` sólo en `ENCOL`) y `gt.familia(área, código, medida)`: con la marca, la
  familia es la medida («10*30»; un set de 3, «Set x3 · 15*21 + 20*30 + 30*40»); sin ella, `gt.grupo_tramo` como
  siempre. La usan el ritmo (`gt_admin_ritmo2`, también el promedio de 4 semanas, que se recalcula solo) y Producción
  (`gt_admin_produccion3`). Otra área que no dependa de la moldura: `update gt.rubros set familia_sin_moldura = true
  where codigo = '…'`. Las recetas de insumos por grupo no cambian.
- Medido sobre los 279 productos que GT fabrica: en Encolado pasan de **123 grupos de comparación a 59**, y los que van
  solos de 88 a 34. El 173 (Mold 03) y el 185 quedan juntos en «10*30»; el 224 (Mold 30mm) en «30*40», con cualquier
  30*40. En Montaje, Gancho, Emblistado y Contraído sigue «Mold 03 · 10*30».
- Probado con los tramos del 02/10 (clave cambiada en una transacción abortada): Luis Luna · Encolado · 10*30 (173, 185)
  y 30*40 (224); Walter Saucedo · Emblistado · Mold 03 · 30*40 (183). `sql/gt_v146_familia_encolado_medida.sql`.

### 1.32 — la FAMILIA de cada tramo en Producción del admin, y por qué el ritmo sale vacío (Elías, 02/10/2026)

- Pregunta: *«en admin no muestra el ritmo ni la familia, ¿están las familias subidas a la base? el encolado de la foto
  es 10*30»*. **Las familias están**: es el grupo de fabricación de 1.15 (moldura + medida), calculado de la descripción
  y la medida de `gt.codigos` por `gt.grupo_tramo()`: 224 de 317 activos tienen familia, el resto va solo. El 173
  (Cuadro Mold 03 Grafic Work, 10*30) es «Mold 03 · 10*30», con 130, 140, 154, 164, 180, 185, 215, 230 y 444.
- **El ritmo vacío era la regla D35**: sólo cuentan tramos de 2 min o más con cantidad, y el encolado de Luis duró 43 s
  (10:23:26 → 10:24:09). La tabla decía «Sin tramos con cantidad ese día», que confundía: ahora dice que hubo tramos y
  que duraron menos de 2 min.
- **La familia sólo salía en la tabla de Ritmo.** Ahora «Por operario» tiene la columna **Familia** (un código que va
  solo, «—»). `public.gt_admin_produccion3` = la 2 + `familia`, con la misma cuenta que el grupo del ritmo; es función
  nueva porque cambiar las columnas de la 2 pide `DROP`. `admin.html` llama a la 3 y, si falla, a la 2.
  `sql/gt_v145_admin_produccion_familia.sql`. Probado con la clave cambiada en una transacción abortada (3 tramos:
  173 → Mold 03 · 10*30, Movimientos sin familia, 224 → Mold 30mm · 30*40) y en `tests/smoke.cjs`.

### 1.18 — deco se agrupa por modelo (Thomas, 01/10/2026)

Bandejas, cajones, percheros, cuelgas…: sólo van juntos si la descripción es la misma salvo el diseño
(modelo antes de «Mold» + moldura + medida): 540 = 542, 563 = 583, 564 = 584, 565 = 585. Cuadros, porta,
espejos, diplomas y múltiples siguen con moldura + medida. Excepciones (1.19, en `gt.codigo_grupo`): 818 con
456/536 (Mold 12 = 012), 547 con 540/542, 541 solo. `sql/gt_v118_grupo_deco.sql`.

### 1.17 — sets de 3 (Thomas, 01/10/2026)

- Un **set de 3** («Set x3» en la descripción) se compara **sólo con sets de 3** en todo el proceso: grupo
  «Set x3 · Mold 03 · 15*21 + 20*30 + 30*40» (medidas ordenadas). Hoy: 7 + 4 cuadros, 2 bandejas, 900, 902.
- En **Montaje y Gancho**, con un set de 3 la app pregunta **qué medida** va a montar / ponerle gancho
  (3 botones). Va en `gt.registros.medida` (apertura y cierre) y ese tramo se compara con **moldura + esa
  medida** (los cuadros sueltos de esa medida). Al seguir con el mismo set, la vuelve a preguntar.
- La app lee lo de hoy con `gt_registros_hoy2` (trae la medida). `sql/gt_v117_sets_medida.sql`.

### 1.15 — grupo de fabricación (Thomas, 01/10/2026)

Misma **moldura (o MDF) + misma medida** = misma demora en cualquier proceso (1.16, Thomas: el tipo NO
entra; se retira el «tipo + moldura + medida» de 1.15; **salvo Encolado, que va sólo por medida: gt_v146, Elías**): el 134 y el 183 son «Mold 03 · 30*40» (38 códigos:
cuadros, diplomas y espejos). El ritmo del admin (`gt_admin_ritmo2`) agrupa por ese grupo y
compara contra el promedio **del grupo** en el área (4 semanas). 226 de 323 códigos en 64 grupos; el resto
va solo. Excepción a mano: `gt.codigo_grupo`. `sql/gt_v115_grupo_fabricacion.sql`.

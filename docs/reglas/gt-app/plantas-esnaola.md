# Plantas Pellegrini y Esnaola — reglas de GT

_Parte de `docs/REGLAS-GT-APP.md` (índice). Partido por tema el 21/11/2026; texto sin cambios, secciones en el orden del original._

### 1.25 — Pintado cuenta paquetes y el Porta Cubo (Thomas, 01/10/2026: D6, D7, D8)

- **D8:** Pintado, al terminar, pide **paquetes** («¿Cuántos paquetes de moldura 03?»). Cuántos metros trae un
  paquete **depende de la moldura**: va en `gt.moldura_paquete` (moldura → metros por paquete; 03 = 200 m desde
  1.26, el resto se mide con el paquete terminado de Corte). Movimientos: Pintado + `moldura_pintada` (paquetes, con el color) y − `moldura_lijada`
  «sin anilina» en metros = paquetes × metros por paquete; sin el dato sale «sin receta» con la nota de lo que falta.
- **D6 / D24:** el **Porta Mold 30mm Cubo** (814 / 815 / 816) arma con los aros **3P 3/4 Bco T chicos** (063 / 064 /
  065): *«Bco T es cubo»* (Thomas). Se retira la lectura de 1.25 (Bco P 066 / 067 / 068). Corte los resuelve solo con
  las piezas **3P 3/4 Bco Total** 136 a 141. Los Bco P chicos quedaron con esas mismas piezas en `gt.receta_corte`
  (D6: «sí, se arman con Bco Total») y hoy ningún producto los usa. `sql/gt_v129_porta_cubo_bco_t.sql`.
- **D23 (Thomas, 01/10: «ok»):** los aros **Bco P** con lados de 20, 25 y 27,5 cm —**069** 20×25, **117** 20×27,5,
  **070** 20×30, **103** 27,5×40— toman esos lados de las piezas **Bco Total** de Corte (140 = 20, 142 = 25,
  143 = 27,5 cm) y los de 30 y 40 de la lista «3P 3/4 Bco» (114, 116). En Corte la 3P 3/4 blanca sólo existe como
  «Bco Total» por debajo de 30 cm: el «parcial» se define después, no al cortar. `gt.receta_corte`,
  `sql/gt_v134_d23_bco_p_lados_cortos_bco_total.sql`.
- **D27 (Thomas, 01/10: «creemoslos»):** las piezas de Corte que les faltaban a los 10 aros sin receta. Nuevas **159 a
  168** (Trav 20mm Celeste 62 · 03 Bco 27, 62, 29 y 67,5 · 03 Negro 30 · 03 Natural 23 · 3P 3/4 Negro 27,5 · 3P 1/2 Bco 120 ·
  3P 3/4 Bco Total 29, ésta para el 116 por la regla D23). Los **Trav 20mm** ya estaban en Corte (151, 153, 154, 155,
  156) **sin medida** —no se leía en la foto— y se les puso la que piden sus aros, con el código más bajo como lado
  más corto: **[Adivinando]** cuál etiqueta del tablero es cuál. Hoy ninguno de esos 10 aros lo usa un producto,
  salvo el 148 (lo usa el 146). Resultado: **todos los aros tienen con qué cortarse** (`select * from gt.aro_piezas
  where pieza is null` vacía). `sql/gt_v135_d27_piezas_corte_faltantes.sql`.
- **D7:** la anilina de Lijado se pregunta **al empezar** (como quedó en 1.24).
- `sql/gt_v125_pintado_paquetes_cubo.sql`. La vista completa vigente: `sql/gt_movimientos_vivo.sql`.

### 1.24 — Esnaola: moldura, anilina, color y metros (Thomas, 01/10/2026)

| área | al empezar | al terminar |
|---|---|---|
| Moldurado | ¿Qué moldura? | metros |
| Lijado | ¿Qué moldura? · ¿Le ponés anilina? · si Sí, color (Marrón, Cedro, Roble, Verde) | metros |
| Pintado | color (Blanco parcial, Blanco total, Negro, Verde, Celeste, Rosa, Beige) · ¿Qué moldura? | paquetes (1.25) |

- **Las preguntas viven en `gt.rubro_pasos`**, no en el código: orden, botones, condición (`si_campo` =
  `si_valor`) y `momento` (`empezar` / `terminar`). Cambiar una pregunta o pasarla al final es un `update`.
  La app las lee con `gt_pasos()` (con caché offline).
- **Las molduras salen de Corte** (`gt.molduras`: el prefijo de las descripciones del sector 1 de Pellegrini):
  03, 05, 012, 3P 1/2, 3P 3/4, 045, Trav 20mm. Una moldura nueva en Corte aparece sola.
- La moldura va en `gt.registros.texto`; anilina y color en **`gt.registros.detalle`** (jsonb). El cierre lleva
  el detalle de la apertura más lo que se pregunte al terminar. Lo de hoy se lee con `gt_registros_hoy3`.
- Movimientos internos: Moldurado **+ moldura** (metros); Lijado **− moldura, + moldura_lijada** (con
  «anilina Cedro» / «sin anilina» en la columna medida). Pintado: ver 1.25.
- El admin muestra la anilina / el color en la descripción del tramo; el 012 de Moldurado no se cruza con el
  producto 012. `sql/gt_v124_esnaola_pasos.sql`.

### 1.22 — plantas: Pellegrini y Esnaola (Thomas, 01/10/2026)

- Después del código de la TV y el nombre, **quien trabaja en más de una planta** elige *«¿En qué planta trabajás
  hoy?»*. **Pellegrini: los 9 empleados. Esnaola: Darío Méndez (6) y Luis Luna (5)**; el resto entra siempre en
  Pellegrini y no ve la pregunta. (Se cargó primero como «Aula», mal dictado: la fila `AULA` quedó inactiva.)
- La botonera muestra sólo las áreas de esa planta: un área (`gt.rubros.planta`) **sin planta es de la principal**
  (la de menor `orden` en `gt.plantas`). En **Esnaola** se moldura, se lija y se pinta (las molduras que después
  se cortan en Pellegrini): áreas **Moldurado · Lijado · Pintado** (desde 1.24 preguntan moldura, anilina, color y metros: ver 1.24).
- La planta queda en la sesión del día y viaja en cada evento (`gt.registros.planta`). «🏭 Cambiar de planta» se sacó
  en 1.31: se cambia saliendo con ‹ y volviendo a entrar.
- Quién trabaja en qué planta = `gt.empleado_planta` (sin filas = sólo la principal). Agregar a alguien es un `insert`.
- La app lee `gt_botones2()` (trae la planta); si falla, cae a `gt_botones()`. `sql/gt_v122_plantas.sql`.

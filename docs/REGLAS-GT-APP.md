# REGLAS GT APP

**Índice** (no se lee entero ningún tema: se abre el subarchivo).

_Movido desde `CLAUDE.md` el 2026-10-13 (poda de tokens). Reglas sin cambios._

**Partido por tema el 21/11/2026** (Thomas Loekemeyer: llevar GT a la estructura de Gestión Virgilio). Este archivo es un
**ÍNDICE**: antes de tocar un tema, leer ENTERO sólo el subarchivo del problema en `docs/reglas/gt-app/`, nunca todo.
El texto de cada regla es el mismo que tenía el archivo único (186.903 bytes); se verificó con
`scripts/verificar-poda-reglas.cjs` (0 faltan) y renglón por renglón.

- **Ante la duda de dónde está una regla:** `grep -rl '<palabra>' docs/reglas/gt-app/` (o el número de versión: `grep -rn 'gt_v182\|1\.68' docs/reglas/gt-app/`).
- **Una regla nueva va al subarchivo de su tema** (arriba de todo, lo más nuevo primero), no a `CLAUDE.md`. Si el tema es nuevo
  (ej. faltantes, orden de producción), se crea `docs/reglas/gt-app/<tema>.md` y se agrega su línea acá.
- **Topes** (`tests/tamano-md.cjs`): este índice ≤ 8 KB, cada subarchivo ≤ 25 KB, `CLAUDE.md` ≤ 40 KB. Al pasarse **no se sube
  el tope**: se parte el subarchivo (y se anota acá) o lo viejo va a `docs/reglas/gt-app/RETIRADO.md`.

## Subarchivos (`docs/reglas/gt-app/`)

- `base-y-arquitectura.md` — Base y arquitectura: piezas de la app, schema `gt`, conector de Supabase y carga de datos.
- `ingreso-operario.md` — Ingreso del operario: código del monitor, «¿Quién sos?» / «¿Sos …?», celular nuevo o compartido, Esnaola sin monitor.
- `botonera-y-registro.md` — Botonera y registro: Empecé / Terminé, «¿con qué seguís?», pausas (Baño, Movimientos, Limpieza), tiempo muerto, diseño para celular.
- `codigos-y-areas.md` — Códigos y áreas: tipear el código, estado de los códigos, códigos por área, teclado numérico y E, unidad por código, puesta a punto.
- `codigos-deco-corte-grampeado.md` — Tableros de Deco, Corte y Grampeado: 3080 y artículos, colores de bandeja, Corte 90°, Corte vidrio, aros.
- `cola-offline.md` — Cola offline del celular: nada se descarta, reintentos, errores avisados, recarga sin red.
- `parejas.md` — Parejas (de a dos) en Encolado y Contraído: invitar, sumarse, avisos, «Me fui» y rendimiento repartido.
- `stock-y-cajas.md` — Stock y movimientos por etapa, stock de cajas, armado de cajas, vidrio cortado, sin emblistado, correcciones.
- `insumos-y-recetas.md` — Insumos por producto (lámina, fondo, vidrio, gancho, blíster, grampas), Sublimado, vidrio de cada producto, colores de marco.
- `pedidos-y-ppp.md` — Pedidos y programación (PPP): el pedido nace en GT (gt_v194), camiones por día, armado desde el admin, qué fabricar, discontinuos y máximo.
- `demanda-consumo-tn.md` — Demanda y consumo desde Tierra Nativa: la Est. Madre en el Supabase de TN y los pedidos de TN por FDW.
- `admin.md` — Admin: Monitor, Producción, Asistencia, modo VISTA, 👁 Botonera, entrar con el código de Planify, ancho, corregir un tramo.
- `admin-rendimiento-y-familias.md` — Rendimiento del admin y familias de fabricación: segundos por unidad, familia de cada tramo, grupo, sets de 3, deco por modelo.
- `plantas-esnaola.md` — Plantas Pellegrini y Esnaola: moldura, anilina, color, metros, Pintado y Porta Cubo.
- `empleados-y-asistencia.md` — Empleados y asistencia: módulo 👥 Empleados, vacaciones, ingreso vs. primer trabajo, horario por día, jornada y unidades por caja.
- `version-y-publicacion.md` — Versión y publicación: numeración 1.x y bump, no tocar a los operarios mientras trabajan, lo cargado antes del 05/10 fue prueba.

## Dónde está la regla de…

- **El pedido nace en GT (gt_v194)**, camiones, «lista para facturar»: `pedidos-y-ppp.md`.
- **Código no registrado → Telegram «GT Avisos»**, aviso de llegadas tarde: `botonera-y-registro.md` (1.2) y `codigos-y-areas.md` (v6.0).
- **El conector de Supabase no deja correr un `DROP`** (ni un `;` dentro de un texto): `base-y-arquitectura.md`.
- **No publicar mientras trabajan los operarios** (Angely, 02/11): `version-y-publicacion.md` y el bloque de `CLAUDE.md`.
- **`gt.demanda_cajas`** para el monitor y el corte de conteo de cajas: `stock-y-cajas.md`.

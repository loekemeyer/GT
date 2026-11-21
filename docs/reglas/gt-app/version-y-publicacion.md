# Versión y publicación — reglas de GT

_Parte de `docs/REGLAS-GT-APP.md` (índice). Partido por tema el 21/11/2026; texto sin cambios, secciones en el orden del original._

### 02/10/2026 — todo lo cargado hasta el lunes 05/10 fue PRUEBA (Thomas, D62: «sí»)

- La app se usa en serio desde el **lunes 05/10/2026**. Lo anterior se borra con `sql/gt_borrar_pruebas_antes_del_lunes.sql`
  (eventos, parejas e ingresos del monitor con fecha anterior al lunes), en el **SQL Editor**: desde la sesión el conector
  cortó el `DELETE` a los 60 s, como el 01/10 (lo corre Thomas). **Alcanza con una vez**: el freno **gt_v158**
  (`aaa_gt_pruebas_antes_del_lunes`, BEFORE INSERT en `gt.registros`) manda al respaldo, hasta el lunes 05/10 12:00, todo
  evento con hora anterior al lunes (pruebas del fin de semana o de un celular sin red); el celular lo da por enviado.
  Pasado el lunes 12:00 no hace nada. `sql/gt_v158_pruebas_antes_del_lunes.sql`.
- **Lo único que Claude no corre desde la sesión son los borrados** (`DELETE` / `DROP`: el conector los corta). Todo lo
  demás de GT (crear, cambiar, cargar) sí; afuera queda sólo lo del proyecto de Tierra Nativa.
- Respaldo con RLS: `gt.bkp_registros_pruebas_20261002` (183 eventos, 01/10 13:26 → 02/10 17:22, 9 operarios, 0 de Deco),
  `gt.bkp_parejas_pruebas_20261002` (5) y `gt.bkp_monitor_ingresos_pruebas_20261002` (7).

### REGLA de publicación (Angely, 02/11/2026): no tocar a los operarios mientras trabajan

*«Si algún cambio afecta el uso del programa mientras lo están usando, avisame y esperamos que los empleados se vayan. Afectar = que se les cierre la app o que no se les guarde lo que hacen.»* Está en `CLAUDE.md`.

### Versión (Thomas, 01/10/2026)

**La app arrancó de nuevo en 1.0** (lo anterior, v1.0 a v12.0, fue el armado). Cada modificación sube
el número de a uno: **1.0 → 1.1 → … → 1.9 → 1.10 → … → 1.99 → 2.0**. Se sube con el script, que mueve
los 4 lugares juntos (`APP_VERSION` en `config.js`, `SW_VERSION` en `sw.js`, `version.json` y los `?v=`
de `index.html` y `admin.html`):

```bash
node scripts/bump-version.cjs        # la siguiente
```

⚠ 1.10 es **mayor** que 1.9: si algún día se comparan versiones, se comparan por número, no como texto. Commits `vX.Y: descripción`, directo a `main`, con el trailer
`Hecho-por: <Nombre> (employee_id <N>)`.

---

> Los bloques de abajo son las reglas que valen para **todos** los repos, copiadas textuales del
> `CLAUDE.md` de `loekemeyer/gestion-virgilio` (regla 6 de Planify). Si chocan con algo de arriba,
> manda lo de arriba sólo en lo que es propio de GT.

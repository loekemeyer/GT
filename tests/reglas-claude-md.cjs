/* Las reglas de CLAUDE.md que no se pueden perder (21/11/2026, cuando GT se partió por tema como Gestión Virgilio).
   Gestión Virgilio las sostiene con tests/regla-sin-accion-comercial.cjs y tests/regla-piloto-automatico.cjs; en GT
   las cuida este test: si una poda o una copia de bloque las borra, sale 1.
   Y controla que el índice docs/REGLAS-GT-APP.md nombre archivos que existen. */
const fs = require("fs"), path = require("path");
const raiz = path.join(__dirname, "..");
const claude = fs.readFileSync(path.join(raiz, "CLAUDE.md"), "utf8");
const deben = [
  ["no proponer acciones comerciales (Luis, 19/10)", /CLAUDE NO PROPONE ACCIONES COMERCIALES/],
  ["lo que tiene indicador en el front no se propone (Luis, 20/10)", /indicador en el front NO se propone resolver/],
  ["medir en ese momento antes de proponer una corrección (Luis, 19/10)", /medirlo EN ESE MOMENTO/],
  ["auditoría automática sin preguntar (Luis, 16/10)", /Auditoría: AUTOMÁTICA, SIN PREGUNTAR/],
  ["procesos en la misma sesión (Luis Rial, 18-19/11)", /se carga en `procesos` EN LA MISMA SESIÓN/],
  ["piloto automático (Thomas, 31/10)", /PILOTO AUTOMÁTICO/],
  ["no publicar mientras trabajan los operarios (Angely, 02/11)", /no publicar nada que afecte a los operarios/],
  ["Thomas es el employee_id 3, nunca el 20", /Nunca al 20/],
  ["el índice apunta a docs/reglas/gt-app/", /docs\/reglas\/gt-app\//],
];
const fallos = deben.filter(([, re]) => !re.test(claude)).map(([q]) => "CLAUDE.md perdió: " + q);
// todo archivo de reglas de GT que nombra CLAUDE.md existe (los docs/ de Gestion-Virgilio que cita no se miran)
for (const m of claude.matchAll(/`(docs\/(?:REGLAS-|RECETAS-|reglas\/)[^`*<>]+\.md)`/g))
  if (!fs.existsSync(path.join(raiz, m[1]))) fallos.push(`CLAUDE.md nombra ${m[1]} y no existe`);
// el índice nombra cada subarchivo y cada subarchivo nombrado existe
const indice = fs.readFileSync(path.join(raiz, "docs", "REGLAS-GT-APP.md"), "utf8");
const carpeta = path.join(raiz, "docs", "reglas", "gt-app");
const nombrados = [...indice.matchAll(/^- `([a-z0-9-]+\.md)`/gm)].map((m) => m[1]);
for (const n of nombrados) if (!fs.existsSync(path.join(carpeta, n))) fallos.push(`el índice nombra ${n} y no existe`);
for (const n of fs.readdirSync(carpeta).filter((f) => f.endsWith(".md") && f !== "RETIRADO.md"))
  if (!nombrados.includes(n)) fallos.push(`docs/reglas/gt-app/${n} no figura en el índice`);
if (fallos.length) { console.error("reglas-claude-md: FALLA\n - " + fallos.join("\n - ")); process.exit(1); }
console.log(`reglas-claude-md: OK — ${deben.length} reglas en CLAUDE.md · ${nombrados.length} subarchivos en el índice`);

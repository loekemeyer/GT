#!/usr/bin/env node
// Verifica que una poda / particion de un docs/REGLAS-*.md no perdio reglas (Luis, 19/10).
// Uso: node scripts/verificar-poda-reglas.cjs <original.md> <nuevo1.md> [nuevo2.md ...]
// Toda pieza "dura" del original tiene que seguir en ALGUNO de los archivos nuevos:
//   · lo que va entre `backticks` (tablas, funciones, tests, columnas, codigos)
//   · las versiones vNN.NN
//   · las fechas AAAA-MM-DD y DD/MM
// No mide la prosa: eso se revisa leyendo. Sale 1 si falta algo.
const fs = require("fs");
const [orig, ...nuevos] = process.argv.slice(2);
if (!orig || !nuevos.length) {
  console.error("uso: verificar-poda-reglas.cjs <original.md> <nuevo.md>...");
  process.exit(2);
}
const piezas = (t) => {
  const s = new Set();
  for (const m of t.matchAll(/`([^`\n]{1,200})`/g)) { if (/[A-Za-z0-9_]{2,}/.test(m[1])) s.add(m[1].trim()); };
  for (const m of t.matchAll(/\bv\d{1,2}\.\d{2,3}\b/g)) s.add(m[0]);
  for (const m of t.matchAll(/\b20\d{2}-\d{2}-\d{2}\b/g)) s.add(m[0]);
  for (const m of t.matchAll(/\b\d{1,2}\/\d{1,2}\b/g)) s.add(m[0]);
  return s;
};
const plano = (t) => t.replace(/\s+/g, " ");
const o = piezas(fs.readFileSync(orig, "utf8"));
const todo = plano(nuevos.map((f) => fs.readFileSync(f, "utf8")).join("\n"));
const faltan = [...o].filter((p) => !todo.includes(plano(p)));
const total = nuevos.reduce((a, f) => a + fs.statSync(f).size, 0);
console.log(`${orig}: ${o.size} piezas, ${faltan.length} faltan · ${fs.statSync(orig).size} -> ${total} bytes en ${nuevos.length} archivos`);
if (faltan.length) {
  console.log("FALTAN:\n  " + faltan.slice(0, 200).join("\n  "));
  process.exit(1);
}

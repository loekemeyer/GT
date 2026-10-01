#!/usr/bin/env node
// Sube la versión de GT en los 4 lugares a la vez (config.js, sw.js, version.json y los ?v= de los HTML).
// Esquema (Thomas, 01/10/2026): 1.0 → 1.1 → … → 1.9 → 1.10 → … → 1.99 → 2.0.
// Uso: node scripts/bump-version.cjs            (siguiente)
//      node scripts/bump-version.cjs 1.7        (una en particular)
const fs = require("fs"), path = require("path");
const R = path.join(__dirname, "..");
const leer = (f) => fs.readFileSync(path.join(R, f), "utf8");
const escribir = (f, s) => fs.writeFileSync(path.join(R, f), s);
const actual = leer("config.js").match(/APP_VERSION: "([\d.]+)"/)[1];
let nueva = process.argv[2];
if (!nueva) {
  const [ma, mi] = actual.split(".").map(Number);
  nueva = mi >= 99 ? `${ma + 1}.0` : `${ma}.${mi + 1}`;
}
if (!/^\d+\.\d{1,2}$/.test(nueva)) { console.error("versión inválida: " + nueva); process.exit(1); }
escribir("config.js", leer("config.js").replace(/APP_VERSION: "[\d.]+"/, `APP_VERSION: "${nueva}"`));
escribir("sw.js", leer("sw.js").replace(/SW_VERSION = "[\d.]+-gt"/, `SW_VERSION = "${nueva}-gt"`));
escribir("version.json", `{ "version": "${nueva}" }\n`);
for (const f of ["index.html", "admin.html"]) escribir(f, leer(f).replace(/\?v=[\d.]+/g, `?v=${nueva}`));
console.log(`${actual} → ${nueva}`);

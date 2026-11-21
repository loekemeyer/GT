#!/usr/bin/env node
// Tope de tamaño de lo que se carga en cada sesión. Traído de Gestión Virgilio (tests/tamano-md.cjs, Luis 19/10/2026 y
// Thomas 15/11/2026) el 21/11/2026, cuando GT se partió por tema (Thomas: «lo más parecido a Gestión Virgilio»): hasta
// ese día docs/REGLAS-GT-APP.md era UN archivo de 186.903 bytes ordenado por versión y CLAUDE.md pesaba 46.230.
// docs/REGLAS-<TEMA>.md queda como ÍNDICE y cada regla vive en docs/reglas/<tema>/<subtema>.md: la sesión lee el índice
// y un subarchivo.
//
// Al pasarse un tope NO se sube el tope: se parte el subarchivo (y se anota en el índice), se manda lo viejo a
// docs/reglas/<tema>/RETIRADO.md o, en CLAUDE.md, el detalle baja a docs/.
const fs = require("fs");
const path = require("path");
const raiz = path.join(__dirname, "..");

const TOPE_CLAUDE = 40000; // bytes (el mismo de Gestión Virgilio)
const TOPE_REGLAS = 30000; // docs/REGLAS-*.md sin carpeta (parte vigente, antes de "🗄 RETIRADO")
const TOPE_INDICE = 8000;  // docs/REGLAS-*.md que tiene carpeta docs/reglas/<tema>/
const TOPE_SUB = 25000;    // cada docs/reglas/<tema>/*.md, salvo RETIRADO.md

const fallas = [];
const claude = fs.statSync(path.join(raiz, "CLAUDE.md")).size;
if (claude > TOPE_CLAUDE)
  fallas.push(`CLAUDE.md pesa ${claude} bytes (tope ${TOPE_CLAUDE}): pasar detalle a docs/, no subir el tope`);

const docs = path.join(raiz, "docs");
const corte = Buffer.from("\n## 🗄 RETIRADO");
let subs = 0;
for (const f of fs.readdirSync(docs).filter((n) => /^REGLAS-.*\.md$/.test(n))) {
  const tema = f.slice(7, -3).toLowerCase();
  const carpeta = path.join(docs, "reglas", tema);
  const b = fs.readFileSync(path.join(docs, f));
  if (fs.existsSync(carpeta)) {
    if (b.length > TOPE_INDICE)
      fallas.push(`docs/${f} es índice y pesa ${b.length} bytes (tope ${TOPE_INDICE}): el detalle va a docs/reglas/${tema}/`);
    const indice = b.toString("utf8");
    for (const s of fs.readdirSync(carpeta).filter((n) => n.endsWith(".md") && n !== "RETIRADO.md")) {
      subs++;
      const n = fs.statSync(path.join(carpeta, s)).size;
      if (n > TOPE_SUB)
        fallas.push(`docs/reglas/${tema}/${s}: ${n} bytes (tope ${TOPE_SUB}): partirlo (y anotarlo en el índice) o mandar lo viejo a RETIRADO.md`);
      // un subarchivo que el índice no nombra no lo encuentra nadie
      if (!indice.includes("`" + s + "`"))
        fallas.push(`docs/reglas/${tema}/${s} no figura en docs/${f}: agregarle su línea al índice`);
    }
  } else {
    const i = b.indexOf(corte);
    const vigente = i > 0 ? i : b.length;
    if (vigente > TOPE_REGLAS)
      fallas.push(`docs/${f}: ${vigente} bytes vigentes (tope ${TOPE_REGLAS}): partirlo en docs/reglas/${tema}/ con este archivo como índice`);
  }
}

// .claude/agents/*.md: la "description" de cada agente se carga en TODAS las sesiones (si algún día hay agentes).
const agentes = path.join(raiz, ".claude", "agents");
if (fs.existsSync(agentes))
  for (const a of fs.readdirSync(agentes).filter((n) => n.endsWith(".md"))) {
    const m = fs.readFileSync(path.join(agentes, a), "utf8").match(/^description:\s*(.*)$/m);
    const n = m ? Buffer.byteLength(m[1]) : 0;
    if (n > 450) fallas.push(`.claude/agents/${a}: description de ${n} bytes (tope 450): el detalle va al cuerpo`);
  }

if (fallas.length) {
  console.error("tamano-md: ROJO\n  " + fallas.join("\n  "));
  process.exit(1);
}
console.log(`tamano-md: OK — CLAUDE.md ${claude}/${TOPE_CLAUDE} bytes · ${subs} subarchivos de reglas ≤ ${TOPE_SUB}`);

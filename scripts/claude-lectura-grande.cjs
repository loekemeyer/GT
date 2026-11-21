#!/usr/bin/env node
// Hook PreToolUse: frena la lectura ENTERA de un archivo grande. Traído de Gestión Virgilio (Luis, 19/10/2026, D11;
// Thomas, 15/11/2026: .md a 80 KB) el 21/11/2026, cuando GT se partió por tema (Thomas: «lo más parecido a Gestión
// Virgilio»). En GT: docs/REGLAS-GT-APP.md llegó a 187 KB de un solo archivo; admin.html pesa 155 KB y app.js 117 KB.
// Un Read sin límite de un archivo grande mete decenas de miles de tokens al contexto. Este hook BLOQUEA: sale 2 y el
// motivo vuelve al modelo, que reintenta con grep o con offset/limit. Se prueba con tests/hook-lectura-grande.cjs.
const fs = require("fs");
const path = require("path");

const TOPE_BYTES = 256 * 1024; // archivo "grande"
// Thomas, 15/11/2026: un .md de 80-256 KB pasaba entero (docs/historia/guia-notas-2026-11.md 103 KB, IDEAS-USUARIO 93 KB,
// PLAN-PEDIDO-DIRECTO 184 KB: 25-60 mil tokens cada uno). Para un .md el tope baja a 80 KB.
const TOPE_MD = 80 * 1024;
const tope = (f) => (/\.md$/i.test(f) ? TOPE_MD : TOPE_BYTES);
const TOPE_LINEAS = 600;       // limite maximo de lineas por Read en un archivo grande

let entrada = "";
process.stdin.on("data", (c) => (entrada += c));
process.stdin.on("end", () => {
  let j;
  try { j = JSON.parse(entrada || "{}"); } catch { process.exit(0); }
  const herr = j.tool_name, inp = j.tool_input || {};
  const base = j.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const peso = (f) => { try { return fs.statSync(path.resolve(base, f)).size; } catch { return 0; } };
  const kb = (n) => Math.round(n / 1024).toLocaleString("es-AR");

  if (herr === "Read" && inp.file_path) {
    const n = peso(inp.file_path);
    if (n > tope(inp.file_path) && /\.(png|jpe?g|gif|webp|pdf)$/i.test(inp.file_path) === false &&
        !(inp.limit && inp.limit <= TOPE_LINEAS)) {
      console.error(`Lectura frenada: ${inp.file_path} pesa ${kb(n)} KB. Buscá con Grep (output_mode "content", -n) ` +
        `y leé sólo el tramo con offset + limit <= ${TOPE_LINEAS}. Si es REGLAS, abrí el índice (docs/REGLAS-GT-APP.md) y el subarchivo de docs/reglas/gt-app/.`);
      process.exit(2);
    }
  }
  if (herr === "Bash" && typeof inp.command === "string") {
    // cat / less / more de un archivo grande sin recortar (head, tail, sed -n, grep si recortan).
    const m = inp.command.match(/(?:^|[;&|]\s*)(?:cat|less|more)\s+([^\s|;&>]+)/);
    if (m && !/\|\s*(head|tail|grep|wc|sed|awk|cut)\b/.test(inp.command)) {
      const n = peso(m[1].replace(/^["']|["']$/g, ""));
      if (n > tope(m[1].replace(/^["']|["']$/g, ""))) {
        console.error(`Lectura frenada: ${m[1]} pesa ${kb(n)} KB. Usá grep -n / sed -n 'A,Bp' en vez de cat.`);
        process.exit(2);
      }
    }
  }
  process.exit(0);
});

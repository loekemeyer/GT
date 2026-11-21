/* El hook PreToolUse que frena leer ENTERO un archivo grande (scripts/claude-lectura-grande.cjs, traído de Gestión
   Virgilio el 21/11/2026). GT no tiene hoy un archivo de más de 256 KB ni un .md de más de 80 KB (es justamente lo que
   el hook cuida), así que el test arma dos archivos de prueba en una carpeta temporal y los borra al final.
   Sale 1 si deja pasar una lectura entera de un archivo grande, si frena una chica o una con límite, o si el hook no
   está registrado en .claude/settings.json. */
const { spawnSync } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");
const raiz = path.join(__dirname, "..");
const hook = path.join(raiz, "scripts", "claude-lectura-grande.cjs");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gt-hook-"));
const grande = path.join(tmp, "grande.js"), md = path.join(tmp, "grande.md");
fs.writeFileSync(grande, "x".repeat(300 * 1024));
fs.writeFileSync(md, "# x\n" + "y".repeat(90 * 1024));
const corre = (o) => spawnSync("node", [hook], { input: JSON.stringify({ cwd: raiz, ...o }), encoding: "utf8" }).status;
const casos = [
  ["Read de 300 KB sin limite → frena", corre({ tool_name: "Read", tool_input: { file_path: grande } }), 2],
  ["Read de 300 KB con limit 2000 → frena", corre({ tool_name: "Read", tool_input: { file_path: grande, offset: 10, limit: 2000 } }), 2],
  ["Read de 300 KB con limit 200 → pasa", corre({ tool_name: "Read", tool_input: { file_path: grande, offset: 10, limit: 200 } }), 0],
  ["Read CLAUDE.md sin limite → pasa", corre({ tool_name: "Read", tool_input: { file_path: "CLAUDE.md" } }), 0],
  ["Read del índice de reglas → pasa", corre({ tool_name: "Read", tool_input: { file_path: "docs/REGLAS-GT-APP.md" } }), 0],
  ["Read de un .md de 90 KB sin limite → frena", corre({ tool_name: "Read", tool_input: { file_path: md } }), 2],
  ["Read de ese .md con limit 300 → pasa", corre({ tool_name: "Read", tool_input: { file_path: md, limit: 300 } }), 0],
  ["cat de un .md de 90 KB → frena", corre({ tool_name: "Bash", tool_input: { command: "cat " + md } }), 2],
  ["cat de 300 KB → frena", corre({ tool_name: "Bash", tool_input: { command: "cat " + grande } }), 2],
  ["cat de 300 KB | grep → pasa", corre({ tool_name: "Bash", tool_input: { command: "cat " + grande + " | grep -c x" } }), 0],
  ["Grep → pasa", corre({ tool_name: "Grep", tool_input: { pattern: "x" } }), 0],
];
fs.rmSync(tmp, { recursive: true, force: true });
const fallos = casos.filter(([, got, want]) => got !== want).map(([q, got, want]) => `${q} (salió ${got}, esperaba ${want})`);
let cfg;
try { cfg = JSON.parse(fs.readFileSync(path.join(raiz, ".claude", "settings.json"), "utf8")); } catch (e) { fallos.push(".claude/settings.json no es JSON válido: " + e.message); }
if (cfg) {
  // formato nuevo de hooks: { matcher, hooks: [ { type, command } ] }; el viejo hace que Claude Code tire el archivo entero
  const pre = (cfg.hooks && cfg.hooks.PreToolUse) || [];
  const ok = pre.some((h) => /Read/.test(h.matcher || "") && /Bash/.test(h.matcher || "") && Array.isArray(h.hooks) &&
    h.hooks.some((x) => x.type === "command" && /claude-lectura-grande\.cjs/.test(x.command || "")));
  if (!ok) fallos.push(".claude/settings.json no registra el hook en PreToolUse (matcher Read|Bash, formato con hooks: [...])");
  for (const [ev, lista] of Object.entries(cfg.hooks || {}))
    for (const h of lista) if (!Array.isArray(h.hooks)) fallos.push(`hook ${ev} con formato viejo (sin hooks: [...]): Claude Code descarta el archivo entero`);
}
if (fallos.length) { console.error("FALLA:\n - " + fallos.join("\n - ")); process.exit(1); }
console.log("hook-lectura-grande: OK — " + casos.length + " casos");

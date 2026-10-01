// La app se recarga sola cuando version.json trae una versión más nueva (y no lo hace si es la misma).
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."); let VER = null;
const srv = http.createServer((q, s) => {
  if (q.url.startsWith("/rest/")) { s.writeHead(200, { "Content-Type": "application/json" }); return s.end("[]"); }
  const u = q.url.split("?")[0];
  if (u === "/version.json") { s.writeHead(200, { "Content-Type": "application/json" }); return s.end(JSON.stringify({ version: VER })); }
  const f = path.join(ROOT, u === "/" ? "index.html" : u); if (!fs.existsSync(f)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { "Content-Type": f.endsWith(".js") ? "application/javascript" : f.endsWith(".css") ? "text/css" : "text/html" }); s.end(fs.readFileSync(f));
});
srv.listen(0, async () => {
  const actual = fs.readFileSync(path.join(ROOT, "config.js"), "utf8").match(/APP_VERSION: "([\d.]+)"/)[1];
  const base = "http://localhost:" + srv.address().port + "/"; const br = await pw.chromium.launch(); const pg = await br.newPage();
  let ok = true;
  VER = actual; await pg.goto(base); await pg.waitForTimeout(800);
  if (pg.url().includes("?v=")) { ok = false; console.log("✗ recargó con la misma versión"); } else console.log("✓ misma versión: no recarga");
  VER = "99.0"; await pg.goto(base); await pg.waitForURL(/\?v=99\.0/, { timeout: 5000 }).catch(() => {});
  if (!pg.url().includes("?v=99.0")) { ok = false; console.log("✗ no recargó con versión nueva"); } else console.log("✓ versión nueva: recarga sola con ?v=99.0");
  await br.close(); srv.close(); console.log(ok ? "VERDE" : "ROJO"); process.exit(ok ? 0 : 1);
});

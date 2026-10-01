// Smoke de la app de operario GT con la base simulada (no pega a Supabase).
// Uso: node tests/smoke.cjs   (necesita playwright; Chromium en /opt/pw-browsers)
const path = require("path");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const http = require("http"), fs = require("fs");
const ROOT = path.join(__dirname, "..");
const TAREAS = [
  { codigo: "EP", descripcion: "Empecé producción", tipo: "tarea", pide_texto: true, etiqueta_texto: "Orden", fila: 1, orden: 1 },
  { codigo: "PB", descripcion: "Pare baño", tipo: "tarea", pide_texto: false, etiqueta_texto: null, fila: 2, orden: 1 },
  { codigo: "FJ", descripcion: "Fin de jornada", tipo: "evento", pide_texto: false, etiqueta_texto: null, fila: 3, orden: 1 },
];
const db = [];
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const b = JSON.parse(body || "{}"), fn = req.url.split("/").pop();
      let out;
      if (fn === "gt_login") out = b.p_legajo === "7" ? [{ legajo: "7", nombre: "Prueba" }] : [];
      else if (fn === "gt_tareas") out = TAREAS;
      else if (fn === "gt_registros_hoy") out = db.filter((r) => r.legajo === b.p_legajo);
      else if (fn === "gt_registrar") {
        const ok = [], rech = [];
        b.p_filas.forEach((f) => { if (f.opcion === "ZZ") rech.push({ client_id: f.client_id, motivo: "tarea inexistente" });
          else { if (!db.find((x) => x.client_id === f.client_id)) db.push(f); ok.push(f.client_id); } });
        out = { ok, rechazados: rech };
      }
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(out));
    }); return;
  }
  const f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]) === "/" ? "index.html" : decodeURIComponent(req.url.split("?")[0]));
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  let txt = fs.readFileSync(f);
  if (f.endsWith("config.js")) txt = Buffer.from(txt.toString().replace(/https:\/\/[a-z]+\.supabase\.co/, "http://localhost:" + srv.address().port));
  res.writeHead(200, { "Content-Type": f.endsWith(".js") ? "application/javascript" : f.endsWith(".css") ? "text/css" : "text/html" });
  res.end(txt);
});
const fallas = [];
const chk = (c, m) => { if (!c) fallas.push(m); console.log((c ? "✓ " : "✗ ") + m); };
srv.listen(0, async () => {
  const url = "http://localhost:" + srv.address().port + "/";
  const br = await pw.chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? undefined : undefined });
  const pg = await br.newPage({ viewport: { width: 390, height: 800 } });
  try {
    await pg.goto(url);
    await pg.fill("#legajoInput", "99"); await pg.click("#legajoBtn");
    await pg.waitForFunction(() => document.getElementById("legajoError").textContent.length > 0);
    chk(await pg.isVisible("#legajoScreen"), "legajo inexistente no entra");
    await pg.fill("#legajoInput", "7"); await pg.click("#legajoBtn");
    await pg.waitForSelector(".box[data-cod=EP]");
    chk((await pg.$$(".box")).length === 3, "botonera armada desde gt_tareas (3 botones)");
    await pg.click(".box[data-cod=EP]"); await pg.fill("#textoInput", "OT-15"); await pg.click("#textoBtn");
    await pg.waitForFunction(() => document.getElementById("syncBadge").textContent.includes("al día"));
    chk(db.length === 1 && db[0].texto === "OT-15" && db[0].ts_inicio === null, "apertura EP con dato, ts_inicio NULL");
    chk(await pg.$eval(".box[data-cod=PB]", (e) => e.classList.contains("off")), "con EP abierta, otra tarea queda bloqueada");
    await pg.reload(); await pg.waitForSelector(".box[data-cod=EP].abierta");
    chk(true, "al recargar, EP sigue abierta (sesión del día + historial del servidor)");
    await pg.click(".box[data-cod=EP]");
    await pg.waitForFunction(() => document.getElementById("syncBadge").textContent.includes("al día"));
    chk(db.length === 2 && db[1].opcion === "EP" && db[1].ts_inicio === db[0].ts_cliente && db[1].texto === "OT-15", "cierre EP con ts_inicio = apertura");
    await pg.click(".box[data-cod=FJ]");
    await pg.waitForFunction(() => document.getElementById("syncBadge").textContent.includes("al día"));
    chk(db.length === 3 && db[2].opcion === "FJ", "evento FJ de un toque");
    await pg.evaluate(() => { const q = JSON.parse(localStorage.getItem("gt_queue_v1") || "[]");
      q.push({ client_id: "malo", legajo: "7", opcion: "ZZ", ts_cliente: new Date().toISOString() });
      localStorage.setItem("gt_queue_v1", JSON.stringify(q)); return window.__gt.flush(); });
    const q = await pg.evaluate(() => [JSON.parse(localStorage.getItem("gt_queue_v1")).length, JSON.parse(localStorage.getItem("gt_rechazados_v1")).length]);
    chk(q[0] === 0 && q[1] === 1, "fila rechazada sale de la cola y queda anotada (no traba)");
    await pg.click("#histBtn");
    chk((await pg.$$("#hist tr")).length === 4, "resumen de hoy con 3 registros");
  } catch (e) { fallas.push(String(e)); console.log("✗", e.message); }
  await br.close(); srv.close();
  console.log(fallas.length ? "ROJO: " + fallas.length : "VERDE");
  process.exit(fallas.length ? 1 : 0);
});

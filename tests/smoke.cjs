// Smoke de la app de operario GT con la base simulada (no pega a Supabase).
// Uso: node tests/smoke.cjs   (necesita playwright; Chromium en /opt/pw-browsers)
const path = require("path");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const http = require("http"), fs = require("fs");
const ROOT = path.join(__dirname, "..");
const AREAS = [
  { codigo: "CORTE", nombre: "Corte", unidad: "unidades cortadas", orden: 1 },
  { codigo: "GRAMP", nombre: "Grampeado", unidad: "unidades grampeadas", orden: 2 },
  { codigo: "DECO", nombre: "Deco", unidad: "unidades fabricadas", orden: 9 },
];
const db = [];
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const b = JSON.parse(body || "{}"), fn = req.url.split("/").pop();
      let out;
      if (fn === "gt_clave_actual") out = { clave: "1234", cambia_en_s: 42 };
      else if (fn === "gt_clave_validar") out = b.p_clave === "1234" ? { ok: true, empleados: [{ id: 7, nombre: "Prueba" }, { id: 8, nombre: "Otro" }] } : { ok: false };
      else if (fn === "gt_areas") out = AREAS;
      else if (fn === "gt_registros_hoy") out = db.filter((r) => r.empleado_id === b.p_empleado);
      else if (fn === "gt_registrar") {
        const ok = [], rech = [];
        b.p_filas.forEach((f) => { if (!AREAS.find((a) => a.codigo === f.rubro)) rech.push({ client_id: f.client_id, motivo: "área inexistente" });
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
    await pg.fill("#claveInput", "9999"); await pg.click("#claveBtn");
    await pg.waitForFunction(() => document.getElementById("claveError").textContent.length > 0);
    chk(await pg.isVisible("#claveScreen"), "código equivocado no entra");
    await pg.fill("#claveInput", "1234"); await pg.click("#claveBtn");
    await pg.waitForSelector("#nombreLista button");
    chk((await pg.$$("#nombreLista button")).length === 2, "con el código bueno aparece la lista de nombres");
    await pg.click("#nombreLista button[data-id='7']");
    await pg.waitForSelector(".box[data-cod=CORTE]");
    chk((await pg.textContent("#opName")) === "Prueba", "entra con el nombre elegido");
    chk((await pg.$$(".box")).length === 3, "botonera = las áreas de gt_areas (3)");
    const alDia = () => pg.waitForFunction(() => document.getElementById("syncBadge").textContent.includes("al día"));
    await pg.click(".box[data-cod=CORTE]"); await alDia();
    chk(db.length === 1 && db[0].opcion === "AREA" && db[0].rubro === "CORTE" && db[0].ts_inicio === null, "Empecé Corte: apertura con ts_inicio NULL");
    await pg.reload(); await pg.waitForSelector(".box[data-cod=CORTE].abierta");
    chk(true, "al recargar, Corte sigue abierta (sesión del día + historial del servidor)");
    await pg.click(".box[data-cod=GRAMP]"); await pg.waitForSelector("#cantScreen:not(.hidden)");
    chk((await pg.textContent("#cantSub")).includes("Grampeado") && (await pg.textContent("#cantLabel")).includes("unidades cortadas"),
        "tocar otra área pide la cantidad de la abierta, con su unidad");
    await pg.fill("#cantInput", "abc"); await pg.click("#cantBtn");
    chk((await pg.textContent("#cantError")).length > 0 && db.length === 1, "cantidad no numérica no se registra");
    await pg.fill("#cantInput", "120"); await pg.click("#cantBtn"); await alDia();
    chk(db.length === 3 && db[1].rubro === "CORTE" && db[1].cantidad === 120 && db[1].ts_inicio === db[0].ts_cliente,
        "Terminé Corte: cierre con cantidad 120 y ts_inicio = apertura");
    chk(db[2].rubro === "GRAMP" && db[2].ts_inicio === null, "y empezó Grampeado en el mismo paso");
    await pg.click(".box[data-cod=GRAMP]"); await pg.fill("#cantInput", "0"); await pg.click("#cantBtn"); await alDia();
    chk(db.length === 4 && db[3].cantidad === 0 && !(await pg.$(".box.abierta")), "Terminé Grampeado con 0, sin área abierta");
    await pg.evaluate(() => { const q = JSON.parse(localStorage.getItem("gt_queue_v3") || "[]");
      q.push({ client_id: "malo", empleado_id: 7, opcion: "AREA", rubro: "NOEXISTE", ts_cliente: new Date().toISOString() });
      localStorage.setItem("gt_queue_v3", JSON.stringify(q)); return window.__gt.flush(); });
    const q = await pg.evaluate(() => [JSON.parse(localStorage.getItem("gt_queue_v3")).length, JSON.parse(localStorage.getItem("gt_rechazados_v3")).length]);
    chk(q[0] === 0 && q[1] === 1, "fila rechazada sale de la cola y queda anotada (no traba)");
    await pg.click("#histBtn");
    chk((await pg.$$("#hist tr")).length === 3, "resumen de hoy con 2 tramos");
    chk(db.every((r) => r.empleado_id === 7), "los registros llevan el empleado_id");
    const ad = await br.newPage({ viewport: { width: 1280, height: 720 } });
    await ad.goto(url + "admin.html");
    await ad.waitForFunction(() => document.getElementById("clave").textContent === "1234");
    await ad.waitForFunction(() => document.getElementById("seg").textContent !== "--");
    const seg = Number(await ad.textContent("#seg"));
    chk(seg > 0 && seg <= 42, "monitor admin muestra el código y la cuenta regresiva (" + seg + " s)");
  } catch (e) { fallas.push(String(e)); console.log("✗", e.message); }
  await br.close(); srv.close();
  console.log(fallas.length ? "ROJO: " + fallas.length : "VERDE");
  process.exit(fallas.length ? 1 : 0);
});

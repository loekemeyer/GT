// Smoke de la app de operario GT con la base simulada (no pega a Supabase).
// Uso: node tests/smoke.cjs   (necesita playwright; Chromium en /opt/pw-browsers)
const path = require("path");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const http = require("http"), fs = require("fs");
const ROOT = path.join(__dirname, "..");
const AREAS = [
  { codigo: "CORTE", nombre: "Corte", unidad: "unidades cortadas", orden: 1 },
  { codigo: "GRAMP", nombre: "Grampeado", unidad: "unidades grampeadas", orden: 2, pide_codigo: true },
  { codigo: "PED", nombre: "Pedidos", unidad: "pedidos armados", orden: 8, pide_cantidad: false },
  { codigo: "DECO", nombre: "Deco", unidad: "unidades fabricadas", orden: 9 },
  { codigo: "GUARD", nombre: "Guardado a góndola", unidad: "cajas guardadas", orden: 10, pide_codigo: true },
];
let CLAVE_MON = null;
const db = [];
const CODIGOS = [{ codigo: "505", descripcion: "Pinza", medida: "10*15", rubro: "GRAMP" }, { codigo: "760", descripcion: "Otra", medida: null, rubro: "DECO" }];
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const b = JSON.parse(body || "{}"), fn = req.url.split("/").pop();
      let out;
      if (fn === "gt_monitor_clave") out = !CLAVE_MON ? { ok: true, sin_clave: true, clave: "1234", cambia_en_s: 42 } : b.p_pass === CLAVE_MON ? { ok: true, clave: "1234", cambia_en_s: 42 } : { ok: false };
      else if (fn === "gt_clave_validar") out = b.p_clave === "1234" ? { ok: true, empleados: [{ id: 7, nombre: "Prueba" }, { id: 8, nombre: "Otro" }] } : { ok: false };
      else if (fn === "gt_botones") out = AREAS;
      else if (fn === "gt_codigos_area") out = CODIGOS;
      else if (fn === "gt_contraido_pendiente") out = [{ codigo: "760", descripcion: "Otra", cajas: 12 }];
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
    chk((await pg.$$(".box")).length === 5, "botonera = las áreas de gt_botones (5)");
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
    chk(db.length === 2 && db[1].rubro === "CORTE" && db[1].cantidad === 120 && db[1].ts_inicio === db[0].ts_cliente,
        "Terminé Corte: cierre con cantidad 120 y ts_inicio = apertura");
    await pg.waitForSelector("#codScreen:not(.hidden)");
    chk((await pg.textContent("#codLabel")) === "¿Qué vas a grampear?", "Grampeado pregunta «¿Qué vas a grampear?»");
    await pg.fill("#codInput", "999"); await pg.click("#codBtn");
    chk((await pg.textContent("#codError")).includes("no está en la lista") && db.length === 2, "código fuera de la lista no se acepta");
    await pg.fill("#codInput", "0505"); await pg.click("#codBtn"); await alDia();
    chk(db.length === 3 && db[2].rubro === "GRAMP" && db[2].texto === "505" && db[2].ts_inicio === null, "empezó Grampeado: «0505» se guarda como 505 (sin importar los ceros)");
    chk((await pg.textContent("#abiertaBox")).includes("505"), "el área abierta muestra el código");
    await pg.click(".box[data-cod=GRAMP]"); await pg.waitForSelector("#cantScreen:not(.hidden)");
    chk((await pg.textContent("#cantLabel")).includes("del 505"), "al terminar pregunta la cantidad del 505");
    await pg.fill("#cantInput", "0"); await pg.click("#cantBtn"); await alDia();
    chk(db.length === 4 && db[3].cantidad === 0 && db[3].texto === "505" && !(await pg.$(".box.abierta")), "Terminé Grampeado 505 con 0, sin área abierta");
    await pg.click(".box[data-cod=DECO]"); await alDia();
    chk(db.length === 5 && db[4].rubro === "DECO" && !(await pg.isVisible("#codScreen")), "un área sin código (Deco) empieza directo");
    await pg.click(".box[data-cod=DECO]"); await pg.fill("#cantInput", "7"); await pg.click("#cantBtn"); await alDia();
    await pg.click(".box[data-cod=PED]"); await alDia();
    await pg.click(".box[data-cod=PED]"); await alDia();
    chk(db.length === 8 && db[7].rubro === "PED" && db[7].ts_inicio && db[7].cantidad == null && !(await pg.isVisible("#cantScreen")),
        "Pedidos se termina sin preguntar cantidad");
    await pg.click(".box[data-cod=GUARD]"); await pg.waitForSelector("#codScreen:not(.hidden)");
    await pg.waitForSelector("#codPend button[data-cod='760']");
    chk((await pg.textContent("#codPend")).includes("12 cajas"), "Guardado muestra lo que salió de Contraído (760 · 12 cajas)");
    await pg.click("#codPend button[data-cod='760']"); await alDia();
    chk(db.length === 9 && db[8].rubro === "GUARD" && db[8].texto === "760", "tocar el pendiente empieza Guardado con ese código");
    await pg.click(".box[data-cod=GUARD]"); await pg.fill("#cantInput", "3"); await pg.click("#cantBtn"); await alDia();
    await pg.evaluate(() => { const q = JSON.parse(localStorage.getItem("gt_queue_v3") || "[]");
      q.push({ client_id: "malo", empleado_id: 7, opcion: "AREA", rubro: "NOEXISTE", ts_cliente: new Date().toISOString() });
      localStorage.setItem("gt_queue_v3", JSON.stringify(q)); return window.__gt.flush(); });
    const q = await pg.evaluate(() => [JSON.parse(localStorage.getItem("gt_queue_v3")).length, JSON.parse(localStorage.getItem("gt_rechazados_v3")).length]);
    chk(q[0] === 0 && q[1] === 1, "fila rechazada sale de la cola y queda anotada (no traba)");
    await pg.click("#histBtn");
    chk((await pg.$$("#hist tr")).length === 6, "resumen de hoy con 5 tramos");
    chk(db.every((r) => r.empleado_id === 7), "los registros llevan el empleado_id");
    const ad = await br.newPage({ viewport: { width: 1280, height: 720 } });
    await ad.goto(url + "admin.html");
    await ad.waitForFunction(() => document.getElementById("clave").textContent === "1234");
    chk(true, "sin clave configurada en la base, el monitor muestra el código (como antes)");
    CLAVE_MON = "151515"; await ad.reload();
    await ad.waitForSelector("#login:not(.hidden)");
    chk(!(await ad.isVisible("#monitor")), "monitor sin clave no muestra el código");
    await ad.fill("#passInput", "111111"); await ad.click("#passBtn");
    await ad.waitForFunction(() => document.getElementById("passError").textContent.length > 0);
    chk((await ad.textContent("#clave")) !== "1234", "clave equivocada no muestra el código");
    await ad.fill("#passInput", "151515"); await ad.click("#passBtn");
    await ad.waitForFunction(() => document.getElementById("clave").textContent === "1234");
    await ad.reload(); await ad.waitForFunction(() => document.getElementById("clave").textContent === "1234");
    chk(true, "con la clave buena muestra el código y la recuerda al recargar");
    await ad.waitForFunction(() => document.getElementById("seg").textContent !== "--");
    const seg = Number(await ad.textContent("#seg"));
    chk(seg > 0 && seg <= 42, "monitor admin muestra el código y la cuenta regresiva (" + seg + " s)");
  } catch (e) { fallas.push(String(e)); console.log("✗", e.message); }
  await br.close(); srv.close();
  console.log(fallas.length ? "ROJO: " + fallas.length : "VERDE");
  process.exit(fallas.length ? 1 : 0);
});

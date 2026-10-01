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
  { codigo: "RECIB", nombre: "Recibir mercadería", unidad: "unidades recibidas", orden: 11, pide_codigo: true },
];
let CLAVE_MON = null;
const db = [];
const CODIGOS = [{ codigo: "505", descripcion: "Pinza", medida: "10*15", rubro: "GRAMP" }, { codigo: "760", descripcion: "Otra", medida: null, rubro: "DECO" },
  { codigo: "INSUMO", descripcion: "Insumo", medida: null, rubro: "RECIB" }, { codigo: "MOLDURA", descripcion: "Moldura", medida: null, rubro: "RECIB" }];
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
    chk((await pg.$$(".box")).length === 6, "botonera = las áreas de gt_botones (6)");
    const alDia = () => pg.waitForFunction(() => document.getElementById("syncBadge").textContent.includes("al día"));
    await pg.click(".box[data-cod=CORTE]"); await alDia();
    chk(db.length === 1 && db[0].opcion === "AREA" && db[0].rubro === "CORTE" && db[0].ts_inicio === null, "Empecé Corte: apertura con ts_inicio NULL");
    await pg.reload(); await pg.waitForSelector(".box[data-cod=CORTE].abierta");
    chk(true, "al recargar, Corte sigue abierta (sesión del día + historial del servidor)");
    const termino = async (cod) => { await pg.click(".box[data-cod=" + cod + "]"); await pg.waitForSelector("#cantScreen:not(.hidden)"); };
    await termino("GRAMP");
    chk((await pg.textContent("#cantLabel")).includes("unidades cortadas") &&
        (await pg.textContent("#sigueLabel")) === "¿Con qué código seguís en Grampeado?",
        "tocar otra área: pide la cantidad de la abierta y, en la misma pantalla, el código para seguir en la nueva");
    await pg.fill("#cantInput", "abc"); await pg.click("#cantBtn");
    chk((await pg.textContent("#cantError")).length > 0 && db.length === 1, "cantidad no numérica no se registra");
    await pg.fill("#cantInput", "120"); await pg.fill("#sigueInput", "999"); await pg.click("#cantBtn");
    chk((await pg.textContent("#sigueError")).includes("¿Lo registro igual?") && db.length === 1 &&
        (await pg.textContent("#cantBtn")).includes("registrar el 999"), "código que no está en la lista: pregunta antes de grabar");
    chk(!(await pg.$("#sigueInput[list]")) && (await pg.getAttribute("#sigueInput", "inputmode")) === "numeric",
        "sin lista desplegable (no tapa el campo) y teclado numérico si los códigos son números");
    await pg.fill("#sigueInput", "0505");
    chk((await pg.textContent("#sigueHint")) === "Pinza · 10*15", "al tipear muestra qué es el código (Pinza · 10*15)");
    await pg.click("#cantBtn"); await alDia();
    chk(db.length === 3 && db[1].rubro === "CORTE" && db[1].cantidad === 120 && db[1].ts_inicio === db[0].ts_cliente &&
        db[2].rubro === "GRAMP" && db[2].texto === "505" && db[2].ts_inicio === null,
        "Terminé Corte 120 y empezó Grampeado 505 («0505») en el mismo paso");
    chk((await pg.textContent("#abiertaBox")).includes("505"), "el área abierta muestra el código");
    await termino("GRAMP");
    chk((await pg.textContent("#sigueLabel")).includes("en Grampeado") && (await pg.textContent("#cantLabel")).includes("del 505"),
        "al terminar, por defecto propone seguir en la MISMA área");
    await pg.fill("#cantInput", "0"); await pg.fill("#sigueInput", "777"); await pg.click("#cantBtn");
    chk(db.length === 3 && (await pg.textContent("#sigueHint")).includes("No está en la lista"), "código nuevo: avisa y espera la confirmación");
    await pg.click("#cantBtn"); await alDia();
    chk(db.length === 5 && db[3].cantidad === 0 && db[3].texto === "505" && db[4].rubro === "GRAMP" && db[4].texto === "777" && !db[4].ts_inicio,
        "confirmado, registra el código nuevo y sigue en Grampeado");
    await termino("GRAMP"); await pg.fill("#cantInput", "4"); await pg.click("#cambioBtn"); await alDia();
    chk(db.length === 6 && db[5].cantidad === 4 && !(await pg.$(".box.abierta")), "«Cambiar de área / no sigo» cierra sin abrir otra");
    await pg.click(".box[data-cod=DECO]"); await alDia();
    chk(db.length === 7 && db[6].rubro === "DECO" && !(await pg.isVisible("#codScreen")), "un área sin código (Deco) empieza directo");
    await termino("DECO");
    chk(!(await pg.isVisible("#sigueInput")), "si el área no pide código, no muestra el campo de código siguiente");
    await pg.fill("#cantInput", "7"); await pg.click("#cambioBtn"); await alDia();
    await pg.click(".box[data-cod=PED]"); await alDia();
    await termino("PED");
    chk(!(await pg.isVisible("#cantInput")), "Pedidos no pregunta cantidad al terminar");
    await pg.click("#cambioBtn"); await alDia();
    chk(db.length === 10 && db[9].rubro === "PED" && db[9].ts_inicio && db[9].cantidad == null, "Pedidos se termina sin cantidad");
    await pg.click(".box[data-cod=GUARD]"); await pg.waitForSelector("#codScreen:not(.hidden)");
    await pg.waitForSelector("#codPend button[data-cod='760']");
    chk((await pg.textContent("#codPend")).includes("12 cajas"), "Guardado muestra lo que salió de Contraído (760 · 12 cajas)");
    await pg.fill("#codInput", "505"); await pg.click("#codBtn");
    chk((await pg.textContent("#codError")).includes("no salió de Contraído") && db.length === 10,
        "Guardado con un código que no salió de Contraído: avisa y pide confirmar");
    await pg.fill("#codInput", "");
    await pg.click("#codPend button[data-cod='760']"); await alDia();
    chk(db.length === 11 && db[10].rubro === "GUARD" && db[10].texto === "760", "tocar el pendiente empieza Guardado con ese código");
    await termino("GUARD"); await pg.waitForSelector("#siguePend button[data-cod='760']");
    chk(true, "al terminar Guardado, los pendientes de Contraído aparecen también para seguir");
    await pg.fill("#cantInput", "3"); await pg.click("#cambioBtn"); await alDia();
    await pg.click(".box[data-cod=RECIB]"); await pg.waitForSelector("#codOpts button[data-cod='MOLDURA']");
    chk((await pg.textContent("#codLabel")) === "¿Insumo o Moldura?" && !(await pg.isVisible("#codInput")),
        "Recibir mercadería pregunta «¿Insumo o Moldura?» con botones, sin teclado");
    await pg.click("#codOpts button[data-cod='MOLDURA']"); await alDia();
    const nR = db.length;
    chk(db[nR - 1].rubro === "RECIB" && db[nR - 1].texto === "MOLDURA", "elegir Moldura empieza Recibir con MOLDURA");
    await termino("RECIB");
    chk(await pg.isVisible("#sigueOpts button[data-cod='INSUMO']") && !(await pg.isVisible("#sigueInput")), "al terminar, para seguir también ofrece Insumo / Moldura");
    await pg.fill("#cantInput", "40"); await pg.click("#cambioBtn"); await alDia();
    chk(db.length === nR + 1 && db[nR].cantidad === 40 && db[nR].texto === "MOLDURA", "Terminé Recibir moldura con 40");
    await pg.evaluate(() => { const q = JSON.parse(localStorage.getItem("gt_queue_v3") || "[]");
      q.push({ client_id: "malo", empleado_id: 7, opcion: "AREA", rubro: "NOEXISTE", ts_cliente: new Date().toISOString() });
      localStorage.setItem("gt_queue_v3", JSON.stringify(q)); return window.__gt.flush(); });
    const q = await pg.evaluate(() => [JSON.parse(localStorage.getItem("gt_queue_v3")).length, JSON.parse(localStorage.getItem("gt_rechazados_v3")).length]);
    chk(q[0] === 0 && q[1] === 1, "fila rechazada sale de la cola y queda anotada (no traba)");
    await pg.click("#histBtn");
    const nh = (await pg.$$("#hist .hist-row")).length; chk(nh === 7, "resumen de hoy con 7 tramos (" + nh + ")");
    chk(db.every((r) => r.empleado_id === 7), "los registros llevan el empleado_id");
    chk(await pg.evaluate(() => window.__gt.verNum("1.10") > window.__gt.verNum("1.9") && window.__gt.verNum("2.0") > window.__gt.verNum("1.99")),
        "versiones: 1.10 es más nueva que 1.9, y 2.0 que 1.99");
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

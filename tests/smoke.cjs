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
  { codigo: "ALMU", nombre: "Almuerzo", unidad: "—", orden: 12, pide_codigo: false, pide_cantidad: false },
];
let CLAVE_MON = null; const LOGINS = [];
const db = [];
const CODIGOS = [{ codigo: "505", descripcion: "Pinza", medida: "10*15", rubro: "GRAMP" }, { codigo: "760", descripcion: "Otra", medida: null, rubro: "DECO" },
  { codigo: "INSUMO", descripcion: "Insumo", medida: null, rubro: "RECIB" }, { codigo: "MOLDURA", descripcion: "Moldura", medida: null, rubro: "RECIB" }];
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const b = JSON.parse(body || "{}"), fn = req.url.split("/").pop();
      let out;
      if (fn === "gt_monitor_clave") out = !CLAVE_MON ? { ok: true, sin_clave: true, clave: "1234", cambia_en_s: 42 } : b.p_pass === CLAVE_MON ? { ok: true, clave: "1234", cambia_en_s: 42 } : { ok: false };
      else if (fn === "gt_monitor_login") { LOGINS.push(b); out = { ok: b.p_pass === CLAVE_MON, en_horario: false }; }
      else if (fn === "gt_clave_validar") out = b.p_clave === "1234" ? { ok: true, empleados: [{ id: 7, nombre: "Prueba" }, { id: 8, nombre: "Otro" }] } : { ok: false };
      else if (fn === "gt_botones") out = AREAS;
      else if (fn === "gt_codigos_area") out = CODIGOS;
      else if (fn === "gt_admin_produccion") out = b.p_pass === CLAVE_MON ? [
        { empleado: "Prueba", area: "Encolado", rubro: "ENCOL", codigo: "080", descripcion: "Cuadro Ciudades MDF", desde: "2026-10-01T11:00:00Z", hasta: "2026-10-01T12:00:00Z", cantidad: 10, unidad: "cajas encoladas", uxb: 24, unidades: 240 },
        { empleado: "Prueba", area: "Corte", rubro: "CORTE", codigo: "1", descripcion: "03 Bco", desde: "2026-10-01T12:00:00Z", hasta: null, cantidad: null, unidad: "unidades cortadas", uxb: null, unidades: null }] : [];
      else if (fn === "gt_admin_asistencia") out = b.p_pass === CLAVE_MON ? [
        { empleado: "Prueba", legajo: "t1", entrada: "2026-10-01T08:12:00", entrada_prevista: "2026-10-01T08:00:00", almuerzo_sale: null, almuerzo_vuelve: null,
          almuerzo_desde: "2026-10-01T12:00:00", almuerzo_hasta: "2026-10-01T13:00:00", flexible: false, fin: null, salida_prevista: "2026-10-01T17:30:00",
          area_abierta: true, termino: false, tolerancia_min: 5 },
        { empleado: "Otro", legajo: "t2", entrada: null, entrada_prevista: "2026-10-01T08:00:00", almuerzo_sale: null, almuerzo_vuelve: null,
          almuerzo_desde: "2026-10-01T12:00:00", almuerzo_hasta: "2026-10-01T13:00:00", flexible: false, fin: null, salida_prevista: "2026-10-01T17:30:00",
          area_abierta: false, termino: false, tolerancia_min: 5 }] : [];
      else if (fn === "gt_contraido_pendiente") out = [{ codigo: "760", descripcion: "Otra", cajas: 12 }];
      else if (fn === "gt_registros_hoy") out = db.filter((r) => r.empleado_id === b.p_empleado);
      else if (fn === "gt_registrar") {
        const ok = [], rech = [];
        b.p_filas.forEach((f) => { if (f.opcion !== "FIN" && !AREAS.find((a) => a.codigo === f.rubro)) rech.push({ client_id: f.client_id, motivo: "área inexistente" });
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
    await pg.reload(); await pg.waitForSelector(".termine-btn[data-cod=CORTE]");
    chk(true, "al recargar, Corte sigue abierta (sesión del día + historial del servidor)");
    const termino = async (cod) => { await pg.click(".termine-btn[data-cod=" + cod + "]"); await pg.waitForSelector("#cantScreen:not(.hidden)"); };
    chk((await pg.$$("#botonera .box")).length === 0 && (await pg.$$("#botonera .termine-btn")).length === 1,
        "con un sector abierto, la botonera muestra SÓLO «Terminé» (no deja tocar otra área)");
    await termino("CORTE");
    chk((await pg.textContent("#cantLabel")).includes("unidades cortadas"), "«Terminé» pide cuánto hizo, en la unidad del área");
    await pg.fill("#cantInput", "abc"); await pg.click("#cambioBtn");
    chk((await pg.textContent("#cantError")).length > 0 && db.length === 1, "cantidad no numérica no se registra");
    await pg.fill("#cantInput", "120"); await pg.click("#cambioBtn"); await alDia();
    chk((await pg.$$("#botonera .box")).length === 6, "cerrado el sector, vuelven todas las áreas");
    await pg.click(".box[data-cod=GRAMP]"); await pg.waitForSelector("#codScreen:not(.hidden)");
    await pg.fill("#codInput", "999"); await pg.click("#codBtn");
    chk((await pg.textContent("#codError")).includes("¿Lo registro igual?") && db.length === 2, "código que no está en la lista: pregunta antes de grabar");
    chk(!(await pg.$("#codInput[list]")) && (await pg.getAttribute("#codInput", "inputmode")) === "numeric",
        "sin lista desplegable (no tapa el campo) y teclado numérico si los códigos son números");
    await pg.fill("#codInput", "0505");
    chk((await pg.textContent("#codHint")) === "Pinza · 10*15", "al tipear muestra qué es el código (Pinza · 10*15)");
    await pg.click("#codBtn"); await alDia();
    chk(db.length === 3 && db[1].rubro === "CORTE" && db[1].cantidad === 120 && db[1].ts_inicio === db[0].ts_cliente &&
        db[2].rubro === "GRAMP" && db[2].texto === "505" && db[2].ts_inicio === null,
        "Terminé Corte 120 y empezó Grampeado 505 («0505»)");
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
    chk(!(await pg.isVisible("#sigueBox")) && (await pg.textContent("#cantBtn")) === "Listo", "al terminar Recibir NO pregunta qué sigue recibiendo (D29)");
    await pg.fill("#cantInput", "40"); await pg.click("#cantBtn"); await alDia();
    chk(db.length === nR + 1 && db[nR].cantidad === 40 && db[nR].texto === "MOLDURA", "Terminé Recibir moldura con 40");
    chk(!(await pg.$(".box[data-cod=ALMU]")) && await pg.isVisible("#almuBtn") && await pg.isVisible("#finBtn"),
        "Almuerzo y Terminar día son botones aparte, no tarjetas de área");
    // almuerzo con un área abierta: cierra el área (cantidad) y empieza el almuerzo
    await pg.click(".box[data-cod=CORTE]"); await alDia();
    chk(!(await pg.isVisible("#almuBtn")) && !(await pg.isVisible("#finBtn")), "con un sector abierto no están Almuerzo ni Terminar día (D31)");
    await termino("CORTE");
    chk(await pg.isVisible("#cantAlmuBtn") && await pg.isVisible("#cantFinBtn"), "«Terminé» ofrece «Me voy a almorzar» y «Terminé el día»");
    await pg.fill("#cantInput", "50"); await pg.click("#cantAlmuBtn"); await alDia();
    const nA = db.length;
    chk(db[nA - 1].rubro === "ALMU" && !db[nA - 1].ts_inicio && db[nA - 2].rubro === "CORTE" && db[nA - 2].cantidad === 50, "cerró Corte con 50 y empezó el almuerzo");
    chk((await pg.textContent("#almuBtn")).includes("Volví"), "el botón pasa a «Volví de almorzar»");
    await pg.click("#almuBtn"); await pg.waitForSelector("#cantScreen:not(.hidden)");
    chk(!(await pg.isVisible("#cantInput")) && (await pg.textContent("#sigueLabel")).includes("Corte"), "al volver, no pide cantidad y propone seguir en Corte (el área de antes)");
    await pg.click("#cantBtn"); await alDia();
    chk(db[db.length - 2].rubro === "ALMU" && db[db.length - 2].ts_inicio && db[db.length - 1].rubro === "CORTE", "volvió de almorzar y siguió en Corte");
    // terminar el día con Corte abierto
    await termino("CORTE");
    await pg.fill("#cantInput", "30"); await pg.click("#cantFinBtn"); await alDia();
    chk(db[db.length - 1].opcion === "FIN" && db[db.length - 2].rubro === "CORTE" && db[db.length - 2].cantidad === 30, "cerró Corte y registró el fin del día");
    chk((await pg.textContent("#abiertaBox")).includes("Día terminado"), "la botonera muestra «Día terminado»");
    await pg.evaluate(() => { const q = JSON.parse(localStorage.getItem("gt_queue_v3") || "[]");
      q.push({ client_id: "malo", empleado_id: 7, opcion: "AREA", rubro: "NOEXISTE", ts_cliente: new Date().toISOString() });
      localStorage.setItem("gt_queue_v3", JSON.stringify(q)); return window.__gt.flush(); });
    const q = await pg.evaluate(() => [JSON.parse(localStorage.getItem("gt_queue_v3")).length, JSON.parse(localStorage.getItem("gt_rechazados_v3")).length]);
    chk(q[0] === 0 && q[1] === 1, "fila rechazada sale de la cola y queda anotada (no traba)");
    await pg.click("#histBtn");
    const nh = (await pg.$$("#hist .hist-row")).length; chk(nh === 11, "resumen de hoy con 10 tramos + fin del día (" + nh + ")");
    chk(await pg.isVisible("#histPop") && await pg.evaluate(() => getComputedStyle(document.getElementById("histPop")).position === "fixed"),
        "el Resumen de hoy se abre como pop-up (no se despliega abajo)");
    await pg.click("#histCerrar"); chk(!(await pg.isVisible("#histPop")), "el ✕ cierra el pop-up");
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
    chk(LOGINS.length === 2 && LOGINS[1].p_dispositivo && LOGINS[1].p_navegador,
        "cada clave TIPEADA pasa por gt_monitor_login con el equipo (la lectura de cada minuto no cuenta)");
    // la clave guardada vence el lunes 07:00: una guardada hace 8 días ya no vale
    await ad.evaluate(() => localStorage.setItem("gt_monitor_pass_ts", String(Date.now() - 8 * 864e5)));
    await ad.reload(); await ad.waitForSelector("#login:not(.hidden)");
    chk((await ad.textContent("#passError")).includes("lunes"), "clave guardada antes del último lunes 07:00 vence y la pide de nuevo");
    await ad.fill("#passInput", "151515"); await ad.click("#passBtn");
    await ad.waitForFunction(() => document.getElementById("clave").textContent === "1234");
    await ad.waitForFunction(() => document.getElementById("seg").textContent !== "--");
    const seg = Number(await ad.textContent("#seg"));
    chk(seg > 0 && seg <= 42, "monitor admin muestra el código y la cuenta regresiva (" + seg + " s)");
    await ad.click(".tab[data-tab=prod]"); await ad.waitForSelector("#prodArea table");
    chk((await ad.textContent("#prodArea")).includes("240") && (await ad.textContent("#prodOp")).includes("en curso"),
        "Producción: por área con unidades (10 cajas × 24 = 240) y lo en curso");
    await ad.click(".tab[data-tab=asis]"); await ad.fill("#asisDia", "2026-09-30"); await ad.dispatchEvent("#asisDia", "change");
    await ad.waitForFunction(() => document.getElementById("asisTabla").textContent.includes("No terminó"));
    const asis = await ad.textContent("#asisTabla");
    chk(asis.includes("Llegó tarde") && asis.includes("No vino") && asis.includes("Sin almuerzo") && asis.includes("No terminó el día"),
        "Asistencia: llegó tarde, no vino, sin almuerzo y no terminó el día");
    await ad.click("#salirMon"); await ad.click(".tab[data-tab=prod]"); await ad.waitForTimeout(800); await ad.waitForSelector("#login:not(.hidden)");
    chk(!(await ad.isVisible("#prod")), "sin clave, Producción no muestra datos y pide la clave");
  } catch (e) { fallas.push(String(e)); console.log("✗", e.message); }
  await br.close(); srv.close();
  console.log(fallas.length ? "ROJO: " + fallas.length : "VERDE");
  process.exit(fallas.length ? 1 : 0);
});

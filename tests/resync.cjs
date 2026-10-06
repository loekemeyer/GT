// 1.56 (06/10/2026: «Juan Gimenez no puede finalizar la tarea que estaba haciendo en Corte»). En la base de Juan: Corte 307
// abierto a las 13:02:31 que NUNCA se cerró, y otra apertura del mismo 307 a las 13:47:18. Cómo se llega ahí: el celular
// arma lo que hay abierto con lo que trajo la base al entrar (cargarHoy) + la cola. Dos huecos:
//   · si al recargar esa llamada falla, el celular se arma sólo con la cola: la botonera muestra las áreas y no el «Terminé»
//     de lo que está abierto, y nunca más lo vuelve a pedir;
//   · si un envío (flush) se cruza con esa llamada, lo que acaba de guardarse desaparece: ya no está en la cola y la
//     respuesta de la base (anterior al envío) lo pisa.
// Acá: recargar con la base caída (con y sin lo del día guardado en el celular), tocar Corte con la base ya de vuelta, el
// reintento al volver la red y el cruce entre el envío y la lectura. Con la 1.55 fallan todos.
// Uso: node tests/resync.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const A = (codigo, nombre, orden, x) => Object.assign({ codigo, nombre, unidad: "unidades cortadas", orden, planta: "PELL", pide_codigo: false, pide_cantidad: true }, x || {});
const AREAS = [A("CORTE", "Corte", 1, { pide_codigo: true }), A("MOVIM", "Movimientos", 30, { pide_cantidad: false }), A("BANO", "Baño", 31, { pide_cantidad: false })];
const CODS = [{ rubro: "CORTE", codigo: "025", descripcion: "03 Bco", medida: "25 cm" }];
const filas = [];
const ctl = { hoyFalla: false, hoyDemora: 0 };
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop(), b = body ? JSON.parse(body) : {};
      const resp = (out, ms) => setTimeout(() => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(out)); }, ms || 0);
      if (fn === "gt_registros_hoy3" || fn === "gt_registros_hoy2") {   // la 2 es la de reserva: con la base caída fallan las dos
        if (ctl.hoyFalla) { res.writeHead(500, { "Content-Type": "application/json" }); res.end('{"message":"caída"}'); return; }
        const foto = filas.filter((f) => f.empleado_id === b.p_empleado).map((f) => JSON.parse(JSON.stringify(f)));   // la foto se saca al llegar el pedido
        resp(foto, ctl.hoyDemora); return;
      }
      if (fn === "gt_registrar") (b.p_filas || []).forEach((f) => { if (!filas.some((x) => x.client_id === f.client_id)) filas.push(f); });
      const out = fn === "gt_clave_validar" ? { ok: true, principal: "PELL", empleados: [{ id: 4, nombre: "Juan Gimenez", plantas: [] }] }
        : fn.startsWith("gt_botones") ? AREAS : fn === "gt_codigos_area2" ? CODS
        : fn === "gt_registrar" ? { ok: (b.p_filas || []).map((f) => f.client_id), rechazados: [] } : [];
      resp(out);
    }); return;
  }
  const f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]) === "/" ? "index.html" : decodeURIComponent(req.url.split("?")[0]));
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  let txt = fs.readFileSync(f);
  if (f.endsWith("config.js")) txt = Buffer.from(txt.toString().replace(/https:\/\/[a-z]+\.supabase\.co/, "http://localhost:" + srv.address().port));
  res.writeHead(200, { "Content-Type": f.endsWith(".js") ? "application/javascript" : f.endsWith(".css") ? "text/css" : f.endsWith(".json") ? "application/json" : "text/html" });
  res.end(txt);
});
const fallas = [];
const chk = (c, m) => { if (!c) fallas.push(m); console.log((c ? "✓ " : "✗ ") + m); };
srv.listen(0, async () => {
  const url = "http://localhost:" + srv.address().port + "/";
  const br = await pw.chromium.launch();
  try {
    const ctx = await br.newContext({ viewport: { width: 390, height: 664 } });
    const pg = await ctx.newPage();
    const termine = () => pg.isVisible(".termine-btn[data-cod=CORTE]");
    const esperar = async () => { await pg.waitForSelector("#optionsScreen:not(.hidden)"); await pg.waitForSelector(".termine-btn, .box"); await pg.waitForTimeout(400); };
    const recargar = async () => { await pg.reload(); await esperar(); };
    const aperturas = () => filas.filter((f) => f.rubro === "CORTE" && !f.ts_inicio).length;
    await pg.goto(url); await pg.fill("#claveInput", "1234"); await pg.click("#claveBtn");
    await pg.click("#nombreLista button[data-id='4']"); await pg.waitForSelector("#avisoPop:not(.hidden)"); await pg.waitForTimeout(450); await pg.click("#avisoBtns button[data-i='0']");
    await pg.waitForSelector(".box[data-cod=CORTE]");
    await pg.click(".box[data-cod=CORTE]"); await pg.fill("#codInput", "025"); await pg.click("#codBtn");
    await pg.waitForSelector(".termine-btn[data-cod=CORTE]"); await pg.evaluate(() => window.__gt.flush()); await pg.waitForTimeout(200);
    chk(aperturas() === 1, "Juan empieza Corte y la base lo tiene (1 apertura)");

    // 1) recarga con la base caída: sigue viendo su Corte abierto (lo que el celular ya sabía)
    ctl.hoyFalla = true; await recargar();
    chk(await termine(), "recarga con la base caída: sigue viendo «✅ Terminé» de su Corte (no la botonera de áreas)");

    // 2) el celular no sabe lo de hoy (celular nuevo, sin lo guardado) y la base está caída: avisa que falta, no dice «al día»
    await pg.evaluate(() => localStorage.removeItem("gt_hoy_v1")); await recargar();
    const insignia = (await pg.textContent("#syncBadge")).trim();
    chk(/sin conexión/i.test(insignia), "sin poder traer lo de hoy (la base caída), la insignia avisa «" + insignia + "» y no «✓ al día»");

    // 3) la base vuelve y toca Corte antes de que el celular lo reintente: ve su Corte abierto, no abre otro
    ctl.hoyFalla = false; await pg.click(".box[data-cod=CORTE]"); await pg.waitForTimeout(800);
    chk(await termine() && !(await pg.isVisible("#codScreen")) && aperturas() === 1,
        "tocar Corte con la base ya de vuelta: aparece su «✅ Terminé» y no se abre un segundo Corte (aperturas: " + aperturas() + ")");

    // 4) sin tocar nada, al volver la red el celular trae lo de hoy solo
    ctl.hoyFalla = true; await pg.evaluate(() => localStorage.removeItem("gt_hoy_v1")); await recargar();
    chk(!(await termine()), "(sin lo del día y sin red la botonera muestra las áreas: no puede saber más)");
    ctl.hoyFalla = false; await pg.evaluate(() => window.dispatchEvent(new Event("online"))); await pg.waitForTimeout(1200);
    chk(await termine(), "vuelve la red: trae lo de hoy solo y aparece «✅ Terminé» sin recargar");

    // 5) el cruce: hay un cierre sin enviar en la cola, y el envío se cruza con la lectura de lo de hoy
    const ap = filas.find((f) => f.rubro === "CORTE" && !f.ts_inicio);
    await pg.evaluate((ap) => {
      const q = [{ client_id: "cierre-juan", empleado_id: 4, opcion: "AREA", rubro: "CORTE", descripcion: "Corte", texto: "025", cantidad: 50,
                   ts_cliente: new Date().toISOString(), ts_inicio: ap.ts_cliente, dispositivo: "prueba", planta: "PELL" }];
      localStorage.setItem("gt_queue_v3", JSON.stringify(q));
    }, ap);
    ctl.hoyDemora = 1500;
    await pg.reload();
    await pg.waitForTimeout(150); await pg.evaluate(() => window.dispatchEvent(new Event("online")));   // el envío sale mientras la lectura sigue en camino
    await pg.waitForTimeout(2600);
    chk(filas.some((f) => f.client_id === "cierre-juan"), "la base guardó el cierre");
    chk(!(await termine()), "el cierre guardado no desaparece del celular: Corte figura cerrado (con la 1.55 reaparece abierto)");
    ctl.hoyDemora = 0;
    await pg.close();
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? `\n${fallas.length} falla(s)` : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

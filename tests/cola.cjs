// 1.57 (D89 y D90, Elías 06/10/2026): lo que le faltaba a la cola de GT frente a Gestión Virgilio y Registro-Produccion-2.0.
//   A) la cola se reintenta cada 5 s (no 30), el celular avisa a la base el error de envío (el primer fallo y el 5.º) y que se recuperó
//   B) una fila mala no traba a las demás: la rechazada sale de la cola y va a «rechazados», la que la base no pudo guardar por un error
//      pasajero (`reintentar`) se queda y entra en el reintento siguiente, las buenas entran
//   C) el espejo en IndexedDB: lo que se encola queda copiado, y si el localStorage pierde la cola se recupera de la copia
//   D) el service worker manda la cola SOLO (Background Sync), con la página fallando, y la página lo reconoce: la fila sale de su cola
//      y no se manda dos veces. Y lo que el service worker ve rechazado llega a «rechazados»
//   E) sin IndexedDB (modo privado) la cola sigue andando como en la 1.56
// Uso: node tests/cola.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const A = (codigo, nombre, orden, x) => Object.assign({ codigo, nombre, unidad: "unidades cortadas", orden, planta: "PELL", pide_codigo: false, pide_cantidad: false }, x || {});
const AREAS = [A("MOVIM", "Movimientos", 30), A("BANO", "Baño", 31)];
let filas = [];
const ctl = { modo: "ok", reint: false, intentos: [], logs: [] };
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop(), b = body ? JSON.parse(body) : {};
      const resp = (out) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(out)); };
      if (fn === "gt_registrar") {
        const deSW = /sw\.js/.test(req.headers.referer || "");
        ctl.intentos.push({ deSW, n: (b.p_filas || []).length, t: Date.now() });
        if (ctl.modo === "500" || (ctl.modo === "soloSW" && !deSW)) { res.writeHead(500, { "Content-Type": "application/json" }); res.end('{"message":"caída simulada"}'); return; }
        const ok = [], rechazados = [], reintentar = [];
        (b.p_filas || []).forEach((f) => {
          if (f.texto === "RECH") rechazados.push({ client_id: f.client_id, motivo: "error de dato: prueba" });
          else if (f.texto === "REINT" && ctl.reint) reintentar.push(f.client_id);
          else { if (!filas.some((x) => x.client_id === f.client_id)) filas.push(f); ok.push(f.client_id); }
        });
        resp({ ok, rechazados, reintentar }); return;
      }
      if (fn === "gt_log_envio") { ctl.logs.push(b); resp(null); return; }
      resp(fn === "gt_clave_validar" ? { ok: true, principal: "PELL", empleados: [{ id: 4, nombre: "Juan Gimenez", plantas: [] }] }
        : fn.startsWith("gt_botones") ? AREAS : fn === "gt_registros_hoy3" || fn === "gt_registros_hoy2" ? filas.filter((f) => f.empleado_id === b.p_empleado) : []);
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
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function hasta(fn, ms, paso) { const fin = Date.now() + ms; while (Date.now() < fin) { if (await fn()) return true; await dormir(paso || 200); } return !!(await fn()); }
const reset = () => { filas = []; ctl.modo = "ok"; ctl.reint = false; ctl.intentos = []; ctl.logs = []; };

srv.listen(0, async () => {
  const url = "http://localhost:" + srv.address().port + "/";
  const br = await pw.chromium.launch();
  const sesion = async (ctx) => {
    const pg = await ctx.newPage();
    await pg.goto(url); await pg.fill("#claveInput", "1234"); await pg.click("#claveBtn");
    await pg.click("#nombreLista button[data-id='4']"); await pg.waitForSelector("#avisoPop:not(.hidden)"); await pg.waitForTimeout(450); await pg.click("#avisoBtns button[data-i='0']");
    await pg.waitForSelector(".box[data-cod=MOVIM]");
    await pg.evaluate(() => navigator.serviceWorker.ready.then(() => 1));
    return pg;
  };
  const cola = (pg) => pg.evaluate(() => JSON.parse(localStorage.getItem("gt_queue_v3") || "[]"));
  const espejo = (pg) => pg.evaluate(() => window.GT_COLA.leer());
  const badge = async (pg) => (await pg.textContent("#syncBadge")).trim();
  try {
    // ─── A) cada 5 s, y el aviso a la base ───
    {
      reset();
      const ctx = await br.newContext({ viewport: { width: 390, height: 664 } }), pg = await sesion(ctx);
      await pg.evaluate(() => window.__gt.flush()); await pg.waitForTimeout(300);   // el INGRESO sale
      ctl.modo = "500"; ctl.intentos = []; ctl.logs = [];
      await pg.click(".box[data-cod=MOVIM]"); await pg.waitForTimeout(400);
      const t0 = Date.now();
      chk(/1 sin enviar/.test(await badge(pg)), "A) con la base caída el evento queda en la cola: «" + (await badge(pg)) + "»");
      await dormir(11000);
      const n = ctl.intentos.filter((x) => !x.deSW).length;
      chk(n >= 3, "A) la página reintenta cada pocos segundos: " + n + " envíos en " + Math.round((Date.now() - t0) / 1000) + " s (con la 1.56: 1)");
      const e1 = ctl.logs.filter((l) => l.p_tipo === "error_envio");
      chk(e1.length === 1 && e1[0].p_intentos === 1 && /HTTP 500/.test(e1[0].p_motivo) && e1[0].p_pendientes === 1 && e1[0].p_empleado === 4 && !!e1[0].p_dispositivo && !!e1[0].p_desde,
          "A) avisa a la base el primer error de envío (intento 1, «" + (e1[0] && e1[0].p_motivo) + "», 1 pendiente, el operario y el celular)");
      chk(await hasta(() => ctl.logs.some((l) => l.p_tipo === "error_envio" && l.p_intentos === 5), 14000), "A) y otra vez al 5.º intento (no en cada uno: " + ctl.logs.filter((l) => l.p_tipo === "error_envio").map((l) => l.p_intentos).join(", ") + ")");
      ctl.modo = "ok";
      chk(await hasta(async () => /al día/.test(await badge(pg)), 8000), "A) vuelve la base: la cola se vacía sola en menos de 8 s sin tocar nada (" + (await badge(pg)) + ")");
      chk(filas.some((f) => f.rubro === "MOVIM" || f.opcion === "AREA"), "A) y la base tiene el evento");
      const rec = ctl.logs.filter((l) => l.p_tipo === "envio_recuperado");
      chk(rec.length === 1 && rec[0].p_intentos >= 3 && rec[0].p_pendientes === 1, "A) avisa que se recuperó (" + (rec[0] ? rec[0].p_intentos + " intentos, " + rec[0].p_pendientes + " pendiente" : "no avisó") + ")");
      await ctx.close();
    }

    // ─── B) una fila mala no traba a las demás ───
    {
      reset();
      const ctx = await br.newContext({ viewport: { width: 390, height: 664 } }), pg = await sesion(ctx);
      await pg.evaluate(() => window.__gt.flush()); await pg.waitForTimeout(300);
      ctl.reint = true; ctl.modo = "ok";
      await pg.evaluate(() => {
        const ts = new Date().toISOString(), base = { empleado_id: 4, opcion: "AREA", rubro: "MOVIM", descripcion: "Movimientos", ts_cliente: ts, ts_inicio: null, dispositivo: "prueba", planta: "PELL" };
        const q = JSON.parse(localStorage.getItem("gt_queue_v3") || "[]");
        ["bueno1", "malo", "pasajero", "bueno2"].forEach((id, i) => q.push(Object.assign({}, base, { client_id: "b-" + id, texto: id === "malo" ? "RECH" : id === "pasajero" ? "REINT" : "", ts_cliente: new Date(Date.now() + i).toISOString() })));
        localStorage.setItem("gt_queue_v3", JSON.stringify(q));
      });
      await pg.evaluate(() => window.__gt.flush()); await pg.waitForTimeout(500);
      const q = await cola(pg), rech = await pg.evaluate(() => JSON.parse(localStorage.getItem("gt_rechazados_v3") || "[]"));
      chk(filas.some((f) => f.client_id === "b-bueno1") && filas.some((f) => f.client_id === "b-bueno2"), "B) las dos filas buenas entraron aunque había una mala y una con error pasajero en el mismo lote");
      chk(rech.some((r) => r.client_id === "b-malo" && /error de dato/.test(r.motivo)) && !q.some((x) => x.client_id === "b-malo"), "B) la fila con error de dato salió de la cola y quedó en «rechazados» con su motivo");
      chk(q.length === 1 && q[0].client_id === "b-pasajero", "B) la del error pasajero SE QUEDA en la cola, ni confirmada ni rechazada (cola: " + q.map((x) => x.client_id).join(",") + ")");
      ctl.reint = false;
      chk(await hasta(async () => (await cola(pg)).length === 0, 8000) && filas.some((f) => f.client_id === "b-pasajero"), "B) pasado el error, entra en el reintento siguiente (5 s) sin que nadie toque nada");
      await ctx.close();
    }

    // ─── C) el espejo en IndexedDB ───
    {
      reset();
      const ctx = await br.newContext({ viewport: { width: 390, height: 664 } }), pg = await sesion(ctx);
      await pg.evaluate(() => window.__gt.flush()); await pg.waitForTimeout(300);
      ctl.modo = "500";
      await pg.click(".box[data-cod=MOVIM]"); await pg.waitForTimeout(600);
      const q = await cola(pg), e = await espejo(pg);
      chk(q.length === 1 && e.queue.length === 1 && e.queue[0].client_id === q[0].client_id, "C) lo que se encola queda copiado en IndexedDB (cola: " + q.length + ", copia: " + e.queue.length + ")");
      chk(!!e.cfg && e.cfg.url === url.replace(/\/$/, "") && !!e.cfg.key, "C) la copia guarda a dónde mandar para el service worker");
      await pg.evaluate(() => localStorage.removeItem("gt_queue_v3"));       // el localStorage pierde la cola
      await pg.reload(); await pg.waitForSelector("#optionsScreen:not(.hidden)"); await pg.waitForTimeout(800);
      const q2 = await cola(pg);
      chk(q2.length === 1 && q2[0].client_id === q[0].client_id, "C) el localStorage perdió la cola y al abrir se recupera de la copia (" + q2.length + " fila)");
      ctl.modo = "ok";
      chk(await hasta(async () => (await cola(pg)).length === 0 && filas.some((f) => f.client_id === q[0].client_id), 8000), "C) y lo recuperado se manda");
      await dormir(400);
      chk((await espejo(pg)).queue.length === 0, "C) con la cola vacía, la copia también queda vacía");
      await ctx.close();
    }

    // ─── D) el service worker manda solo ───
    // Este Chromium (sin pantalla) trae Background Sync apagado: reg.sync.register() falla con «Background Sync is disabled». Por eso
    // (1) se reemplaza reg.sync para ver QUÉ pide la página y (2) el evento «sync» se dispara por CDP (ServiceWorker.dispatchSyncEvent),
    // igual que lo dispararía Chrome en un Android. Que Chrome lo programe solo, con la app cerrada, sólo se ve en un celular.
    {
      reset();
      const ctx = await br.newContext({ viewport: { width: 390, height: 664 } });
      await ctx.addInitScript(() => {
        window.__syncPedidos = [];
        try { Object.defineProperty(ServiceWorkerRegistration.prototype, "sync", { configurable: true, get() { return { register: async (t) => { window.__syncPedidos.push(t); } }; } }); } catch { /* ya está */ }
      });
      const pg = await sesion(ctx);
      const dispararSync = async () => {
        const cdp = await ctx.newCDPSession(pg), regs = [];
        cdp.on("ServiceWorker.workerRegistrationUpdated", (e) => regs.push(...e.registrations));
        await cdp.send("ServiceWorker.enable"); await dormir(400);
        await cdp.send("ServiceWorker.dispatchSyncEvent", { origin: url.replace(/\/$/, ""), registrationId: regs[regs.length - 1].registrationId, tag: "flush-queue", lastChance: false });
        await cdp.detach();
      };
      await pg.evaluate(() => window.__gt.flush()); await pg.waitForTimeout(300);
      ctl.modo = "soloSW"; ctl.intentos = [];     // la base atiende sólo lo que mande el service worker: la página falla siempre
      await pg.click(".box[data-cod=MOVIM]"); await pg.waitForTimeout(600);
      const id = (await cola(pg))[0].client_id;
      chk((await pg.evaluate(() => window.__syncPedidos)).includes("flush-queue"), "D) cuando un envío falla, la página le pide a Chrome el envío en segundo plano (tag flush-queue)");
      chk(!ctl.intentos.some((x) => x.deSW), "D) (todavía nadie mandó con éxito: la página falla y el service worker no fue llamado)");
      await dispararSync();
      chk(await hasta(() => filas.some((f) => f.client_id === id), 5000) && ctl.intentos.some((x) => x.deSW && x.n >= 1), "D) el evento «sync»: el service worker manda la cola desde su copia (la página fallaba: " + ctl.intentos.filter((x) => !x.deSW).length + " intentos suyos caídos)");
      chk(await hasta(async () => (await cola(pg)).length === 0, 4000), "D) la página lo reconoce: la fila sale de su cola sin volver a mandarla");
      ctl.modo = "ok"; ctl.intentos = []; await pg.waitForTimeout(6000);
      chk(filas.filter((f) => f.client_id === id).length === 1 && !ctl.intentos.some((x) => x.n > 0), "D) con la base de vuelta no se manda otra vez (1 fila en la base, ningún envío más)");
      chk(/al día/.test(await badge(pg)), "D) la insignia dice «" + (await badge(pg)) + "»");
      // lo que el service worker ve rechazado llega a «rechazados»
      ctl.modo = "soloSW"; ctl.intentos = [];
      await pg.evaluate(() => {
        const q = JSON.parse(localStorage.getItem("gt_queue_v3") || "[]");
        q.push({ client_id: "sw-malo", empleado_id: 4, opcion: "AREA", rubro: "MOVIM", descripcion: "Movimientos", texto: "RECH", ts_cliente: new Date().toISOString(), ts_inicio: null, dispositivo: "prueba", planta: "PELL" });
        localStorage.setItem("gt_queue_v3", JSON.stringify(q));
      });
      await pg.reload(); await pg.waitForSelector("#optionsScreen:not(.hidden)"); await pg.waitForTimeout(600);   // al abrir, la copia se pone igual a la cola
      chk((await espejo(pg)).queue.some((x) => x.client_id === "sw-malo"), "D) al abrir, la copia de IndexedDB se iguala a la cola (un celular recién actualizado a la 1.57 con cola pendiente)");
      await dispararSync();
      chk(await hasta(async () => (await pg.evaluate(() => JSON.parse(localStorage.getItem("gt_rechazados_v3") || "[]"))).some((r) => r.client_id === "sw-malo" && /error de dato/.test(r.motivo)), 8000),
          "D) lo que el service worker vio rechazado llega a «rechazados» de la página con su motivo");
      chk(!(await cola(pg)).some((x) => x.client_id === "sw-malo"), "D) y sale de la cola");
      // se va a segundo plano con algo pendiente: pide el envío
      await pg.evaluate(() => { window.__syncPedidos.length = 0; const q = JSON.parse(localStorage.getItem("gt_queue_v3") || "[]"); q.push({ client_id: "bg-1", empleado_id: 4, opcion: "AREA", rubro: "MOVIM", descripcion: "Movimientos", ts_cliente: new Date().toISOString(), ts_inicio: null, dispositivo: "prueba", planta: "PELL" }); localStorage.setItem("gt_queue_v3", JSON.stringify(q)); Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
      await pg.waitForTimeout(500);
      chk((await pg.evaluate(() => window.__syncPedidos)).includes("flush-queue"), "D) al irse a segundo plano con algo sin enviar, pide el envío");
      await ctx.close();
    }

    // ─── E) sin IndexedDB ───
    {
      reset();
      const ctx = await br.newContext({ viewport: { width: 390, height: 664 } });
      await ctx.addInitScript(() => { Object.defineProperty(window, "indexedDB", { value: undefined }); });
      const pg = await ctx.newPage();
      await pg.goto(url); await pg.fill("#claveInput", "1234"); await pg.click("#claveBtn");
      await pg.click("#nombreLista button[data-id='4']"); await pg.waitForSelector("#avisoPop:not(.hidden)"); await pg.waitForTimeout(450); await pg.click("#avisoBtns button[data-i='0']");
      await pg.waitForSelector(".box[data-cod=MOVIM]");
      ctl.modo = "500"; await pg.click(".box[data-cod=MOVIM]"); await pg.waitForTimeout(500);
      chk((await cola(pg)).length >= 1, "E) sin IndexedDB la cola sigue en localStorage");
      ctl.modo = "ok";
      chk(await hasta(async () => (await cola(pg)).length === 0 && filas.length >= 1, 8000), "E) y se manda sola cuando vuelve la base (como en la 1.56)");
      await ctx.close();
    }
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? `\n${fallas.length} falla(s)` : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

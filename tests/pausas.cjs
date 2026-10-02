// 1.34 (Elías: «tenía 2 min encolando, fui al baño 6-7 y al regresar aparecieron 9 min de encolando»): en el celular, el
// tiempo del área abierta y el del Resumen de hoy no cuentan las pausas (Baño, Movimiento) que hubo adentro.
// Uso: node tests/pausas.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const A = (codigo, nombre, orden, x) => Object.assign({ codigo, nombre, unidad: "cajas encoladas", orden, planta: "PELL", pide_codigo: false, pide_cantidad: true }, x || {});
const AREAS = [A("ENCOL", "Encolado", 3), A("CORTE", "Corte", 1), A("MOVIM", "Movimientos", 30, { pide_cantidad: false }), A("BANO", "Baño", 31, { pide_cantidad: false })];
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop();
      // gt_registrar no confirma nada: los eventos quedan en la cola del celular, que es de donde se leen
      const out = fn === "gt_clave_validar" ? { ok: true, principal: "PELL", empleados: [{ id: 7, nombre: "Ximena Ortiz", plantas: [] }] }
        : fn.startsWith("gt_botones") ? AREAS : fn === "gt_registrar" ? { ok: [], rechazados: [] } : [];
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(out));
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
    const pg = await br.newPage({ viewport: { width: 390, height: 664 } });
    await pg.goto(url); await pg.fill("#claveInput", "1234"); await pg.click("#claveBtn");
    await pg.click("#nombreLista button[data-id='7']"); await pg.waitForSelector("#avisoPop:not(.hidden)"); await pg.waitForTimeout(450); await pg.click("#avisoBtns button[data-i='0']"); await pg.waitForSelector(".box[data-cod=ENCOL]");   // 1.49: «¿Sos …?» Sí
    // el caso de Elías: encolando desde hace 9 min, con 6 min de baño adentro (de -7 a -1)
    await pg.evaluate(() => {
      const ya = Date.now(), t = (min) => new Date(ya - min * 60000).toISOString();
      const ev = (id, rubro, ts, ini, x) => Object.assign({ client_id: id, empleado_id: 7, opcion: "AREA", rubro, descripcion: rubro, texto: "", cantidad: null,
        ts_cliente: ts, ts_inicio: ini, dispositivo: "prueba", planta: "PELL" }, x || {});
      const q = JSON.parse(localStorage.getItem("gt_queue_v3") || "[]");
      q.push(ev("e1", "ENCOL", t(9), null, { texto: "173" }), ev("b1", "BANO", t(7), null), ev("b2", "BANO", t(1), t(7)));
      localStorage.setItem("gt_queue_v3", JSON.stringify(q));
    });
    await pg.reload(); await pg.waitForSelector(".termine-btn[data-cod=ENCOL]");
    const reloj = (await pg.textContent(".ab-tiempo")).trim();
    chk(reloj === "3 min", "volvió del baño: el reloj de Encolado muestra 3 min (9 − 6 de baño), no 9 (" + reloj + ")");
    // terminar Encolado y mirar el Resumen de hoy
    await pg.click(".termine-btn[data-cod=ENCOL]"); await pg.waitForSelector("#cantScreen:not(.hidden)");
    await pg.fill("#cantInput", "2"); await pg.click("#cambioBtn"); await pg.waitForSelector("#botonera .box");
    await pg.click("#histBtn"); await pg.waitForSelector("#histPop:not(.hidden)");
    const enc = await pg.$$eval("#hist .hist-row", (rs) => (rs.find((r) => r.textContent.includes("Encolado")) || {}).textContent || "");
    chk(/0:03/.test(enc) && /sin 0:06 de pausa/.test(enc), "Resumen de hoy: Encolado 0:03 (sin 0:06 de pausa) — " + enc.replace(/\s+/g, " ").trim());
    const ban = await pg.$$eval("#hist .hist-row", (rs) => (rs.find((r) => r.textContent.includes("Baño")) || {}).textContent || "");
    chk(/0:06/.test(ban) && !/pausa/.test(ban), "el tramo de Baño sigue mostrando sus 0:06");
    await pg.close();

    // 1.36 (Elías: «dentro de movimiento también puede ir al baño»)
    const entrar = async () => {
      const p = await br.newPage({ viewport: { width: 390, height: 664 } });
      await p.goto(url); await p.fill("#claveInput", "1234"); await p.click("#claveBtn");
      await p.click("#nombreLista button[data-id='7']"); await p.waitForSelector("#avisoPop:not(.hidden)"); await p.waitForTimeout(450); await p.click("#avisoBtns button[data-i='0']"); await p.waitForSelector(".box[data-cod=ENCOL]");   // 1.49: «¿Sos …?» Sí
      return p;
    };
    // a) Movimiento desde la botonera → Baño → vuelve al Movimiento → Terminé → botonera
    const pa = await entrar();
    await pa.click(".box[data-cod=MOVIM]"); await pa.waitForSelector(".termine-btn[data-cod=MOVIM]");
    const btnsMov = await pa.$$eval(".pausa-btn", (bs) => bs.map((b) => b.dataset.pausa).join(","));
    chk(btnsMov === "BANO", "con un Movimiento abierto aparece sólo el botón de Baño (" + btnsMov + ")");
    await pa.click(".pausa-btn[data-pausa=BANO]"); await pa.waitForSelector(".termine-btn[data-cod=BANO]");
    chk((await pa.textContent(".termine-btn")).includes("Volví del baño") && (await pa.textContent("#abiertaBox")).includes("Movimientos en pausa"),
        "Baño dentro del Movimiento: el Movimiento queda en pausa");
    await pa.click(".termine-btn[data-cod=BANO]"); await pa.waitForSelector(".termine-btn[data-cod=MOVIM]");
    chk(true, "Volví del baño: vuelve al Movimiento");
    await pa.click(".termine-btn[data-cod=MOVIM]"); await pa.waitForSelector("#botonera .box");
    chk(!(await pa.isVisible("#cantScreen")), "Terminé el Movimiento (desde la botonera): se cierra y vuelve la botonera");
    await pa.close();
    // b) Corte → Movimiento → Baño → vuelve al Movimiento → «¿Seguís con Corte?» Sí
    const pb = await entrar();
    await pb.click(".box[data-cod=CORTE]"); await pb.waitForSelector(".pausa-btn[data-pausa=MOVIM]");
    await pb.click(".pausa-btn[data-pausa=MOVIM]"); await pb.waitForSelector(".termine-btn[data-cod=MOVIM]");
    await pb.click(".pausa-btn[data-pausa=BANO]"); await pb.waitForSelector(".termine-btn[data-cod=BANO]");
    await pb.click(".termine-btn[data-cod=BANO]"); await pb.waitForSelector(".termine-btn[data-cod=MOVIM]");
    chk((await pb.textContent(".termine-btn")).includes("Terminé el movimiento") && (await pb.textContent("#abiertaBox")).includes("Corte en pausa"),
        "Corte → Movimiento → Baño → Volví: sigue el Movimiento, con Corte en pausa abajo");
    await pb.click(".termine-btn[data-cod=MOVIM]"); await pb.waitForFunction(() => document.getElementById("pasoLabel").textContent.includes("¿Seguís con Corte"));
    await pb.click("#pasoOpts button[data-val='Sí, sigo en Corte']"); await pb.waitForSelector(".termine-btn[data-cod=CORTE]");
    chk(true, "Terminé el movimiento → «¿Seguís con Corte?» Sí → sigue en Corte");
    await pb.close();
    // c) el reloj: Corte desde hace 20 min, Movimiento de -15 a -5 con Baño de -12 a -8 adentro → 10 min (no 6)
    const pc = await entrar();
    await pc.evaluate(() => {
      const ya = Date.now(), t = (min) => new Date(ya - min * 60000).toISOString();
      const ev = (id, rubro, ts, ini) => ({ client_id: id, empleado_id: 7, opcion: "AREA", rubro, descripcion: rubro, texto: "", cantidad: null,
        ts_cliente: ts, ts_inicio: ini, dispositivo: "prueba", planta: "PELL" });
      const q = JSON.parse(localStorage.getItem("gt_queue_v3") || "[]");
      q.push(ev("c1", "CORTE", t(20), null), ev("m1", "MOVIM", t(15), null), ev("b1", "BANO", t(12), null), ev("b2", "BANO", t(8), t(12)), ev("m2", "MOVIM", t(5), t(15)));
      localStorage.setItem("gt_queue_v3", JSON.stringify(q));
    });
    await pc.reload(); await pc.waitForSelector(".termine-btn[data-cod=CORTE]");
    const rc = (await pc.textContent(".ab-tiempo")).trim();
    chk(rc === "10 min", "Corte con un baño DENTRO del movimiento: 20 − 10 de movimiento = 10 min, el baño no se resta dos veces (" + rc + ")");
    await pc.click("#histBtn"); await pc.waitForSelector("#histPop:not(.hidden)");
    const mov = await pc.$$eval("#hist .hist-row", (rs) => (rs.find((r) => r.textContent.includes("Movimientos")) || {}).textContent || "");
    chk(/0:06/.test(mov) && /sin 0:04 de pausa/.test(mov), "el Movimiento descuenta su baño: 0:06 (sin 0:04 de pausa) — " + mov.replace(/\s+/g, " ").trim());
    await pc.close();
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? `\n${fallas.length} falla(s)` : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

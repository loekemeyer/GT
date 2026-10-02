// 1.43 (Elías: «agregale un contador de tiempo muerto abajo del nombre. Se reinicia a 0 cuando empiezan una tarea y vuelve
// a contar cuando le dan a Cambiar de área / no sigo, y también si desde el panel hace Baño o Movimiento»).
// Uso: node tests/muerto.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const A = (codigo, nombre, orden, x) => Object.assign({ codigo, nombre, unidad: "unidades cortadas", orden, planta: "PELL", pide_codigo: false, pide_cantidad: true }, x || {});
const AREAS = [A("CORTE", "Corte", 1), A("MOVIM", "Movimientos", 30, { pide_cantidad: false }), A("BANO", "Baño", 31, { pide_cantidad: false }),
               A("ALMU", "Almuerzo", 40, { pide_cantidad: false })];
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
    const reloj = async () => ({ txt: (await pg.innerText("#muerto")).trim(), corre: await pg.$eval("#muerto", (e) => e.classList.contains("corre")) });
    // los eventos del día, con horas en el pasado, en la cola del celular
    const sembrar = (evs) => pg.evaluate((evs) => {
      const ya = Date.now(), t = (min) => (min == null ? null : new Date(ya - min * 60000).toISOString());
      const q = evs.map(([id, opcion, rubro, ts, ini]) => ({ client_id: id, empleado_id: 7, opcion, rubro, descripcion: rubro || opcion, texto: "", cantidad: null,
        ts_cliente: t(ts), ts_inicio: t(ini), dispositivo: "prueba", planta: "PELL" }));
      localStorage.setItem("gt_queue_v3", JSON.stringify(q));
    }, evs);
    await pg.goto(url); await pg.fill("#claveInput", "1234"); await pg.click("#claveBtn");
    await pg.click("#nombreLista button[data-id='7']"); await pg.waitForSelector(".box[data-cod=CORTE]");
    let r = await reloj();
    chk(/^⏱ Tiempo muerto 0:0\d$/.test(r.txt) && r.corre, "recién ingresado con el código: corre desde el ingreso (" + r.txt + ")");
    // ingresó hace 5 min y no empezó nada
    await sembrar([["i1", "INGRESO", null, 5, null]]); await pg.reload(); await pg.waitForSelector(".box[data-cod=CORTE]");
    r = await reloj();
    chk(/^⏱ Tiempo muerto 5:0\d$/.test(r.txt) && r.corre, "ingresó hace 5 min sin empezar nada: 5:0x (" + r.txt + ")");
    await pg.waitForTimeout(2100);
    const r2 = await reloj();
    chk(r2.txt !== r.txt, "el contador avanza solo, de a un segundo (" + r.txt + " → " + r2.txt + ")");
    // empieza Corte: vuelve a 0 y se queda quieto
    await pg.click(".box[data-cod=CORTE]"); await pg.waitForSelector(".termine-btn[data-cod=CORTE]");
    r = await reloj();
    chk(r.txt === "⏱ Tiempo muerto 0:00" && !r.corre, "empieza Corte: se reinicia a 0:00 y no corre");
    // Baño dentro de Corte: sigue en 0 (el área sigue abierta)
    await pg.click(".pausa-btn[data-pausa=BANO]"); await pg.waitForSelector(".termine-btn[data-cod=BANO]");
    r = await reloj();
    chk(r.txt === "⏱ Tiempo muerto 0:00" && !r.corre, "baño dentro de Corte: sigue en 0 (el área sigue abierta)");
    await pg.click(".termine-btn[data-cod=BANO]"); await pg.waitForSelector(".termine-btn[data-cod=CORTE]");
    // Terminé → «Cambiar de área / no sigo»: vuelve a contar desde ese momento
    await pg.click(".termine-btn[data-cod=CORTE]"); await pg.waitForSelector("#cantScreen:not(.hidden)");
    await pg.fill("#cantInput", "10"); await pg.click("#cambioBtn"); await pg.waitForSelector(".box[data-cod=CORTE]");
    r = await reloj();
    chk(/^⏱ Tiempo muerto 0:0[0-2]$/.test(r.txt) && r.corre, "«Cambiar de área / no sigo»: vuelve a contar desde 0 (" + r.txt + ")");
    // Movimiento desde el panel: 0 mientras dura; al terminarlo vuelve a contar
    await pg.click(".box[data-cod=MOVIM]"); await pg.waitForSelector(".termine-btn[data-cod=MOVIM]");
    r = await reloj();
    chk(r.txt === "⏱ Tiempo muerto 0:00" && !r.corre, "Movimiento desde el panel: 0 mientras dura");
    await pg.click(".termine-btn[data-cod=MOVIM]"); await pg.waitForSelector(".box[data-cod=CORTE]");
    r = await reloj();
    chk(/^⏱ Tiempo muerto 0:0[0-2]$/.test(r.txt) && r.corre, "terminó el Movimiento y volvió al panel: cuenta desde 0 (" + r.txt + ")");
    // un baño desde el panel que terminó hace 3 min: 3:0x (no desde el ingreso ni desde antes del baño)
    await sembrar([["i1", "INGRESO", null, 60, null], ["c1", "AREA", "CORTE", 50, null], ["c2", "AREA", "CORTE", 20, 50],
                   ["b1", "AREA", "BANO", 10, null], ["b2", "AREA", "BANO", 3, 10]]);
    await pg.reload(); await pg.waitForSelector(".box[data-cod=CORTE]");
    r = await reloj();
    chk(/^⏱ Tiempo muerto 3:0\d$/.test(r.txt) && r.corre, "volvió del baño (desde el panel) hace 3 min: 3:0x (" + r.txt + ")");
    // en el almuerzo no corre
    await sembrar([["i1", "INGRESO", null, 60, null], ["a1", "AREA", "ALMU", 20, null]]);
    await pg.reload(); await pg.waitForSelector("#almuBtn");
    r = await reloj();
    chk(r.txt === "⏱ Tiempo muerto 0:00" && !r.corre, "almorzando: 0, no es tiempo muerto");
    // más de una hora: h:mm:ss
    await sembrar([["i1", "INGRESO", null, 75, null]]); await pg.reload(); await pg.waitForSelector(".box[data-cod=CORTE]");
    r = await reloj();
    chk(/^⏱ Tiempo muerto 1:15:0\d$/.test(r.txt), "más de una hora: 1:15:0x (" + r.txt + ")");
    // entra en el encabezado del celular chico sin cortarse
    await pg.setViewportSize({ width: 320, height: 480 }); await pg.waitForTimeout(200);
    const cabe = await pg.$eval("#muerto", (e) => e.scrollWidth <= e.parentElement.clientWidth + 1 && e.getBoundingClientRect().bottom <= document.querySelector("#optionsScreen .top-bar").getBoundingClientRect().bottom);
    const med = await pg.$eval("#muerto", (e) => ({ txt: e.scrollWidth, caja: e.parentElement.clientWidth, abajo: Math.round(e.getBoundingClientRect().bottom),
      cab: Math.round(document.querySelector("#optionsScreen .top-bar").getBoundingClientRect().bottom) }));
    chk(cabe, "en 320 px entra entero abajo del nombre, dentro del encabezado " + JSON.stringify(med));
    await pg.close();
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? `\n${fallas.length} falla(s)` : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

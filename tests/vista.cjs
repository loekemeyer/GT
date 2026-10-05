// 1.52 (Thomas, 05/10/2026): con la clave del administrador (gt.config.clave_vista) se entra como cualquier operario, sin
// «¿Sos …?», y se ve lo mismo que él, pero NO se graba nada (ni el INGRESO). Y las áreas con «solo» (gt.empleado_rubro)
// las ve sólo ese empleado (Javier: ISIS, OP, Facturación).
// Uso: node tests/vista.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const A = (codigo, nombre, orden, x) => Object.assign({ codigo, nombre, unidad: "cajas", orden, planta: "PELL", pide_codigo: false, pide_cantidad: true, solo: null }, x || {});
const AREAS = [A("CORTE", "Corte", 1, { unidad: "unidades cortadas" }), A("ENCOL", "Encolado", 3), A("PED", "Pedidos", 8, { pide_cantidad: false }),
  A("ISIS", "Cargar contraído a ISIS", 13, { pide_cantidad: false, solo: [1] }), A("OP", "Hacer OP", 14, { pide_cantidad: false, solo: [1] }),
  A("FACT", "Sector Facturación", 15, { pide_cantidad: false, solo: [1] })];
const EMPS = [{ id: 1, nombre: "Javier Burgos", plantas: [] }, { id: 6, nombre: "Dario Mendez", plantas: [] }];
const HOY = [];   // lo que el servidor tiene de Darío hoy: un Corte abierto
const filas = [], llamadas = [];
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop(), b = body ? JSON.parse(body) : {};
      llamadas.push(fn);
      if (fn === "gt_registrar") (b.p_filas || []).forEach((f) => { if (!filas.some((x) => x.client_id === f.client_id)) filas.push(f); });
      const out = fn === "gt_clave_validar" ? (b.p_clave === "1411" || b.p_clave === "1234" ? { ok: true, vista: b.p_clave === "1411", principal: "PELL", empleados: EMPS } : { ok: false })
        : fn === "gt_botones3" ? AREAS : fn.startsWith("gt_botones") ? AREAS.map(({ solo, ...x }) => x)
        : fn.startsWith("gt_registros_hoy") ? (b.p_empleado === 6 ? HOY : [])
        : fn === "gt_registrar" ? { ok: (b.p_filas || []).map((f) => f.client_id), rechazados: [] } : [];
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
    const t0 = new Date(Date.now() - 20 * 60000).toISOString();
    HOY.push({ client_id: "d1", opcion: "AREA", rubro: "CORTE", descripcion: "Corte", texto: "", ts_cliente: t0, ts_inicio: null });
    const pg = await br.newPage({ viewport: { width: 390, height: 664 } });
    await pg.goto(url); await pg.fill("#claveInput", "1411"); await pg.click("#claveBtn");
    await pg.waitForSelector("#nombreScreen:not(.hidden)");
    await pg.click("#nombreLista button[data-id='6']"); await pg.waitForTimeout(300);
    chk(await pg.isHidden("#avisoPop") && await pg.isVisible("#optionsScreen"), "1411 + Darío: entra sin «¿Sos …?»");
    chk((await pg.textContent("#opName")).startsWith("👁 Dario") && (await pg.textContent("#syncBadge")).includes("no graba"), "arriba dice 👁 Dario Mendez y «Vista · no graba»");
    chk((await pg.textContent("#abiertaBox")).includes("Corte"), "se ve lo de Darío: el Corte que tiene abierto");
    chk(!(await pg.$(".box[data-cod=ISIS]")), "Darío no ve las áreas de Javier");
    // tocar cosas: terminar el Corte, empezar Pedidos, terminarlo
    await pg.click(".termine-btn"); await pg.waitForSelector("#cantScreen:not(.hidden)");
    await pg.fill("#cantInput", "12"); await pg.click("#cambioBtn"); await pg.waitForSelector("#optionsScreen:not(.hidden)");
    await pg.click(".box[data-cod=PED]"); await pg.waitForTimeout(200);
    chk((await pg.textContent("#abiertaBox")).includes("Pedidos"), "en la vista los toques andan igual (Corte cerrado, Pedidos abierto)");
    await pg.waitForTimeout(1500);
    chk(filas.length === 0 && !llamadas.includes("gt_registrar") && !llamadas.includes("gt_reingreso"), "no se mandó nada a la base (" + llamadas.filter((x) => x === "gt_registrar").length + " gt_registrar)");
    chk((await pg.evaluate(() => localStorage.getItem("gt_queue_v3") || "[]")) === "[]", "la cola del celular quedó vacía");
    await pg.reload(); await pg.waitForSelector("#optionsScreen:not(.hidden)");
    chk((await pg.textContent("#syncBadge")).includes("no graba") && (await pg.textContent("#abiertaBox")).includes("Corte"), "al recargar sigue en vista y vuelve a lo real de Darío");
    // salir y entrar de verdad como Javier
    await pg.click("#salirBtn"); await pg.waitForSelector("#claveScreen:not(.hidden)");
    await pg.fill("#claveInput", "1234"); await pg.click("#claveBtn");
    await pg.click("#nombreLista button[data-id='1']"); await pg.waitForSelector("#avisoPop:not(.hidden)"); await pg.waitForTimeout(450); await pg.click("#avisoBtns button[data-i='0']");
    await pg.waitForSelector(".box[data-cod=CORTE]");
    const cods = await pg.$$eval(".box", (bs) => bs.map((b) => b.dataset.cod).join(","));
    chk(/ISIS/.test(cods) && /OP/.test(cods) && /FACT/.test(cods), "Javier ve sus 3 áreas (" + cods + ")");
    chk(!(await pg.textContent("#syncBadge")).includes("no graba"), "con el código del monitor ya no está en vista");
    await pg.click(".box[data-cod=ISIS]"); await pg.waitForTimeout(1200);
    chk(filas.some((f) => f.opcion === "INGRESO" && f.empleado_id === 1) && filas.some((f) => f.rubro === "ISIS" && f.empleado_id === 1), "Javier de verdad: graba el ingreso y la apertura de ISIS");
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? "\n" + fallas.length + " falla(s)" : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

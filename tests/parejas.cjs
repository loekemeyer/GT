// 1.39 (Elías, D45: «que uno ponga y le aparezca al otro como pregunta: Vas a hacer (tarea) con (persona) · Sí / No»).
// Dos celulares contra una base simulada que hace lo mismo que la real (gt_v151): la apertura con detalle.pareja deja una
// invitación; la apertura con detalle._invitado la deja aceptada; gt_pareja_responder la rechaza.
// Uso: node tests/parejas.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const PELL = { codigo: "PELL", nombre: "Pellegrini" }, ESN = { codigo: "ESN", nombre: "Esnaola" };
const EMPS = [{ id: 7, nombre: "Ximena Ortiz", plantas: [PELL] }, { id: 8, nombre: "Walter Saucedo", plantas: [PELL] },
              { id: 9, nombre: "Luis Luna", plantas: [PELL, ESN] }, { id: 10, nombre: "Nadia Esnaola", plantas: [ESN] }];
const A = (codigo, nombre, orden, x) => Object.assign({ codigo, nombre, unidad: "cajas encoladas", orden, planta: "PELL", pide_codigo: false, pide_cantidad: true }, x || {});
const AREAS = [A("CORTE", "Corte", 1, { unidad: "unidades cortadas" }), A("ENCOL", "Encolado", 3, { pide_codigo: true }),
               A("CONTR", "Contraído", 7, { pide_codigo: true, unidad: "cajas contraídas" }),
               A("MOVIM", "Movimientos", 30, { pide_cantidad: false }), A("BANO", "Baño", 31, { pide_cantidad: false })];
const CODS = ["ENCOL", "CONTR"].flatMap((rubro) => [
  { rubro, codigo: "173", descripcion: "Cuadro Mold 03 Grafic Work", medida: "10*30" },
  { rubro, codigo: "185", descripcion: "Cuadro Mold 03 Paisajes", medida: "10*30" }]);
const base = { registros: [], parejas: [] };
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop(), b = body ? JSON.parse(body) : {};
      let out = [];
      if (fn === "gt_clave_validar") out = { ok: true, principal: "PELL", empleados: EMPS };
      else if (fn.startsWith("gt_botones")) out = AREAS;
      else if (fn === "gt_codigos_area2") out = CODS;
      else if (fn === "gt_companeros") out = EMPS.filter((e) => e.id !== b.p_empleado).map((e) => ({ id: e.id, nombre: e.nombre, plantas: e.plantas.map((p) => p.codigo) }));
      else if (fn.startsWith("gt_registros_hoy")) out = base.registros.filter((r) => r.empleado_id === b.p_empleado);
      else if (fn === "gt_registrar") {
        (b.p_filas || []).forEach((f) => {
          if (base.registros.some((r) => r.client_id === f.client_id)) return;
          base.registros.push(f);
          const d = f.detalle || {};
          if (f.opcion !== "AREA" || f.ts_inicio) return;
          if (d._invitado) {                                    // ≡ gt_pareja_acepta
            const p = base.parejas.find((x) => x.id === d._invitado && x.para_id === f.empleado_id);
            if (p) p.estado = "aceptada";
          } else if (d.pareja) {                                // ≡ gt_pareja_invita
            const para = EMPS.find((e) => e.nombre === d.pareja.replace(/^con\s+/, ""));
            if (para && para.id !== f.empleado_id) base.parejas.push({ id: base.parejas.length + 1, de_id: f.empleado_id, para_id: para.id,
              rubro: f.rubro, texto: f.texto, medida: f.medida || null, ts: f.ts_cliente, estado: "pendiente" });
          }
        });
        out = { ok: (b.p_filas || []).map((f) => f.client_id), rechazados: [] };
      } else if (fn === "gt_parejas_pendientes") {
        out = base.parejas.filter((p) => p.para_id === b.p_empleado && p.estado === "pendiente").map((p) => {
          const c = CODS.find((x) => x.rubro === p.rubro && x.codigo === p.texto) || {};
          return { id: p.id, de: EMPS.find((e) => e.id === p.de_id).nombre, rubro: p.rubro, area: AREAS.find((a) => a.codigo === p.rubro).nombre,
                   texto: p.texto, descripcion: c.descripcion || null, medida: p.medida, medida_cod: c.medida || null, ts: p.ts };
        });
      } else if (fn === "gt_pareja_responder") {
        const p = base.parejas.find((x) => x.id === b.p_id && x.para_id === b.p_empleado && x.estado === "pendiente");
        if (p) p.estado = b.p_si ? "aceptada" : "rechazada";
        out = { ok: !!p };
      }
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
const ultima = (emp) => base.registros.filter((r) => r.empleado_id === emp).slice(-1)[0] || {};
srv.listen(0, async () => {
  const url = "http://localhost:" + srv.address().port + "/";
  const br = await pw.chromium.launch();
  const entrar = async (id) => {
    const ctx = await br.newContext({ viewport: { width: 390, height: 664 } });
    const p = await ctx.newPage();
    await p.goto(url); await p.fill("#claveInput", "1234"); await p.click("#claveBtn");
    await p.click("#nombreLista button[data-id='" + id + "']");
    if (id === 9) { await p.waitForSelector("#plantaScreen:not(.hidden)"); await p.click("#plantaOpts button[data-planta=PELL]"); }   // Luis: dos plantas
    await p.waitForSelector(".box[data-cod=ENCOL]");
    return p;
  };
  const enviar = (p) => p.evaluate(() => window.__gt.flush());
  const pregunta = (p) => p.textContent("#pasoLabel");
  const opciones = (p) => p.$$eval("#pasoOpts button", (bs) => bs.map((b) => b.dataset.val));
  try {
    const xi = await entrar(7), wa = await entrar(8), lu = await entrar(9);

    // 1) Ximena empieza Encolado · 173 → «¿Con quién?»: los de Pellegrini (no ella, no la que es sólo de Esnaola) y Solo
    await xi.click(".box[data-cod=ENCOL]"); await xi.fill("#codInput", "173"); await xi.click("#codBtn");
    await xi.waitForSelector("#pasoScreen:not(.hidden)");
    const ops = await opciones(xi);
    chk((await pregunta(xi)) === "¿Con quién lo hacés?" && ops.join("|") === "Walter Saucedo|Luis Luna|🙋 Solo, sin compañero",
        "Encolado · 173: «¿Con quién lo hacés?» con los compañeros de la planta y Solo (" + ops.join(", ") + ")");
    await xi.click("#pasoVolver"); await xi.waitForSelector("#codScreen:not(.hidden)");
    chk((await xi.inputValue("#codInput")) === "173", "‹ vuelve al código, con el 173 puesto, sin registrar nada");
    await xi.click("#codBtn"); await xi.waitForSelector("#pasoScreen:not(.hidden)");
    await xi.click("#pasoOpts button[data-val='Walter Saucedo']"); await xi.waitForSelector(".termine-btn[data-cod=ENCOL]");
    await enviar(xi);
    chk(ultima(7).detalle && ultima(7).detalle.pareja === "con Walter Saucedo" && (await xi.textContent("#abiertaBox")).includes("173 · con Walter Saucedo"),
        "la apertura de Ximena lleva «con Walter Saucedo» y la base deja la invitación (" + base.parejas.length + ")");

    // 2) Walter estaba en Corte: le aparece la pregunta, dice Sí, pone lo que cortó y queda en Encolado con Ximena
    await wa.click(".box[data-cod=CORTE]"); await wa.waitForSelector(".termine-btn[data-cod=CORTE]"); await enviar(wa);
    await wa.evaluate(() => window.__gt.revisarParejas()); await wa.waitForSelector("#pasoScreen:not(.hidden)");
    const q = await pregunta(wa);
    chk(q === "¿Vas a hacer Encolado · 173 Cuadro Mold 03 Grafic Work 10*30 con Ximena Ortiz?", "a Walter le aparece: " + q);
    chk((await opciones(wa)).join("|") === "Sí, voy con Ximena Ortiz|No", "con Sí / No");
    await wa.click("#pasoOpts button[data-val='Sí, voy con Ximena Ortiz']"); await wa.waitForSelector("#cantScreen:not(.hidden)");
    chk((await wa.textContent("#cantBtn")) === "Terminar e ir con tu compañero" && !(await wa.isVisible("#salidaBox")) && !(await wa.isVisible("#sigueBox")),
        "tenía Corte abierto: primero pone lo que cortó («Terminar e ir con tu compañero»), sin «¿con qué seguís?»");
    await wa.fill("#cantInput", "40"); await wa.click("#cantBtn"); await wa.waitForSelector(".termine-btn[data-cod=ENCOL]"); await enviar(wa);
    const wr = base.registros.filter((r) => r.empleado_id === 8);
    chk(wr.some((r) => r.rubro === "CORTE" && r.ts_inicio && r.cantidad === 40), "Corte cerrado con 40");
    const ab = (await wa.textContent("#abiertaBox")).replace(/\s+/g, " ");
    chk(ab.includes("Encolado · 173 · con Ximena Ortiz") && !/\b1\b · |_invitado/.test(ab), "Walter queda en «Encolado · 173 · con Ximena Ortiz» (" + ab.trim() + ")");
    chk(base.parejas[0].estado === "aceptada", "la invitación queda aceptada al llegar la apertura de Walter");
    await wa.evaluate(() => window.__gt.revisarParejas()); await wa.waitForTimeout(300);
    chk(await wa.isVisible("#optionsScreen"), "no se le vuelve a preguntar");

    // 3) Ximena termina (12 cajas, «las de los dos») y sigue con el 185: Walter aparece primero en «¿Con quién?»
    await xi.click(".termine-btn[data-cod=ENCOL]"); await xi.waitForSelector("#cantScreen:not(.hidden)");
    chk((await xi.textContent("#cantSub")).includes("poné las de los dos (con Walter Saucedo)"), "a Ximena le pide las cajas de los dos");
    await xi.fill("#cantInput", "12"); await xi.fill("#sigueInput", "185"); await xi.click("#cantBtn");
    await xi.waitForSelector("#pasoScreen:not(.hidden)");
    chk((await opciones(xi))[0] === "Walter Saucedo", "sigue con el 185: «¿Con quién?» con Walter primero");
    await xi.click("#pasoOpts button[data-val='Walter Saucedo']"); await xi.waitForSelector(".termine-btn[data-cod=ENCOL]"); await enviar(xi);
    chk(base.registros.some((r) => r.empleado_id === 7 && r.texto === "173" && r.ts_inicio && r.cantidad === 12), "el 173 de Ximena cerrado con 12 cajas");

    // 4) Walter, en el baño, no ve la pregunta; al volver, sí: Sí cierra su 173 de invitado sin pedir nada y abre el 185
    await wa.click(".pausa-btn[data-pausa=BANO]"); await wa.waitForSelector(".termine-btn[data-cod=BANO]");
    await wa.evaluate(() => window.__gt.revisarParejas()); await wa.waitForTimeout(300);
    chk(await wa.isVisible("#optionsScreen"), "en el baño no se le pregunta");
    await wa.click(".termine-btn[data-cod=BANO]"); await wa.waitForSelector(".termine-btn[data-cod=ENCOL]");
    await wa.evaluate(() => window.__gt.revisarParejas()); await wa.waitForSelector("#pasoScreen:not(.hidden)");
    chk((await pregunta(wa)).includes("185"), "al volver del baño le pregunta por el 185");
    await wa.click("#pasoOpts button[data-val='Sí, voy con Ximena Ortiz']");
    await wa.waitForFunction(() => (document.getElementById("abiertaBox").textContent || "").includes("185"));
    await enviar(wa);
    const c173 = base.registros.find((r) => r.empleado_id === 8 && r.texto === "173" && r.ts_inicio);
    chk(c173 && c173.cantidad == null && c173.detalle && c173.detalle._invitado === 1, "su 173 de invitado se cerró solo, sin cajas");
    chk(base.parejas[1].estado === "aceptada", "y la segunda invitación queda aceptada");

    // 5) Walter termina: no le pide cajas («la cantidad la carga Ximena») ni con qué sigue
    await wa.click(".termine-btn[data-cod=ENCOL]"); await wa.waitForSelector("#cantScreen:not(.hidden)");
    chk(!(await wa.isVisible("#cantBox")) && !(await wa.isVisible("#sigueBox")) && (await wa.textContent("#cantSub")).includes("la cantidad la carga Ximena Ortiz") &&
        (await wa.textContent("#cantBtn")) === "Listo", "Terminé de Walter: «la cantidad la carga Ximena Ortiz», sin cajas, «Listo»");
    await wa.click("#cantBtn"); await wa.waitForSelector(".box[data-cod=ENCOL]"); await enviar(wa);
    chk(ultima(8).rubro === "ENCOL" && ultima(8).texto === "185" && ultima(8).ts_inicio && ultima(8).cantidad == null, "cierre del 185 de Walter sin cantidad, y vuelve la botonera");
    chk((await wa.evaluate(() => window.__gt.detalleTxt({ pareja: "con Ximena Ortiz", _invitado: 2 }))) === "con Ximena Ortiz", "el detalle no muestra el número interno");

    // 6) Ximena invita a Luis en Contraído y Luis dice que No: no se le abre nada y queda rechazada
    await xi.click(".termine-btn[data-cod=ENCOL]"); await xi.waitForSelector("#cantScreen:not(.hidden)");
    await xi.fill("#cantInput", "5"); await xi.click("#cambioBtn"); await xi.waitForSelector(".box[data-cod=CONTR]");
    await xi.click(".box[data-cod=CONTR]"); await xi.fill("#codInput", "173"); await xi.click("#codBtn");
    await xi.waitForSelector("#pasoScreen:not(.hidden)"); await xi.click("#pasoOpts button[data-val='Luis Luna']");
    await xi.waitForSelector(".termine-btn[data-cod=CONTR]"); await enviar(xi);
    // 1.43: sin llamarla a mano, la pregunta aparece sola en menos de 7 s (revisa cada 5)
    const t0 = Date.now(); await lu.waitForSelector("#pasoScreen:not(.hidden)", { timeout: 7000 });
    chk(Date.now() - t0 < 7000, "a Luis le aparece sola, sin tocar nada, en " + ((Date.now() - t0) / 1000).toFixed(1) + " s (revisa cada 5 s)");
    chk((await pregunta(lu)) === "¿Vas a hacer Contraído · 173 Cuadro Mold 03 Grafic Work 10*30 con Ximena Ortiz?", "Luis: " + (await pregunta(lu)));
    await lu.click("#pasoOpts button[data-val='No']"); await lu.waitForSelector(".box[data-cod=ENCOL]"); await lu.waitForTimeout(200);
    chk(base.parejas[2].estado === "rechazada" && !base.registros.some((r) => r.empleado_id === 9 && r.opcion === "AREA"), "No: queda rechazada y a Luis no se le abre nada");

    // 7) Solo: sin compañero, la apertura no lleva pareja y no hay invitación
    await xi.click(".termine-btn[data-cod=CONTR]"); await xi.waitForSelector("#cantScreen:not(.hidden)");
    await xi.fill("#cantInput", "3"); await xi.click("#cambioBtn"); await xi.waitForSelector(".box[data-cod=ENCOL]");
    await xi.click(".box[data-cod=ENCOL]"); await xi.fill("#codInput", "185"); await xi.click("#codBtn");
    await xi.waitForSelector("#pasoScreen:not(.hidden)"); await xi.click("#pasoOpts button[data-val='🙋 Solo, sin compañero']");
    await xi.waitForSelector(".termine-btn[data-cod=ENCOL]"); await enviar(xi);
    chk(!ultima(7).detalle && base.parejas.length === 3, "Solo: sin pareja y sin invitación");
    // 1.40 (Elías: «entró directo sin preguntar por acompañante»): un celular con la sesión del día de antes de la 1.39
    // no tenía la lista de compañeros y arrancaba solo. Ahora la trae de la base al volver a abrir la app
    await xi.click(".termine-btn[data-cod=ENCOL]"); await xi.waitForSelector("#cantScreen:not(.hidden)");
    await xi.fill("#cantInput", "1"); await xi.click("#cambioBtn"); await xi.waitForSelector(".box[data-cod=ENCOL]");
    await xi.evaluate(() => localStorage.removeItem("gt_empleados_v1"));   // como la sesión abierta con la 1.38
    await xi.reload(); await xi.waitForSelector(".box[data-cod=ENCOL]");
    await xi.click(".box[data-cod=ENCOL]"); await xi.fill("#codInput", "173"); await xi.click("#codBtn");
    const pregunto = await xi.waitForSelector("#pasoScreen:not(.hidden)", { timeout: 3000 }).then(() => true, () => false);
    chk(pregunto && (await opciones(xi)).includes("Walter Saucedo"), "sesión del día sin la lista guardada: igual pregunta «¿Con quién?» (la trae de la base)");
    if (pregunto) { await xi.click("#pasoOpts button[data-val='Walter Saucedo']"); await xi.waitForSelector(".termine-btn[data-cod=ENCOL]"); }
    // 8) Corte no pregunta «¿Con quién?»
    await wa.click(".box[data-cod=CORTE]"); await wa.waitForSelector(".termine-btn[data-cod=CORTE]");
    chk(true, "Corte arranca directo, sin «¿Con quién?»");
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? `\n${fallas.length} falla(s)` : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

// De a dos en Encolado y Contraído. 1.45 (Elías: «uno inicia la tarea y al otro, al entrar en Encolado, ya le aparece la
// que inició el compañero y se une. Las unidades las pone el que empezó la tarea y se le notifica que él tiene que poner
// las unidades»). Reemplaza el «¿Con quién?» y el Sí / No de la 1.39.
// Tres celulares contra una base simulada que hace lo mismo que la real (gt_v155): gt_pareja_abiertos (lo que se está
// haciendo y todavía no tiene compañero), el trigger gt_pareja_une (pareja aceptada, _invitado al que se suma, «con …» al
// que empezó) y gt_pareja_avisos (al que empezó, mientras su tramo sigue abierto).
// 1.47 (Elías: «mejorá los mensajes de se unió y de las unidades las carga, y el que acompaña no tiene botón de Terminé,
// tiene botón de Me fui»): los avisos van en una ventana (#avisoPop) y el que se sumó se va con «🚪 Me fui».
// Uso: node tests/parejas.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const PELL = { codigo: "PELL", nombre: "Pellegrini" }, ESN = { codigo: "ESN", nombre: "Esnaola" };
const EMPS = [{ id: 7, nombre: "Ximena Ortiz", plantas: [PELL] }, { id: 8, nombre: "Walter Saucedo", plantas: [PELL] },
              { id: 9, nombre: "Luis Luna", plantas: [PELL, ESN] }];
const A = (codigo, nombre, orden, x) => Object.assign({ codigo, nombre, unidad: "cajas encoladas", orden, planta: "PELL", pide_codigo: false, pide_cantidad: true }, x || {});
const AREAS = [A("CORTE", "Corte", 1, { unidad: "unidades cortadas" }), A("ENCOL", "Encolado", 3, { pide_codigo: true }),
               A("CONTR", "Contraído", 7, { pide_codigo: true, unidad: "cajas contraídas" }),
               A("MOVIM", "Movimientos", 30, { pide_cantidad: false }), A("BANO", "Baño", 31, { pide_cantidad: false })];
const CODS = ["ENCOL", "CONTR"].flatMap((rubro) => [
  { rubro, codigo: "173", descripcion: "Cuadro Mold 03 Grafic Work", medida: "10*30" },
  { rubro, codigo: "185", descripcion: "Cuadro Mold 03 Paisajes", medida: "10*30" }]);
const base = { registros: [], parejas: [] };
const nombre = (id) => EMPS.find((e) => e.id === id).nombre;
const cerrado = (a) => base.registros.some((k) => k.empleado_id === a.empleado_id && k.rubro === a.rubro && k.ts_inicio === a.ts_cliente);
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop(), b = body ? JSON.parse(body) : {};
      let out = [];
      if (fn === "gt_clave_validar") out = { ok: true, principal: "PELL", empleados: EMPS };
      else if (fn.startsWith("gt_botones")) out = AREAS;
      else if (fn === "gt_codigos_area2") out = CODS;
      else if (fn.startsWith("gt_registros_hoy")) out = base.registros.filter((r) => r.empleado_id === b.p_empleado);
      else if (fn === "gt_registrar") {
        (b.p_filas || []).forEach((f) => {
          if (base.registros.some((r) => r.client_id === f.client_id)) return;
          f = JSON.parse(JSON.stringify(f)); base.registros.push(f);
          const d = f.detalle || {};
          if (f.opcion === "AREA" && !f.ts_inicio && d._une) {                // ≡ gt_pareja_une
            const l = base.registros.find((r) => r.client_id === d._une && !r.ts_inicio);
            if (!l || l.empleado_id === f.empleado_id || base.parejas.some((p) => p.client_id === l.client_id)) return;
            const p = { id: base.parejas.length + 1, client_id: l.client_id, de_id: l.empleado_id, para_id: f.empleado_id, rubro: l.rubro,
                        texto: l.texto, ts: l.ts_cliente, estado: "aceptada" };
            base.parejas.push(p);
            f.detalle = Object.assign({}, f.detalle, { _invitado: p.id });
            l.detalle = Object.assign({}, l.detalle || {}, { pareja: "con " + nombre(f.empleado_id) });
          }
        });
        out = { ok: (b.p_filas || []).map((f) => f.client_id), rechazados: [] };
      } else if (fn === "gt_pareja_abiertos") {
        out = base.registros.filter((a) => a.opcion === "AREA" && !a.ts_inicio && a.rubro === b.p_rubro && a.empleado_id !== b.p_empleado &&
            !(a.detalle && (a.detalle._une || a.detalle._invitado)) && !cerrado(a) && !base.parejas.some((p) => p.client_id === a.client_id))
          .map((a) => { const c = CODS.find((x) => x.rubro === a.rubro && x.codigo === a.texto) || {};
            return { client_id: a.client_id, de: nombre(a.empleado_id), empleado_id: a.empleado_id, rubro: a.rubro, texto: a.texto,
                     medida: a.medida || null, descripcion: c.descripcion || null, medida_cod: c.medida || null, planta: a.planta, ts: a.ts_cliente }; });
      } else if (fn === "gt_pareja_avisos") {
        out = base.parejas.filter((p) => p.de_id === b.p_empleado && !base.registros.some((k) => k.empleado_id === p.de_id && k.rubro === p.rubro && k.ts_inicio === p.ts))
          .map((p) => { const ar = AREAS.find((a) => a.codigo === p.rubro);
            return { id: p.id, client_id: p.client_id, quien: nombre(p.para_id), rubro: p.rubro, area: ar.nombre, texto: p.texto, unidad: ar.unidad, pide_cantidad: ar.pide_cantidad }; });
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
const de = (emp) => base.registros.filter((r) => r.empleado_id === emp);
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
  const ventana = async (p) => (await p.textContent("#avisoPop .pop-caja")).replace(/\s+/g, " ").trim();
  const juntas = (p) => p.$$eval("#codJunta button", (bs) => bs.map((b) => b.textContent.replace(/\s+/g, " ").trim()));
  try {
    const xi = await entrar(7), wa = await entrar(8), lu = await entrar(9);

    // 1) Ximena empieza Encolado · 173 sin que le pregunten con quién (nadie más lo está haciendo: nada para sumarse)
    await xi.click(".box[data-cod=ENCOL]"); await xi.waitForSelector("#codScreen:not(.hidden)"); await xi.waitForTimeout(250);
    chk(!(await xi.isVisible("#codJunta")), "Ximena entra a Encolado: no hay nada para sumarse, sólo el código");
    await xi.fill("#codInput", "173"); await xi.click("#codBtn");
    await xi.waitForSelector(".termine-btn[data-cod=ENCOL]", { timeout: 3000 }); await enviar(xi);
    chk(!(await xi.isVisible("#pasoScreen")) && !(de(7).find((r) => r.rubro === "ENCOL").detalle), "arranca directo, sin «¿Con quién?» (1.45)");

    // 2) Walter toca Encolado: le aparece lo de Ximena y se suma
    await wa.click(".box[data-cod=ENCOL]"); await wa.waitForSelector("#codJunta button", { timeout: 3000 });
    const ofrece = await juntas(wa);
    chk(ofrece.length === 1 && /Ximena Ortiz · 173/.test(ofrece[0]) && /Cuadro Mold 03 Grafic Work · 10\*30/.test(ofrece[0]),
        "Walter entra a Encolado y le aparece «" + (ofrece[0] || "nada") + "»");
    await wa.click("#codJunta button"); await wa.waitForSelector("#avisoPop:not(.hidden)", { timeout: 3000 });
    const sumo = await ventana(wa);
    chk(sumo.includes("Te sumaste a Ximena Ortiz") && sumo.includes("Encolado · 173") && sumo.includes("Cuadro Mold 03 Grafic Work · 10*30") &&
        sumo.includes("Las cajas encoladas las carga Ximena Ortiz: vos no cargás nada") && sumo.includes("tocá «🚪 Me fui»"),
        "a Walter se le abre la ventana «" + sumo + "»");
    await wa.click("#avisoBtns button"); await wa.waitForSelector("#avisoPop.hidden", { state: "attached" });
    await wa.waitForSelector(".termine-btn[data-cod=ENCOL]"); await enviar(wa);
    const wAp = de(8).find((r) => r.rubro === "ENCOL" && !r.ts_inicio);
    chk(wAp && wAp.texto === "173" && wAp.detalle.pareja === "con Ximena Ortiz" && wAp.detalle._une && wAp.detalle._invitado === 1,
        "se sumó: el mismo 173, «con Ximena Ortiz», y la base le pone la marca de la pareja");
    const abW = (await wa.textContent("#abiertaBox")).replace(/\s+/g, " ");
    chk(abW.includes("Encolado · 173 · con Ximena Ortiz") && abW.includes("📝 las cajas encoladas las carga Ximena Ortiz") && !/_une|_invitado/.test(abW),
        "Walter ve «" + abW.trim() + "»");
    chk((await wa.textContent(".termine-btn[data-cod=ENCOL]")).trim() === "🚪 Me fui" && (await wa.isVisible(".pausa-btn[data-pausa=BANO]")),
        "Walter no tiene «Terminé»: tiene «🚪 Me fui» (y Baño / Movimientos)");

    // 3) a Ximena le llega el aviso: las cajas las pone ella
    await xi.waitForSelector("#avisoPop:not(.hidden)", { timeout: 7000 });
    const aviso = await ventana(xi);
    chk(aviso.includes("Walter Saucedo se sumó a tu Encolado") && aviso.includes("173 · Cuadro Mold 03 Grafic Work · 10*30") &&
        aviso.includes("Al terminar, las cajas encoladas las cargás vos: las de los dos") && aviso.includes("Walter Saucedo no carga nada"),
        "a Ximena le avisa sola (cada 5 s), en una ventana: «" + aviso + "»");
    chk(await xi.isVisible("#optionsScreen"), "la ventana va encima de la botonera (no la saca de la pantalla)");
    await xi.click("#avisoBtns button"); await xi.waitForSelector(".termine-btn[data-cod=ENCOL]");
    const abX = (await xi.textContent("#abiertaBox")).replace(/\s+/g, " ");
    chk(abX.includes("173 · con Walter Saucedo") && abX.includes("📝 las cajas encoladas las cargás vos: las de los dos") &&
        (await xi.textContent(".termine-btn[data-cod=ENCOL]")).trim() === "✅ Terminé", "y su Encolado dice «" + abX.trim() + "», con «✅ Terminé»");
    await xi.evaluate(() => window.__gt.revisarParejas()); await xi.waitForTimeout(300);
    chk(!(await xi.isVisible("#avisoPop")), "el aviso sale una sola vez");

    // 4) Luis toca Encolado: lo de Ximena ya tiene compañero, no se lo ofrece
    await lu.click(".box[data-cod=ENCOL]"); await lu.waitForSelector("#codScreen:not(.hidden)"); await lu.waitForTimeout(300);
    chk(!(await lu.isVisible("#codJunta")), "a Luis no le aparece el 173: ya son dos");
    await lu.click("#codVolver"); await lu.waitForSelector("#optionsScreen:not(.hidden)");

    // 5) Walter se va: «🚪 Me fui» pide confirmar; «Sigo con Ximena» no cierra nada; «Sí, me fui» cierra sin cajas
    await wa.click(".termine-btn[data-cod=ENCOL]"); await wa.waitForSelector("#avisoPop:not(.hidden)");
    const vaS = await ventana(wa);
    chk(vaS.includes("¿Te vas del Encolado · 173?") && vaS.includes("Con Ximena Ortiz desde las") && vaS.includes("Las cajas encoladas las carga Ximena Ortiz: vos no cargás nada") &&
        !(await wa.isVisible("#cantScreen")), "«🚪 Me fui»: «" + vaS + "» (sin la pantalla de cajas)");
    await wa.click("#avisoBtns button:has-text('Sigo con Ximena Ortiz')"); await wa.waitForTimeout(150);
    chk(!(await wa.isVisible("#avisoPop")) && (await wa.isVisible(".termine-btn[data-cod=ENCOL]")) && !de(8).some((r) => r.rubro === "ENCOL" && r.ts_inicio),
        "«Sigo con Ximena Ortiz»: sigue en el Encolado, no se cerró nada");
    await wa.click(".termine-btn[data-cod=ENCOL]"); await wa.click("#avisoBtns button:has-text('Sí, me fui')");
    await wa.waitForSelector(".box[data-cod=ENCOL]"); await enviar(wa);
    const wc = de(8).find((r) => r.rubro === "ENCOL" && r.ts_inicio);
    chk(wc && wc.cantidad == null && wc.texto === "173" && wc.ts_inicio === wAp.ts_cliente && !(await wa.isVisible("#cantScreen")),
        "«Sí, me fui»: cierre de Walter sin cantidad y vuelve la botonera, sin «¿con qué seguís?»");

    // 6) Ximena termina con las de los dos
    await xi.click(".termine-btn[data-cod=ENCOL]"); await xi.waitForSelector("#cantScreen:not(.hidden)");
    const pide = (await xi.textContent("#cantLabel")).trim() + " / " + (await xi.textContent("#cantSub")).trim();
    chk(pide.includes("¿Cuántas cajas encoladas del 173 hicieron entre vos y Walter Saucedo?") && pide.includes("las de los dos, no sólo las tuyas"),
        "a Ximena le pide las cajas de los dos: «" + pide + "»");
    await xi.fill("#cantInput", "12"); await xi.click("#cambioBtn"); await xi.waitForSelector(".box[data-cod=ENCOL]"); await enviar(xi);
    const xc = de(7).find((r) => r.rubro === "ENCOL" && r.ts_inicio);
    chk(xc && xc.cantidad === 12 && xc.detalle && xc.detalle.pareja === "con Walter Saucedo", "su cierre lleva las 12 cajas y «con Walter Saucedo»");

    // 7) Contraído: Luis empieza el 185 y a Walter le aparece ése (no el 173 de Ximena, que ya cerró)
    await lu.click(".box[data-cod=CONTR]"); await lu.fill("#codInput", "185"); await lu.click("#codBtn"); await lu.waitForSelector(".termine-btn[data-cod=CONTR]"); await enviar(lu);
    await wa.click(".box[data-cod=CONTR]"); await wa.waitForSelector("#codJunta button", { timeout: 3000 });
    const ofreceC = await juntas(wa);
    chk(ofreceC.length === 1 && /Luis Luna · 185/.test(ofreceC[0]), "Contraído: a Walter le aparece «Luis Luna · 185»");
    // 8) Luis se va al baño y Walter se suma: el aviso espera a que Luis vuelva
    await lu.click(".pausa-btn[data-pausa=BANO]"); await lu.waitForSelector(".termine-btn[data-cod=BANO]");
    await wa.click("#codJunta button"); await wa.waitForSelector("#avisoPop:not(.hidden)"); await wa.click("#avisoBtns button");
    await wa.waitForSelector(".termine-btn[data-cod=CONTR]"); await enviar(wa);
    await lu.evaluate(() => window.__gt.revisarParejas()); await lu.waitForTimeout(400);
    chk(!(await lu.isVisible("#avisoPop")) && (await lu.isVisible(".termine-btn[data-cod=BANO]")), "con Luis en el baño, el aviso espera (no le tapa la pausa)");
    await lu.click(".termine-btn[data-cod=BANO]"); await lu.waitForSelector(".termine-btn[data-cod=CONTR]");
    await lu.evaluate(() => window.__gt.revisarParejas()); await lu.waitForSelector("#avisoPop:not(.hidden)", { timeout: 3000 });
    const avC = await ventana(lu);
    chk(avC.includes("Walter Saucedo se sumó a tu Contraído") && avC.includes("185 · Cuadro Mold 03 Paisajes") && avC.includes("las cajas contraídas las cargás vos"),
        "volvió del baño: «" + avC + "»");
    await lu.click("#avisoPop", { position: { x: 5, y: 5 } });   // tocar afuera la cierra
    chk(!(await lu.isVisible("#avisoPop")), "tocar afuera cierra la ventana");
    // 8b) Walter, en Contraído con Luis, se va al movimiento y desde ahí dice que no sigue: se va sin la pantalla de cajas
    await wa.click(".pausa-btn[data-pausa=MOVIM]"); await wa.waitForSelector(".termine-btn[data-cod=MOVIM]");
    await wa.click(".termine-btn[data-cod=MOVIM]"); await wa.waitForSelector("#pasoScreen:not(.hidden)");
    chk(await wa.isVisible("#pasoOpts button[data-val='No, me fui de Contraído']"), "desde un Movimiento: «No, me fui de Contraído» (no «terminé»)");
    await wa.click("#pasoOpts button[data-val='No, me fui de Contraído']"); await wa.waitForSelector(".box[data-cod=CONTR]"); await enviar(wa);
    chk(de(8).some((r) => r.rubro === "CONTR" && r.ts_inicio && r.cantidad == null) && !(await wa.isVisible("#cantScreen")), "y se cierra su Contraído sin cajas");
    // 9) en Corte no aparece nada de parejas
    await xi.click(".box[data-cod=CORTE]"); await xi.waitForSelector(".termine-btn[data-cod=CORTE]");
    chk(true, "Corte arranca directo, sin nada de parejas");
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? `\n${fallas.length} falla(s)` : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

// De a dos en Encolado y Contraído. 1.45 (Elías: «uno inicia la tarea y al otro, al entrar en Encolado, ya le aparece la
// que inició el compañero y se une. Las unidades las pone el que empezó la tarea y se le notifica que él tiene que poner
// las unidades»). Reemplaza el «¿Con quién?» y el Sí / No de la 1.39.
// Tres celulares contra una base simulada que hace lo mismo que la real (gt_v155): gt_pareja_abiertos (lo que se está
// haciendo y todavía no tiene compañero), el trigger gt_pareja_une (pareja aceptada, _invitado al que se suma, «con …» al
// que empezó) y gt_pareja_avisos (al que empezó, mientras su tramo sigue abierto).
// 1.47 (Elías: «mejorá los mensajes de se unió y de las unidades las carga, y el que acompaña no tiene botón de Terminé,
// tiene botón de Me fui»): los avisos van en una ventana (#avisoPop) y el que se sumó se va con «🚪 Me fui».
// 1.48 (D58, Elías: «sí»): cuando uno se va se le avisa al otro y el tramo se vuelve a ofrecer (otro compañero se puede
// sumar, uno por vez). La base simulada hace lo de gt_v157 (gt.pareja_adentro, gt_pareja_avisos2 con «sumados» y
// «terminados», varias parejas por tramo).
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
const cierre = (a) => base.registros.find((k) => k.empleado_id === a.empleado_id && k.rubro === a.rubro && k.ts_inicio === a.ts_cliente);
const cerrado = (a) => !!cierre(a);
const suya = (p) => base.registros.find((j) => j.empleado_id === p.para_id && !j.ts_inicio && j.detalle && j.detalle._invitado === p.id);
const adentro = (p) => { const j = suya(p); return !!j && !cerrado(j); };   // ≡ gt.pareja_adentro
const abiertos = (emp, rubro) => base.registros.filter((a) => a.opcion === "AREA" && !a.ts_inicio && a.rubro === rubro && a.empleado_id !== emp &&
    !(a.detalle && (a.detalle._une || a.detalle._invitado)) && !cerrado(a) &&
    !base.registros.some((n) => n.empleado_id === a.empleado_id && n.ts_cliente > a.ts_cliente && n.opcion === "AREA" && !n.ts_inicio && ["ENCOL", "CONTR", "CORTE"].includes(n.rubro)) &&
    !base.parejas.some((p) => p.client_id === a.client_id && adentro(p)))
  .map((a) => { const c = CODS.find((x) => x.rubro === a.rubro && x.codigo === a.texto) || {};
    return { client_id: a.client_id, de: nombre(a.empleado_id), empleado_id: a.empleado_id, rubro: a.rubro, texto: a.texto,
             medida: a.medida || null, descripcion: c.descripcion || null, medida_cod: c.medida || null, planta: a.planta, ts: a.ts_cliente }; });
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
          if (f.opcion === "AREA" && !f.ts_inicio && d._une) {                // ≡ gt.trg_pareja_une (gt_v157)
            const l = base.registros.find((r) => r.client_id === d._une && !r.ts_inicio);
            if (!l || l.empleado_id === f.empleado_id) return;
            const k = cierre(l); if (k && k.ts_cliente <= f.ts_cliente) return;                     // ya había terminado
            if (base.parejas.some((p) => p.client_id === l.client_id && adentro(p))) return;     // uno por vez
            const p = { id: base.parejas.length + 1, client_id: l.client_id, de_id: l.empleado_id, para_id: f.empleado_id, rubro: l.rubro,
                        texto: l.texto, ts: l.ts_cliente, estado: "aceptada" };
            base.parejas.push(p);
            f.detalle = Object.assign({}, f.detalle, { _invitado: p.id });
            const noms = base.parejas.filter((q) => q.client_id === l.client_id).map((q) => nombre(q.para_id)).filter((n, i, a) => a.indexOf(n) === i);
            l.detalle = Object.assign({}, l.detalle || {}, { pareja: "con " + noms.join(" y ") });
          }
        });
        out = { ok: (b.p_filas || []).map((f) => f.client_id), rechazados: [] };
      } else if (fn === "gt_pareja_abiertos") {
        out = abiertos(b.p_empleado, b.p_rubro);
      } else if (fn === "gt_pareja_avisos2") {                                  // ≡ gt_pareja_avisos2 (gt_v157)
        const ar = (c) => AREAS.find((a) => a.codigo === c), lider = (p) => ({ empleado_id: p.de_id, rubro: p.rubro, ts_cliente: p.ts });
        out = {
          sumados: base.parejas.filter((p) => p.de_id === b.p_empleado && !cerrado(lider(p))).map((p) => { const j = suya(p), k = j && cierre(j);
            return { id: p.id, client_id: p.client_id, quien: nombre(p.para_id), rubro: p.rubro, area: ar(p.rubro).nombre, texto: p.texto,
                     unidad: ar(p.rubro).unidad, pide_cantidad: ar(p.rubro).pide_cantidad, desde: j ? j.ts_cliente : null, se_fue: k ? k.ts_cliente : null }; }),
          terminados: base.parejas.filter((p) => p.para_id === b.p_empleado && adentro(p) && cerrado(lider(p))).map((p) => { const k = cierre(lider(p));
            return { id: p.id, une: p.client_id, mio: suya(p).client_id, de: nombre(p.de_id), rubro: p.rubro, area: ar(p.rubro).nombre, texto: p.texto,
                     unidad: ar(p.rubro).unidad, pide_cantidad: ar(p.rubro).pide_cantidad, fin: k.ts_cliente, cantidad: k.cantidad,
                     sigue: abiertos(b.p_empleado, p.rubro).filter((x) => x.empleado_id === p.de_id && Date.parse(x.ts) >= Date.parse(k.ts_cliente) - 5000)[0] || null }; }),
        };
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
    await p.click("#nombreLista button[data-id='" + id + "']"); await p.waitForSelector("#avisoPop:not(.hidden)"); await p.waitForTimeout(450); await p.click("#avisoBtns button[data-i='0']");   // 1.49: «¿Sos …?» Sí
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

    // 5) Walter se va: «🚪 Me fui» cierra en un toque (1.48: sin confirmar), sin cajas y sin «¿con qué seguís?»
    await wa.click(".termine-btn[data-cod=ENCOL]"); await wa.waitForSelector(".box[data-cod=ENCOL]"); await enviar(wa);
    const wc = de(8).find((r) => r.rubro === "ENCOL" && r.ts_inicio);
    chk(wc && wc.cantidad == null && wc.texto === "173" && wc.ts_inicio === wAp.ts_cliente && !(await wa.isVisible("#avisoPop")) && !(await wa.isVisible("#cantScreen")),
        "«🚪 Me fui» en un toque: cierre de Walter sin cantidad y vuelve la botonera");
    // 5b) a Ximena le avisa que Walter se fue, y su tramo lo dice
    await xi.evaluate(() => window.__gt.revisarParejas()); await xi.waitForSelector("#avisoPop:not(.hidden)", { timeout: 3000 });
    const fue = await ventana(xi);
    chk(fue.includes("Walter Saucedo se fue de tu Encolado") && /Estuvo de \d\d:\d\d a \d\d:\d\d/.test(fue) &&
        fue.includes("Al terminar, las cajas encoladas las cargás vos: todas las del tramo") && fue.includes("Si viene otro compañero, se puede sumar"),
        "a Ximena: «" + fue + "»");
    await xi.click("#avisoBtns button"); await xi.waitForSelector(".termine-btn[data-cod=ENCOL]");
    chk(/Walter Saucedo se fue \d\d:\d\d · las cajas encoladas las cargás vos: todas las del tramo/.test(await xi.textContent("#abiertaBox")),
        "su Encolado dice «Walter Saucedo se fue HH:MM · … todas las del tramo»");
    // 5c) el tramo se vuelve a ofrecer: Luis se suma
    await lu.click(".box[data-cod=ENCOL]"); await lu.waitForSelector("#codJunta button", { timeout: 3000 });
    chk(/Ximena Ortiz · 173/.test((await juntas(lu))[0] || ""), "Walter se fue: a Luis ahora sí le aparece «Ximena Ortiz · 173»");
    await lu.click("#codJunta button"); await lu.waitForSelector("#avisoPop:not(.hidden)"); await lu.click("#avisoBtns button");
    await lu.waitForSelector(".termine-btn[data-cod=ENCOL]"); await enviar(lu);
    chk(de(9).some((r) => r.rubro === "ENCOL" && !r.ts_inicio && r.detalle && r.detalle._invitado === 2), "Luis se sumó al mismo tramo (otra pareja)");
    await xi.evaluate(() => window.__gt.revisarParejas()); await xi.waitForSelector("#avisoPop:not(.hidden)", { timeout: 3000 });
    chk((await ventana(xi)).includes("Luis Luna se sumó a tu Encolado"), "a Ximena: «Luis Luna se sumó a tu Encolado»");
    await xi.click("#avisoBtns button"); await xi.waitForSelector(".termine-btn[data-cod=ENCOL]");
    chk((await xi.textContent("#abiertaBox")).includes("173 · con Walter Saucedo y Luis Luna"), "su tramo: «con Walter Saucedo y Luis Luna»");
    // un tercero no lo ve mientras Luis está adentro (Walter, que ya se fue)
    await wa.click(".box[data-cod=ENCOL]"); await wa.waitForSelector("#codScreen:not(.hidden)"); await wa.waitForTimeout(300);
    chk(!(await wa.isVisible("#codJunta")), "con Luis adentro, a Walter no le aparece (uno por vez)");
    await wa.click("#codVolver"); await wa.waitForSelector("#optionsScreen:not(.hidden)");

    // 6) Ximena termina con las de los tres y sigue con el 185
    await xi.click(".termine-btn[data-cod=ENCOL]"); await xi.waitForSelector("#cantScreen:not(.hidden)");
    const pide = (await xi.textContent("#cantLabel")).trim() + " / " + (await xi.textContent("#cantSub")).trim();
    chk(pide.includes("¿Cuántas cajas encoladas del 173 hicieron entre vos, Walter Saucedo y Luis Luna?") && pide.includes("las de todos, no sólo las tuyas"),
        "a Ximena le pide las de todos: «" + pide + "»");
    await xi.fill("#cantInput", "12"); await xi.fill("#sigueInput", "185"); await xi.click("#cantBtn");
    await xi.waitForSelector(".termine-btn[data-cod=ENCOL]"); await enviar(xi);
    const xc = de(7).find((r) => r.rubro === "ENCOL" && r.ts_inicio);
    chk(xc && xc.cantidad === 12 && xc.detalle && xc.detalle.pareja === "con Walter Saucedo y Luis Luna", "su cierre lleva las 12 cajas y «con Walter Saucedo y Luis Luna»");
    // 6b) a Luis: Ximena terminó; su parte se cierra a esa hora y le ofrece seguir con ella en el 185
    await lu.evaluate(() => window.__gt.revisarParejas()); await lu.waitForSelector("#avisoPop:not(.hidden)", { timeout: 3000 });
    const term = await ventana(lu);
    chk(term.includes("Ximena Ortiz terminó el Encolado · 173") && term.includes("cargó 12 cajas encoladas") &&
        term.includes("Tu parte quedó cerrada") && term.includes("Seguir con Ximena Ortiz en el 185"), "a Luis: «" + term + "»");
    await enviar(lu);
    const lc = de(9).find((r) => r.rubro === "ENCOL" && r.ts_inicio && r.texto === "173");
    chk(lc && lc.cantidad == null && lc.ts_cliente === xc.ts_cliente, "su 173 se cerró solo, sin cajas, a la hora en que terminó Ximena");
    await lu.click("#avisoBtns button:has-text('Seguir con Ximena Ortiz')"); await lu.waitForSelector("#avisoPop:not(.hidden)");
    chk((await ventana(lu)).includes("Te sumaste a Ximena Ortiz"), "«Seguir con Ximena Ortiz en el 185» lo suma al 185");
    await lu.click("#avisoBtns button"); await lu.waitForSelector(".termine-btn[data-cod=ENCOL]"); await enviar(lu);
    chk(de(9).some((r) => r.rubro === "ENCOL" && !r.ts_inicio && r.texto === "185" && r.detalle._invitado), "Luis en el 185 con Ximena");
    // 6c) a Ximena: el mismo compañero sigue con ella → aviso corto, sin ventana
    await xi.evaluate(() => window.__gt.revisarParejas()); await xi.waitForTimeout(400);
    chk(!(await xi.isVisible("#avisoPop")) && (await xi.textContent("#toast")).includes("Luis Luna sigue con vos en el 185") &&
        (await xi.textContent("#abiertaBox")).includes("185 · con Luis Luna"), "a Ximena: «🤝 Luis Luna sigue con vos en el 185», sin ventana");
    // Luis se va del 185
    await lu.click(".termine-btn[data-cod=ENCOL]"); await lu.waitForSelector(".box[data-cod=ENCOL]"); await enviar(lu);
    await xi.evaluate(() => window.__gt.revisarParejas()); await xi.waitForSelector("#avisoPop:not(.hidden)", { timeout: 3000 });
    await xi.click("#avisoBtns button");

    // 7) Contraído: Luis empieza el 185 y a Walter le aparece ése
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
    await lu.evaluate(() => window.__gt.revisarParejas()); await lu.waitForSelector("#avisoPop:not(.hidden)", { timeout: 3000 });
    chk((await ventana(lu)).includes("Walter Saucedo se fue de tu Contraído"), "y a Luis le avisa que Walter se fue");
    await lu.click("#avisoBtns button");
    // 9) Ximena termina el 185 (Luis ya se fue: «todas las del tramo») y en Corte no aparece nada de parejas
    await xi.click(".termine-btn[data-cod=ENCOL]"); await xi.waitForSelector("#cantScreen:not(.hidden)");
    chk(/todas las del tramo \(Luis Luna se fue \d\d:\d\d\)/.test(await xi.textContent("#cantSub")), "185 sin Luis: «todas las del tramo (Luis Luna se fue HH:MM)»");
    await xi.fill("#cantInput", "3"); await xi.click("#cambioBtn"); await xi.waitForSelector(".box[data-cod=CORTE]");
    await xi.click(".box[data-cod=CORTE]"); await xi.waitForSelector(".termine-btn[data-cod=CORTE]");
    chk(true, "Corte arranca directo, sin nada de parejas");
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? `\n${fallas.length} falla(s)` : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

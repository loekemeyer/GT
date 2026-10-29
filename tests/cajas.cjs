// 1.68 (Angely, 29/10/2026, D4 «sí»): cuántas cajas hay que armar, a la vista.
//   · celular: en «¿Qué caja vas a armar?» cada botón dice «armar N» / «NO ARMAR MÁS» / «sin emblistado». Sólo AVISA: la caja se arma igual.
//   · admin: pestaña «🗃️ Cajas», en vivo (se actualiza sola), con lo emblistado, las armadas y el estado de cada caja.
// Sin corte de conteo, sin red o con la clave mala, nada se rompe: los botones salen como siempre y el admin dice qué falta.
// Uso: node tests/cajas.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const PASS = "9999", CLAVE = "4821";
const A = (codigo, nombre, orden, x) => Object.assign({ codigo, nombre, unidad: "cajas", orden, planta: "PELL", pide_codigo: true, pide_cantidad: true, solo: null }, x || {});
const AREAS = [A("CORTE", "Corte", 1, { unidad: "unidades cortadas" }), A("CONTR", "Contraído", 7), A("ARMCAJ", "Armado de cajas", 33, { unidad: "cajas armadas" })];
const CAJAS = ["10", "12", "13", "14", "15", "16", "2", "20*50", "22", "29", "30", "38*38", "40*15", "40*50", "5",
               "Caja Cuadros Set", "Caja Notebook", "Exhi 2 Porta", "Exhi 3 Porta", "Exhi Cuadro", "IMP", "Tapa + Base"];
const CODS = [{ rubro: "CONTR", codigo: "183", descripcion: "Cuadro Mold 03 Ciudades", medida: "30*40" }]
  .concat(CAJAS.map((codigo) => ({ rubro: "ARMCAJ", codigo, descripcion: null, medida: null })));
// lo que manda la base (gt.demanda_cajas): con corte
const fila = (caja, articulos, hacen, armadas, tono, etiqueta, estado) =>
  ({ caja, articulos, hacen_falta: hacen, armadas, a_armar: tono === "armar" ? Number(etiqueta.replace(/\D/g, "")) : 0, tono, etiqueta, estado, corte_en: "2026-10-29T15:00:00+00:00" });
const CON_CORTE = [
  fila("40*15", 34, 529, 400, "armar", "armar 129", "armar 129"),
  fila("30", 28, 127, 20, "armar", "armar 107", "armar 107"),
  fila("12", 11, 20, 23, "nomas", "NO ARMAR MÁS", "NO ARMAR MÁS: alcanzan (sobran 3)"),
  fila("5", 5, 0, 0, "nada", "sin emblistado", "sin nada emblistado"),
  fila("2", 0, 0, 0, "nada", "sin emblistado", "sin nada emblistado"),
  fila("(sin caja)", 2, 3, null, "armar", "armar 3", "falta cargar la caja de 2 artículos emblistados"),
];
const SIN_CORTE = CON_CORTE.map((r) => Object.assign({}, r, { tono: null, etiqueta: null, corte_en: null, articulos: 0, hacen_falta: 0 }));
let datos = CON_CORTE, caido = false;
const filas = [];
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop(), b = body ? JSON.parse(body) : {};
      if (fn === "gt_registrar") (b.p_filas || []).forEach((f) => { if (!filas.some((x) => x.client_id === f.client_id)) filas.push(f); });
      if ((fn === "gt_cajas_estado" || fn === "gt_admin_cajas") && caido) { res.writeHead(500); return res.end("caído"); }
      const out = fn === "gt_monitor_login" ? { ok: b.p_pass === PASS }
        : fn === "gt_monitor_clave" ? (b.p_pass === PASS ? { ok: true, clave: CLAVE, cambia_en_s: 42 } : { ok: false })
        : fn === "gt_clave_validar" ? { ok: true, principal: "PELL", empleados: [{ id: 7, nombre: "Ximena Ortiz", plantas: [] }] }
        : fn.startsWith("gt_botones") ? AREAS : fn === "gt_codigos_area2" ? CODS : fn === "gt_pasos" ? []
        : fn === "gt_cajas_estado" ? datos.filter((r) => r.caja !== "(sin caja)").map((r) => ({ caja: r.caja, tono: r.tono, etiqueta: r.etiqueta }))
        : fn === "gt_admin_cajas" ? (b.p_pass === PASS ? datos : [])
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
async function abrirArmado(br, url, w, h) {
  const pg = await br.newPage({ viewport: { width: w, height: h } });
  await pg.goto(url); await pg.fill("#claveInput", "1234"); await pg.click("#claveBtn");
  await pg.click("#nombreLista button[data-id='7']"); await pg.waitForSelector("#avisoPop:not(.hidden)"); await pg.waitForTimeout(450);
  await pg.click("#avisoBtns button[data-i='0']"); await pg.waitForSelector(".box[data-cod=CONTR]");
  await pg.click(".box[data-cod=CONTR]"); await pg.waitForSelector("#codScreen:not(.hidden)");
  await pg.click("#codHijas button[data-cod=ARMCAJ]"); await pg.waitForSelector("#codOpts:not(.hidden)");
  return pg;
}
srv.listen(0, async () => {
  const url = "http://localhost:" + srv.address().port + "/";
  const br = await pw.chromium.launch();
  try {
    // ── celular ──
    for (const [w, h] of [[320, 568], [390, 844]]) {
      datos = CON_CORTE; caido = false; filas.length = 0;
      let pg = await abrirArmado(br, url, w, h);
      await pg.waitForSelector("#codOpts small.caja-est", { timeout: 4000 }).catch(() => {});
      const et = await pg.$$eval("#codOpts button", (l) => Object.fromEntries(l.map((b) => [b.dataset.cod, { t: (b.querySelector("small") || {}).textContent || "", c: b.className }])));
      chk(et["40*15"].t === "armar 129" && et["30"].t === "armar 107", w + " px · cada botón dice cuántas cajas faltan armar (40*15: «" + et["40*15"].t + "»)");
      chk(et["12"].t === "NO ARMAR MÁS" && /nomas/.test(et["12"].c), w + " px · la caja que alcanza dice «NO ARMAR MÁS» y se marca");
      chk(et["2"].t === "sin emblistado" && /nada/.test(et["2"].c), w + " px · la que no tiene nada dice «sin emblistado»");
      chk(!et["Tapa + Base"].t, w + " px · una caja que la base no nombra queda como siempre");
      chk(await pg.isVisible(".cajas-nota"), w + " px · una línea explica «faltan armar, según lo emblistado»");
      const cortados = await pg.$$eval("#codOpts button", (l) => l.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.dataset.cod));
      chk(cortados.length === 0, w + " px · ningún botón con el texto cortado (" + (cortados.join(",") || "ok") + ")");
      // «NO ARMAR MÁS» sólo avisa: se puede armar igual (Angely)
      await pg.click('#codOpts button[data-cod="12"]'); await pg.waitForSelector("#optionsScreen:not(.hidden)"); await pg.waitForTimeout(300);
      chk(filas.some((f) => f.rubro === "ARMCAJ" && !f.ts_inicio && f.texto === "12"), w + " px · tocar la «NO ARMAR MÁS» igual abre el armado de esa caja");
      await pg.close();
      // sin corte: los botones salen como siempre
      datos = SIN_CORTE; pg = await abrirArmado(br, url, w, h); await pg.waitForTimeout(700);
      chk((await pg.$$("#codOpts small.caja-est")).length === 0 && !(await pg.$(".cajas-nota")) && (await pg.$$("#codOpts button")).length === 22, w + " px · sin corte de conteo los 22 botones salen sin aviso");
      await pg.close();
      // sin red / base caída
      datos = CON_CORTE; caido = true; pg = await abrirArmado(br, url, w, h); await pg.waitForTimeout(700);
      chk((await pg.$$("#codOpts small.caja-est")).length === 0 && (await pg.$$("#codOpts button")).length === 22, w + " px · con la base caída los botones salen y se puede armar");
      await pg.close(); caido = false;
    }
    // ── admin ──
    datos = CON_CORTE;
    const ad = await br.newPage({ viewport: { width: 1280, height: 900 } });
    await ad.goto(url + "admin.html"); await ad.fill("#passInput", PASS); await ad.click("#passBtn");
    await ad.waitForSelector("#monitor:not(.hidden)");
    await ad.click('.tab[data-tab="cajas"]'); await ad.waitForSelector("#cajasTabla table", { timeout: 4000 });
    const filasT = await ad.$$eval("#cajasTabla tr", (l) => l.slice(1).map((r) => [...r.children].map((c) => c.textContent.trim())));
    chk(filasT.length === 3 && filasT[0][0] === "40*15" && filasT[1][0] === "30" && filasT[2][0] === "12", "admin · las cajas por armar primero (mayor a menor) y después la que alcanza (" + filasT.map((r) => r[0]).join(", ") + ")");
    chk(filasT[0].join("|") === "40*15|34|529|400|armar 129", "admin · una fila: caja, artículos, emblistado, armadas y estado (" + filasT[0].join("|") + ")");
    chk(await ad.$eval("#cajasTabla td.caja-nomas", (e) => e.textContent.includes("NO ARMAR MÁS")), "admin · «NO ARMAR MÁS» marcado");
    chk((await ad.textContent("#cajasTabla")).includes("Sin emblistado ni armadas: 5 · 2"), "admin · las cajas sin movimiento van juntas en una línea, sin filas vacías");
    chk((await ad.textContent("#cajasAviso")).includes("2 artículos emblistados sin caja cargada (3 cajas)"), "admin · avisa los artículos emblistados sin caja");
    chk((await ad.textContent("#cajasInfo")).includes("Corte 29/10 12:00") && (await ad.textContent("#cajasInfo")).includes("cada 10 s"), "admin · dice la hora del corte y que se actualiza solo (" + (await ad.textContent("#cajasInfo")) + ")");
    // en vivo: la base cambia y la pantalla lo toma sola (sin tocar nada)
    datos = CON_CORTE.map((r) => r.caja === "40*15" ? fila("40*15", 34, 529, 529, "nomas", "NO ARMAR MÁS", "NO ARMAR MÁS: alcanzan (sobran 0)") : r);
    await ad.waitForFunction(() => document.querySelector("#cajasTabla td.caja-nomas") && document.querySelector("#cajasTabla tr:nth-child(2) td").textContent.trim() !== "40*15", null, { timeout: 14000 }).catch(() => {});
    const prim = await ad.$eval("#cajasTabla tr:nth-child(2) td", (e) => e.textContent.trim());
    chk(prim === "30", "admin · en vivo: al alcanzar las armadas, la 40*15 pasa a «NO ARMAR MÁS» sin tocar nada (primera fila: " + prim + ")");
    // sin corte
    datos = SIN_CORTE; await ad.click("#cajasRef"); await ad.waitForTimeout(500);
    chk((await ad.textContent("#cajasAviso")).includes("Falta el corte de conteo") && !(await ad.$("#cajasTabla table")), "admin · sin corte dice qué falta y no muestra números");
    // base caída
    caido = true; await ad.click("#cajasRef"); await ad.waitForTimeout(500);
    chk((await ad.textContent("#cajasInfo")).includes("No pude leer las cajas"), "admin · con la base caída lo dice");
    await ad.close();
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? "\n" + fallas.length + " falla(s)" : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

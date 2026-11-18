// gt_v192 / 1.73 (Tomás Beviglia, 18/11/2026): Programación por día → camión (súper = su camión, Retira sin camión, el resto por
// zona), demora en rojo desde 14 días, día vencido, camión a mano; y en el celular, en «Pedidos», Javier tilda las NP armadas
// → «lista para facturar» (gt_ppp_marcar_listos; la base le arma la tarea a Gabriel). En modo vista no graba.
// Uso: node tests/ppp-camiones.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const PASS = "9999", HOY = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
const P = (id, np, cliente, barrio, camion, m3, ent, x) => Object.assign({ id, np, cliente, barrio, camion, m3, kg: 100, entrega_retira: ent, fecha_recep: dia(-3), demora_dias: 3, cod: id, dir_entrega: "x" + id }, x || {});
const PROG = [
  P(1, 3925, "Cencosud SA", "Munro", "Súper · Cencosud", 41, dia(2), { lista_en: new Date().toISOString(), lista_por: "Javier Burgos" }),
  P(2, 3929, "Jorge Antonio Zamar", "Soldati", "Capital Sur", 0.14, dia(2), { demora_dias: 20 }),
  P(3, 3930, "Gonzagero Dia S.A", "Pompeya", "Capital Sur", 0.46, dia(2)),
  P(4, 3928, "Garbarino Franco", "Retira", "Retira", 0.45, dia(2)),
  P(5, 3919, "Cencosud SA", "Munro", "Súper · Cencosud", 5.6, dia(-1)),
];
const marcadas = [], setCam = [];
const AREAS = [{ codigo: "PED", nombre: "Pedidos", unidad: "cajas", orden: 1, planta: "PELL", pide_codigo: false, pide_cantidad: false, solo: null }];
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop(), b = body ? JSON.parse(body) : {};
      if (fn === "gt_ppp_marcar_listos") marcadas.push(b);
      if (fn === "gt_admin_ppp_set_camion") setCam.push(b);
      const out = fn === "gt_monitor_login" ? { ok: b.p_pass === PASS }
        : fn === "gt_monitor_clave" ? (b.p_pass === PASS ? { ok: true, clave: "4821", cambia_en_s: 42 } : { ok: false })
        : fn === "gt_admin_ppp_programacion5" ? PROG
        : fn === "gt_admin_ppp_set_camion" ? 1
        : fn === "gt_clave_validar" ? (b.p_clave === "4821" ? { ok: true, principal: "PELL", empleados: [{ id: 1, nombre: "Javier Burgos", plantas: [] }] } : { ok: false })
        : fn === "gt_botones3" ? AREAS
        : fn === "gt_ppp_para_armar" ? [{ id: 1, np: 3925, cliente: "Cencosud SA", entrega: dia(2), camion: "Súper · Cencosud", lista: true },
                                        { id: 2, np: 3929, cliente: "Jorge Antonio Zamar", entrega: dia(2), camion: "Capital Sur", lista: false },
                                        { id: 3, np: 3930, cliente: "Gonzagero Dia", entrega: dia(2), camion: "Capital Sur", lista: false }]
        : fn === "gt_ppp_marcar_listos" ? { ok: true, marcadas: (b.p_ids || []).length }
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
    const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
    await pg.goto(url + "admin.html"); await pg.fill("#passInput", PASS); await pg.click("#passBtn"); await pg.waitForSelector("#home:not(.hidden)");
    await pg.evaluate(() => window.verTab("ppp")); await pg.click('.ppp-sub[data-sub="prog"]');
    await pg.waitForSelector(".ppp-cam");
    const cams = await pg.$$eval(".ppp-cam", (l) => l.map((x) => x.textContent));
    chk(cams.length === 4, "4 renglones de camión en 2 días (" + cams.length + ")");
    chk(cams[0].includes("Súper · Cencosud") && cams[1].includes("Capital Sur") && cams[2].includes("Retira (sin camión)"), "orden: súper, zona, Retira al final");
    chk(cams[1].includes("2 NP · 2 paradas · 0,600 m³"), "Capital Sur suma NP, paradas y m³ (" + cams[1] + ")");
    chk(cams[0].includes("pasa los 40 m³") && cams[0].includes("1/1 listas"), "súper de 41 m³ avisa el tope y cuenta la lista");
    chk((await pg.textContent(".ppp-day.vencido")).includes("VENCIDO"), "el día pasado sale como VENCIDO");
    chk((await pg.textContent("#pppInfo")).includes("1 vencidos") && (await pg.textContent("#pppInfo")).includes("1 listas"), "el resumen cuenta listas y vencidos");
    chk(await pg.$eval(".ppp-card:has(input[data-id='2']) .c-dem", (e) => e.classList.contains("rojo")), "demora de 20 días en rojo");
    chk((await pg.textContent(".ppp-card:has(input[data-id='1']) .c-lista")).includes("Javier"), "la NP marcada dice «Lista p/ facturar · Javier»");
    await pg.check("input.ap-chk[data-id='3']");
    chk(await pg.isVisible("#apCamion") && !(await pg.isVisible("#apQuitarLista")), "con una NP sin marca: «Pasar a ese camión» sí, «Quitar lista» no");
    await pg.selectOption("#apCamSel", "Súper · Cencosud"); await pg.click("#apCamion"); await pg.waitForTimeout(300);
    chk(setCam.length === 1 && setCam[0].p_camion === "Súper · Cencosud" && setCam[0].p_ids[0] === 3, "pasa la NP al camión elegido");

    // celular de Javier: Pedidos → «Pedidos listos para facturar»
    const c = await br.newContext({ viewport: { width: 360, height: 700 } }), m = await c.newPage();
    await m.goto(url); await m.fill("#claveInput", "4821"); await m.click("#claveBtn");
    await m.click("#nombreLista button[data-id='1']"); await m.waitForSelector("#avisoPop:not(.hidden)"); await m.waitForTimeout(450);
    await m.click("#avisoBtns button[data-i='0']"); await m.waitForSelector(".box[data-cod=PED]");   // «¿Sos …?» Sí
    await m.click('.box[data-cod="PED"]'); await m.waitForSelector(".listos-btn", { timeout: 5000 }).catch(() => {});
    const b = await m.$(".listos-btn");
    chk(!!b, "con «Pedidos» abierto aparece «🧾 Pedidos listos para facturar»");
    await b.click(); await m.waitForSelector("#avisoPop:not(.hidden) .listos-np");
    chk(await m.$eval(".listos-np.ya input", (i) => i.disabled && i.checked), "la que ya está lista viene tildada y bloqueada");
    await m.click(".listos-np:has(input[value='2'])");
    await m.click("#avisoBtns button[data-i='0']"); await m.waitForTimeout(400);
    chk(marcadas.length === 1 && JSON.stringify(marcadas[0].p_ids) === "[2]" && marcadas[0].p_empleado === 1, "manda sólo la NP tildada, con el empleado");
    await c.close();
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? "\n" + fallas.length + " falla(s)" : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

// gt_v194 (Thomas Loekemeyer, 20/11/2026): el pedido NACE EN GT y después va a ISIS. Mide en el admin:
// 📦 Pedidos con NP de GT, «sin NP de ISIS», faltante por renglón y por producto, anotar el N° ISIS y agregar un renglón;
// ✍ Alta manual que crea el pedido en GT (gt_admin_pedido_crear); PDF Krikos por la misma RPC;
// PPP con la NP de GT, el número de ISIS y lo que falta armar; «🧾 Planilla ISIS» (Arial 14, títulos 16) y «🔢 N° ISIS».
// Uso: node tests/pedidos-gt.cjs   (necesita playwright) · FOTO=/ruta/base guarda capturas
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const PASS = "pl.9999";
const dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
const PEDS = [
  { id: 43, np: "TN 0041", origen: "manual", pedido_ref: "TN 0041", cliente_cod: "9999", cliente: "Bazar Prueba SA", fecha: dia(-2) + "T12:00:00Z", dias: 2, vence: dia(12), vencido: false,
    estado: "parcial", es_super: false, cajas: 17, armadas: 4, faltan: 13, pct_armado: 24, nota: null, oc: null, np_isis: null, ppp_id: 41, ppp_estado: "programado", entrega: dia(3), lista_en: null,
    items: [{ codigo: "134", descripcion: "Cuadro Mold 03 Nature", medida: "30*40", uxb: 16, cajas: 5, cajas_armadas: 0, faltan: 5, de_gt: true },
            { codigo: "183", descripcion: "Cuadro Mold 03 Ciudades", medida: "30*40", uxb: 16, cajas: 12, cajas_armadas: 4, faltan: 8, de_gt: true }] },
  { id: 20, np: "TN 0021", origen: "isis", pedido_ref: "3925", cliente_cod: "1919", cliente: "Cencosud SA", fecha: dia(-15) + "T03:00:00Z", dias: 15, vence: dia(-1), vencido: true,
    estado: "abierto", es_super: true, cajas: 0, armadas: 0, faltan: 0, pct_armado: null, nota: "Migrado de la Programación (venía de ISIS, NP 3925) el 21/11/2026", oc: "OC 6509156226",
    np_isis: 3925, ppp_id: 20, ppp_estado: "programado", entrega: dia(1), lista_en: null, items: [] }];
const FALT = [{ codigo: "183", descripcion: "Cuadro Mold 03 Ciudades", uxb: 16, es_de_gt: true, faltan_cajas: 8, pedidos: 1, primera_entrega: dia(3), detalle: "TN 0041 (8)" },
              { codigo: "134", descripcion: "Cuadro Mold 03 Nature", uxb: 16, es_de_gt: true, faltan_cajas: 5, pedidos: 1, primera_entrega: dia(3), detalle: "TN 0041 (5)" }];
const P = (id, pedido_id, np, np_txt, np_isis, cliente, cajas, faltan, x) => Object.assign({ id, pedido_id, np, np_txt, np_isis, cliente, cajas, armadas: cajas == null ? null : cajas - faltan, faltan,
  barrio: "Munro", camion: "Norte", m3: 0.5, kg: 40, entrega_retira: dia(3), fecha_recep: dia(-2), demora_dias: 2, cod: 9999, dir_entrega: "x" + id, estado: "a_programar" }, x || {});
const APROG = [P(41, 43, 41, "TN 0041", null, "Bazar Prueba SA", 17, 13), P(20, 20, 21, "TN 0021", 3925, "Cencosud SA", null, null)];
const PROG = APROG.map((r) => Object.assign({}, r, { estado: "programado" }));
const PLAN = [
  { ppp_id: 41, pedido_id: 43, np: "TN 0041", np_isis: null, entrega: dia(3), cliente_cod: "9999", cliente: "Bazar Prueba SA", vend: null, oc: null, barrio: "Munro", codigo: "183",
    descripcion: "Cuadro Mold 03 Ciudades", cajas: 4, uxb: 16, unidades: 64, base: "armadas", lista: true },
  { ppp_id: 20, pedido_id: 20, np: "TN 0021", np_isis: 3925, entrega: dia(1), cliente_cod: "1919", cliente: "Cencosud SA", vend: "4", oc: "OC 6509156226", barrio: "Munro", codigo: null,
    descripcion: "Sin renglones en GT: este pedido se cargó antes del cambio del 21/11/2026", cajas: null, uxb: null, unidades: null, base: "sin renglones", lista: false }];
const llamadas = {};
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop(), b = body ? JSON.parse(body) : {};
      (llamadas[fn] = llamadas[fn] || []).push(b);
      const out = fn === "gt_admin_identificar" ? { ok: b.p_codigo === "K7P+4M", token: PASS, nombre: "Prueba Test", resta_s: 28800 }
        : fn === "gt_monitor_login" ? { ok: b.p_pass === PASS }
        : fn === "gt_monitor_clave" ? (b.p_pass === PASS ? { ok: true, clave: "4821", cambia_en_s: 42 } : { ok: false })
        : fn === "gt_admin_pedidos2" ? PEDS
        : fn === "gt_admin_faltante" ? FALT
        : fn === "gt_admin_pedido_isis" ? { ok: true, np: "TN 0041", np_isis: b.p_np_isis }
        : fn === "gt_admin_pedido_renglon" ? { ok: true, estado: "parcial" }
        : fn === "gt_admin_pedido_crear" ? (b.p_json.cliente ? { ok: true, id: 44, np: "TN 0042", ppp_id: 42, renglones: (b.p_json.items || []).length } : { ok: false, error: "falta el cliente" })
        : fn === "gt_admin_ppp_a_programar6" ? APROG
        : fn === "gt_admin_ppp_programacion6" ? PROG
        : fn === "gt_admin_isis_planilla" ? PLAN.filter((r) => (b.p_ids || []).includes(r.ppp_id)) : [];
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
const espera = async (fn, n) => { for (let i = 0; i < 40 && (llamadas[fn] || []).length < n; i++) await new Promise((r) => setTimeout(r, 100)); };
srv.listen(0, async () => {
  const url = "http://localhost:" + srv.address().port + "/";
  const br = await pw.chromium.launch();
  try {
    const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
    pg.on("dialog", (d) => d.accept(d.type() === "prompt" ? "5123" : undefined));
    await pg.goto(url + "admin.html"); await pg.fill("#passInput", "K7P+4M"); await pg.click("#passBtn"); await pg.waitForSelector("#home:not(.hidden)");

    // 📦 Pedidos
    await pg.evaluate(() => window.verTab("ped")); await pg.waitForSelector("#pedLista .bloque");
    const b43 = await pg.textContent('#pedLista .bloque[data-id="43"]'), b20 = await pg.textContent('#pedLista .bloque[data-id="20"]');
    chk(b43.includes("TN 0041") && b43.includes("Alta manual") && b43.includes("sin NP de ISIS"), "el pedido manual tiene NP de GT y dice que todavía no tiene NP de ISIS");
    chk(b43.includes("Faltan 13 cajas") && b43.includes("Programado"), "dice cuánto falta armar y que está programado");
    chk(await pg.$eval('#pedLista .bloque[data-id="43"] tr:nth-child(3) td:last-child', (e) => e.textContent === "8" && e.classList.contains("falt")), "el renglón 183 (4 de 12) muestra 8 que faltan en rojo");
    chk(b20.includes("TN 0021") && b20.includes("ISIS 3925") && b20.includes("Venía de ISIS") && b20.includes("Sin renglones"), "el migrado tiene NP de GT, su ISIS 3925 y avisa que vino sin renglones");
    chk(!(await pg.$('#pedLista .bloque[data-id="20"] button[data-acc=guardar]')) && !!(await pg.$('#pedLista .bloque[data-id="20"] .ped-add')), "sin renglones: no hay «Guardar armado» pero sí «＋ Renglón»");
    chk((await pg.textContent("#pedInfo")).includes("faltan 13 cajas") && (await pg.textContent("#pedInfo")).includes("1 sin ISIS"), "el resumen cuenta cajas que faltan y pedidos sin ISIS");
    await pg.click("#pedFaltBtn"); await pg.waitForSelector("#pedFalt table");
    const ft = await pg.textContent("#pedFalt");
    chk(ft.includes("2 productos") && ft.includes("13 cajas") && ft.includes("TN 0041 (8)"), "📉 Faltante por producto: 2 productos, 13 cajas y de qué NP");
    if (process.env.FOTO) await pg.screenshot({ path: process.env.FOTO + "-pedidos.png", fullPage: true });
    await pg.click('#pedLista .bloque[data-id="43"] button[data-acc=isis]'); await espera("gt_admin_pedido_isis", 1);
    chk((llamadas.gt_admin_pedido_isis || [])[0] && llamadas.gt_admin_pedido_isis[0].p_pedido_id === 43 && llamadas.gt_admin_pedido_isis[0].p_np_isis === 5123, "«Anotar N° ISIS» manda el número que dio ISIS");
    await espera("gt_admin_pedidos2", 2); await pg.waitForTimeout(300);   // después de anotar el ISIS la lista se recarga
    await pg.fill('#pedLista .bloque[data-id="20"] input.add-cod', "183"); await pg.fill('#pedLista .bloque[data-id="20"] input.add-caj', "6");
    await pg.click('#pedLista .bloque[data-id="20"] button[data-acc=renglon]'); await espera("gt_admin_pedido_renglon", 1);
    chk((llamadas.gt_admin_pedido_renglon || [])[0] && llamadas.gt_admin_pedido_renglon[0].p_codigo === "183" && llamadas.gt_admin_pedido_renglon[0].p_cajas === 6, "«＋ Renglón» agrega 183 × 6 al migrado");

    // ✍ Alta manual
    await pg.click("#pedNuevo"); await pg.waitForSelector("#manCli");
    chk(await pg.$eval('.cp-sub[data-cp="manual"]', (e) => e.classList.contains("on")), "«➕ Nuevo pedido» abre Cargar pedido → ✍ Alta manual");
    await pg.click("#manCrear"); chk((await pg.textContent("#manMsg")).includes("Falta el cliente"), "sin cliente no se crea");
    await pg.fill("#manCli", "Bazar Nuevo SRL"); await pg.fill("#manCod", "2200"); await pg.fill("#manEnt", dia(4)); await pg.fill("#manBar", "Pompeya");
    const filas = await pg.$$("#manItems tr");
    await (await filas[1].$(".mc")).fill("134"); await (await filas[1].$(".mj")).fill("3");
    await (await filas[2].$(".mc")).fill("183"); await (await filas[2].$(".mj")).fill("7");
    await pg.click("#manCrear"); await espera("gt_admin_pedido_crear", 1);
    const cr = (llamadas.gt_admin_pedido_crear || [])[0];
    chk(cr && cr.p_json.origen === "manual" && cr.p_json.cliente === "Bazar Nuevo SRL" && cr.p_json.items.length === 2 && cr.p_json.items[1].cajas === 7 && cr.p_json.barrio === "Pompeya",
      "el alta manual manda cliente, barrio y los 2 renglones a gt_admin_pedido_crear");
    await pg.waitForFunction(() => document.getElementById("manMsg").textContent.includes("TN 0042"));
    chk((await pg.textContent("#manMsg")).includes("TN 0042 creado con 2 renglones"), "contesta con la NP de GT que le tocó");
    if (process.env.FOTO) await pg.screenshot({ path: process.env.FOTO + "-alta.png", fullPage: true });

    // PPP: A Programar y Programación
    await pg.evaluate(() => window.verTab("ppp")); await pg.waitForSelector(".ppp-card");
    const c41 = await pg.textContent(".ppp-card:has(input[data-id='41'])"), c20 = await pg.textContent(".ppp-card:has(input[data-id='20'])");
    chk(c41.includes("NP TN 0041") && c41.includes("sin ISIS") && c41.includes("faltan 13 cj"), "A Programar: NP de GT, «sin ISIS» y lo que falta armar");
    chk(c20.includes("NP TN 0021") && c20.includes("ISIS 3925") && c20.includes("sin renglones"), "el migrado muestra su ISIS y que no tiene renglones");
    await pg.click('.ppp-sub[data-sub="prog"]'); await pg.waitForSelector(".ppp-cam");
    await pg.check("input.ap-chk[data-id='41']");
    chk(await pg.isVisible("#apIsisPl") && await pg.isVisible("#apIsisNum"), "Programación con una NP tildada: «🧾 Planilla ISIS» y «🔢 N° ISIS»");
    await pg.check("input.ap-chk[data-id='20']");
    chk(!(await pg.isVisible("#apIsisNum")), "con dos tildadas el N° ISIS se esconde (va de a una)");
    if (process.env.FOTO) await pg.screenshot({ path: process.env.FOTO + "-prog.png", fullPage: true });
    const dl = pg.waitForEvent("download", { timeout: 5000 }).catch(() => null);
    await pg.click("#apIsisPl"); const d = await dl;
    chk(!!d && /^GT_para_ISIS_\d{4}-\d{2}-\d{2}\.xls$/.test(d.suggestedFilename()), "baja GT_para_ISIS_<fecha>.xls");
    const xml = await pg.evaluate(() => window.__gtIsisXml || "");
    chk(xml.includes('ss:Size="14"') && xml.includes('ss:Size="16"') && xml.includes("WrapText") && xml.includes("TN 0041") && xml.includes(">183<") && xml.includes(">64<"),
      "la planilla: Arial 14 / títulos 16 partidos, TN 0041 con el 183 armado (4 cajas, 64 unidades)");
    chk((await pg.textContent("#pppInfo")).includes("sin renglones: TN 0021") && (await pg.textContent("#pppInfo")).includes("no marcadas listas: TN 0021"), "avisa la NP sin renglones y la que Javier no marcó lista");
    await pg.uncheck("input.ap-chk[data-id='20']"); await pg.click("#apIsisNum"); await espera("gt_admin_pedido_isis", 2);
    chk(llamadas.gt_admin_pedido_isis.length === 2 && llamadas.gt_admin_pedido_isis[1].p_pedido_id === 43, "«🔢 N° ISIS» desde la Programación anota el número en el pedido de GT");

    // PDF Krikos va por la misma alta (nace en GT)
    const src = fs.readFileSync(path.join(ROOT, "admin.html"), "utf8");
    chk(/krCrear[\s\S]{0,900}gt_admin_pedido_crear/.test(src) && /origen: "krikos"/.test(src), "el PDF Krikos crea el pedido con gt_admin_pedido_crear (origen krikos)");
  } catch (e) { fallas.push(String(e)); console.log("✗", e.message); }
  await br.close(); srv.close();
  console.log(fallas.length ? "\n" + fallas.length + " falla(s)" : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

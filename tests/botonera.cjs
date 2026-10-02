// 1.30: la botonera de áreas entra entera, sin scroll, en cualquier pantalla, con el ícono y el nombre centrados en la
// tarjeta, y los botones de abajo (Almuerzo, Terminar día, Resumen) también a la vista.
// Uso: node tests/botonera.cjs [carpeta]   (necesita playwright; con carpeta, guarda una captura por tamaño)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, ".."), FOTOS = process.argv[2];
// las áreas reales de gt.rubros al 02/10/2026 (Pellegrini: 11 + Movimientos + Baño; Esnaola: 3 + Movimientos + Baño)
const A = (codigo, nombre, orden, planta) => ({ codigo, nombre, unidad: "u", orden, planta, pide_codigo: false, pide_cantidad: false });
const AREAS = [A("CORTE", "Corte", 1, "PELL"), A("GRAMP", "Grampeado", 2, "PELL"), A("ENCOL", "Encolado", 3, "PELL"), A("MONT", "Montaje", 4, "PELL"),
  A("GANCHO", "Gancho", 5, "PELL"), A("EMBL", "Emblistado", 6, "PELL"), A("CONTR", "Contraído", 7, "PELL"), A("PED", "Pedidos", 8, "PELL"),
  A("DECO", "Deco", 9, "PELL"), A("GUARD", "Guardado a góndola", 10, "PELL"), A("RECIB", "Recibir mercadería", 11, "PELL"),
  A("ALMU", "Almuerzo", 12, "PELL"), A("MOVIM", "Movimientos", 30, "PELL"), A("BANO", "Baño", 31, "PELL"),
  A("MOLDU", "Moldurado", 21, "ESNA"), A("LIJA", "Lijado", 22, "ESNA"), A("PINT", "Pintado", 23, "ESNA"), A("MOVIM", "Movimientos", 30, "ESNA"), A("BANO", "Baño", 31, "ESNA")];
const PELL = { codigo: "PELL", nombre: "Pellegrini" }, ESNA = { codigo: "ESNA", nombre: "Esnaola" };
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop();
      const out = fn === "gt_clave_validar" ? { ok: true, principal: "PELL", empleados: [{ id: 7, nombre: "Ximena Ortiz", plantas: [PELL] },
          { id: 6, nombre: "Dario Mendez", plantas: [PELL, ESNA] }] }
        : fn === "gt_botones2" || fn === "gt_botones" ? AREAS
        : fn === "gt_registrar" ? { ok: [], rechazados: [] } : [];
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
// lo que se ve en el navegador (descontadas las barras), no la pantalla física
const TAM = [
  ["iPhone SE · Safari", 375, 553], ["iPhone SE · app", 375, 667], ["iPhone 13 · Safari", 390, 664], ["iPhone 13 · app", 390, 844],
  ["iPhone Pro Max", 430, 932], ["Android chico", 360, 560], ["Android", 412, 780], ["celular viejo 320", 320, 480],
  ["iPhone SE acostado", 667, 325], ["Android acostado", 640, 300], ["iPhone 13 acostado", 844, 340],
  ["tablet parada", 768, 950], ["tablet acostada", 1024, 700], ["PC 1366", 1366, 768], ["PC 1920", 1920, 1080], ["ventana cuadrada", 500, 500]];
const fallas = [];
const chk = (c, m) => { if (!c) fallas.push(m); console.log((c ? "✓ " : "✗ ") + m); };
async function entrar(pg, url, emp) {
  await pg.goto(url); await pg.fill("#claveInput", "1234"); await pg.click("#claveBtn");
  await pg.click(`#nombreLista button[data-id='${emp}']`); await pg.waitForSelector("#avisoPop:not(.hidden)"); await pg.waitForTimeout(450); await pg.click("#avisoBtns button[data-i='0']");   // 1.49: «¿Sos …?» Sí
  if (emp === 6) await pg.click("#plantaOpts button[data-planta='PELL']");
  await pg.waitForSelector("#botonera .box"); await pg.waitForTimeout(50);
}
async function medir(pg) {
  return pg.evaluate(() => {
    const R = document.querySelector("#botonera .row"), cs = getComputedStyle(R), ih = innerHeight, iw = innerWidth;
    const cajas = [...R.querySelectorAll(".box")].map((b) => {
      const x = b.getBoundingClientRect(), ico = b.querySelector(".box-ico").getBoundingClientRect(), tit = b.querySelector(".box-title").getBoundingClientRect();
      const vis = [...b.querySelectorAll(".box-ico, .box-title, .box-desc")].filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect());
      const arriba = vis[0].top - x.top, abajo = x.bottom - vis[vis.length - 1].bottom, cx = x.left + x.width / 2, cy = x.top + x.height / 2;
      // ícono arriba del nombre: los dos en el centro horizontal y el bloque en el centro vertical; ícono al costado
      // (tarjeta baja): el par en el centro horizontal y cada uno en el centro vertical
      const centrada = R.classList.contains("fila")
        ? Math.abs((ico.left - x.left) - (x.right - tit.right)) <= 2 && Math.abs(ico.top + ico.height / 2 - cy) <= 2 && Math.abs(tit.top + tit.height / 2 - cy) <= 2
        : Math.abs(ico.left + ico.width / 2 - cx) <= 1.5 && Math.abs(tit.left + tit.width / 2 - cx) <= 1.5 && Math.abs(arriba - abajo) <= 2;
      return { x, adentro: b.scrollWidth <= b.clientWidth + 1 && b.scrollHeight <= b.clientHeight + 1, centrada };
    });
    const pie = ["almuBtn", "finBtn", "histBtn"].map((id) => document.getElementById(id)).filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect());
    const todo = cajas.map((c) => c.x).concat(pie);
    return { n: cajas.length, ih, iw, pie: pie.length,
      aLaVista: todo.every((r) => r.top >= 0 && r.left >= 0 && r.bottom <= ih + 0.5 && r.right <= iw + 0.5),
      sinScroll: document.scrollingElement.scrollHeight <= ih + 1 && document.scrollingElement.scrollWidth <= iw,
      alto: Math.min(...cajas.map((c) => c.x.height)), ancho: Math.round(cajas[0].x.width),
      adentro: cajas.every((c) => c.adentro), centrada: cajas.every((c) => c.centrada), parte: R.classList.contains("parte"),
      cols: cs.getPropertyValue("--cols").trim(), letra: cs.getPropertyValue("--letra").trim(), desc: !R.classList.contains("sin-desc"), fila: R.classList.contains("fila") };
  });
}
const linea = (nom, w, h, m) => `${nom} ${w}×${h}: ${m.n} áreas + ${m.pie} botones a la vista, sin scroll, centradas, nombre entero` +
  (m.aLaVista ? "" : " [se sale]") + (m.sinScroll ? "" : " [scroll]") + (m.adentro ? "" : " [nombre afuera]") + (m.centrada ? "" : " [no centrada]") +
  (m.parte ? " [parte palabra]" : "") + (m.alto >= 47.5 ? "" : " [chica]") +
  ` (${m.cols} col · ${m.ancho}×${Math.round(m.alto)} · letra ${m.letra}${m.desc ? " · con «Empezar»" : ""}${m.fila ? " · ícono al costado" : ""})`;
const ok = (m, n, pie) => m.n === n && m.pie === pie && m.aLaVista && m.sinScroll && m.adentro && m.centrada && !m.parte && m.alto >= 47.5;
srv.listen(0, async () => {
  const url = "http://localhost:" + srv.address().port + "/";
  const br = await pw.chromium.launch();
  try {
    for (const [nom, w, h] of TAM) {
      const pg = await br.newPage({ viewport: { width: w, height: h } });
      await entrar(pg, url, 7);
      const m = await medir(pg);
      chk(ok(m, 13, 3), linea(nom, w, h, m));
      if (FOTOS) await pg.screenshot({ path: path.join(FOTOS, `botonera-${w}x${h}.png`) });
      await pg.close();
    }
    // 1.31: ni Darío, que trabaja en dos plantas, tiene «Cambiar de planta» en la botonera
    const pd = await br.newPage({ viewport: { width: 375, height: 553 } });
    await entrar(pd, url, 6);
    const md = await medir(pd);
    chk(ok(md, 13, 3) && !(await pd.$("#plantaBtn")), "Darío (2 plantas), sin «Cambiar de planta» · " + linea("iPhone SE · Safari", 375, 553, md));
    await pd.close();
    // girar el celular con la botonera abierta: se vuelve a acomodar
    const pg = await br.newPage({ viewport: { width: 390, height: 664 } });
    await entrar(pg, url, 7);
    await pg.setViewportSize({ width: 844, height: 340 }); await pg.waitForTimeout(150);
    const m = await medir(pg);
    chk(ok(m, 13, 3), "al girar el celular · " + linea("acostado", 844, 340, m));
    // con un área abierta sigue estando sólo «Terminé» (sin grilla)
    await pg.setViewportSize({ width: 390, height: 664 });
    await pg.click(".box[data-cod=PED]"); await pg.waitForSelector(".termine-btn");
    chk((await pg.$$("#botonera .box")).length === 0, "con un área abierta: sólo «Terminé», sin la grilla");
    await pg.close();
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? `\n${fallas.length} falla(s)` : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

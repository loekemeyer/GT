// 1.29: «¿Quién sos?» con 16 operarios entra entera, sin scroll, en cualquier pantalla (celular parado y acostado, tablet, PC).
// 1.49: y la pregunta «¿Sos …?» que sale al tocar un nombre, también.
// Uso: node tests/nombres16.cjs [carpeta]   (necesita playwright; con carpeta, guarda una captura por tamaño)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, ".."), FOTOS = process.argv[2];
// los 9 de hoy + 7 inventados con nombres largos (el peor caso de ancho)
const NOMBRES = ["Federico Realini", "Lautaro Durante", "Walter Saucedo", "Javier Burgos", "David Galarza", "Dario Mendez", "Ximena Ortiz",
  "Juan Gimenez", "Luis Luna", "Maximiliano Bustamante", "Guadalupe Fernández", "Rocío Villanueva", "Sebastián Etcheverry",
  "Nicolás Albarracín", "Florencia Domínguez", "Cristian Echeverría"];
let n = 16;
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop();
      const out = fn === "gt_clave_validar"
        ? { ok: true, principal: "PELL", empleados: Array.from({ length: n }, (_, i) => ({ id: i + 1, nombre: NOMBRES[i % NOMBRES.length] + (i >= NOMBRES.length ? " " + i : ""), plantas: [] })) }
        : [];
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
// tamaños de lo que se ve en el navegador (descontadas las barras), no de la pantalla física
const TAM = [
  ["iPhone SE · Safari", 375, 553], ["iPhone SE · app", 375, 667], ["iPhone 13 · Safari", 390, 664], ["iPhone 13 · app", 390, 844],
  ["iPhone Pro Max", 430, 932], ["Android chico", 360, 560], ["Android", 412, 780], ["celular viejo 320", 320, 480],
  ["iPhone SE acostado", 667, 325], ["Android acostado", 640, 300], ["iPhone 13 acostado", 844, 340],
  ["tablet parada", 768, 950], ["tablet acostada", 1024, 700], ["PC 1366", 1366, 768], ["PC 1920", 1920, 1080], ["ventana cuadrada", 500, 500]];
const fallas = [];
const chk = (c, m) => { if (!c) fallas.push(m); console.log((c ? "✓ " : "✗ ") + m); };
async function medir(pg) {
  return pg.evaluate(() => {
    const L = document.getElementById("nombreLista"), bs = [...L.querySelectorAll("button")];
    const r = bs.map((b) => { const x = b.getBoundingClientRect(), s = b.querySelector("span"), sr = s.getBoundingClientRect();
      return { top: x.top, bottom: x.bottom, left: x.left, right: x.right, h: x.height, w: x.width,
        texto: sr.left >= x.left - 0.5 && sr.right <= x.right + 0.5 && sr.top >= x.top - 0.5 && sr.bottom <= x.bottom + 0.5 }; });
    const cs = getComputedStyle(L);
    return { r, iw: innerWidth, ih: innerHeight, pagAncho: document.documentElement.scrollWidth, lista: L.scrollHeight - L.clientHeight,
      cols: cs.getPropertyValue("--cols"), alto: cs.getPropertyValue("--alto"), letra: cs.getPropertyValue("--letra") };
  });
}
srv.listen(0, async () => {
  const url = "http://localhost:" + srv.address().port + "/";
  const br = await pw.chromium.launch();
  try {
    for (const [nom, w, h] of TAM) {
      const pg = await br.newPage({ viewport: { width: w, height: h } });
      await pg.goto(url); await pg.fill("#claveInput", "1234"); await pg.click("#claveBtn");
      await pg.waitForSelector("#nombreLista button");
      const m = await medir(pg);
      const enPantalla = m.r.every((b) => b.top >= 0 && b.left >= 0 && b.bottom <= m.ih + 0.5 && b.right <= m.iw + 0.5);
      chk(m.r.length === 16 && enPantalla && m.lista <= 1 && m.pagAncho <= m.iw && m.r.every((b) => b.h >= 47.5) && m.r.every((b) => b.texto),
        `${nom} ${w}×${h}${enPantalla ? "" : " [se sale]"}${m.lista > 1 ? " [scroll]" : ""}${m.r.every((b) => b.texto) ? "" : " [nombre afuera]"}: 16 a la vista, sin scroll, botón ≥ 48 px y el nombre adentro (${m.cols} col · fila ${m.alto} · letra ${m.letra}` +
        ` · botón ${Math.round(m.r[0].w)}×${Math.round(m.r[0].h)})`);
      if (FOTOS) await pg.screenshot({ path: path.join(FOTOS, `${w}x${h}.png`) });
      // 1.49: «¿Sos …?» con el nombre más largo entra entera: la ventana, el título y los dos botones a la vista, sin scroll
      await pg.click("#nombreLista button[data-id='10']"); await pg.waitForSelector("#avisoPop:not(.hidden)");
      const c = await pg.evaluate(() => {
        const caja = document.querySelector("#avisoPop .pop-caja"), k = caja.getBoundingClientRect();
        const bs = [...document.querySelectorAll("#avisoBtns button")].map((b) => { const x = b.getBoundingClientRect();
          return { top: x.top, bottom: x.bottom, h: x.height, entra: b.scrollWidth <= b.clientWidth + 1 }; });
        return { k: { top: k.top, bottom: k.bottom, left: k.left, right: k.right }, scroll: caja.scrollHeight - caja.clientHeight, bs,
          tit: document.getElementById("avisoTit").textContent, iw: innerWidth, ih: innerHeight };
      });
      chk(c.tit === "¿Sos Maximiliano Bustamante?" && c.k.top >= 0 && c.k.left >= 0 && c.k.bottom <= c.ih + 0.5 && c.k.right <= c.iw + 0.5 &&
          c.scroll <= 1 && c.bs.length === 2 && c.bs.every((b) => b.h >= 47.5 && b.bottom <= c.ih + 0.5 && b.entra),
        `${nom}: «¿Sos Maximiliano Bustamante?» entera, sin scroll, los dos botones ≥ 48 px a la vista (caja ${Math.round(c.k.bottom - c.k.top)} px de alto)`);
      if (FOTOS) await pg.screenshot({ path: path.join(FOTOS, `${w}x${h}-sos.png`) });
      await pg.close();
    }
    // girar el celular con la pantalla abierta: se vuelve a acomodar
    const pg = await br.newPage({ viewport: { width: 390, height: 664 } });
    await pg.goto(url); await pg.fill("#claveInput", "1234"); await pg.click("#claveBtn"); await pg.waitForSelector("#nombreLista button");
    await pg.setViewportSize({ width: 844, height: 340 }); await pg.waitForTimeout(150);
    let m = await medir(pg);
    chk(m.r.every((b) => b.bottom <= m.ih + 0.5 && b.right <= m.iw + 0.5) && m.lista <= 1, `al girar el celular se reacomoda (${m.cols} col · fila ${m.alto})`);
    await pg.close();
    // con 9 (los de hoy) el botón mide lo mismo que con 16: no cambia al dar de alta a alguien
    const p16 = await br.newPage({ viewport: { width: 390, height: 664 } });
    await p16.goto(url); await p16.fill("#claveInput", "1234"); await p16.click("#claveBtn"); await p16.waitForSelector("#nombreLista button");
    const m16 = await medir(p16); await p16.close();
    n = 9;
    const p9 = await br.newPage({ viewport: { width: 390, height: 664 } });
    await p9.goto(url); await p9.fill("#claveInput", "1234"); await p9.click("#claveBtn"); await p9.waitForSelector("#nombreLista button");
    const m9 = await medir(p9);
    chk(m9.r.length === 9 && m9.cols === m16.cols && m9.alto === m16.alto, `con 9 operarios: mismo botón que con 16 (${m9.cols} col · fila ${m9.alto})`);
    await p9.close();
    // con 30 se arma para todos; en el celular chico pueden no entrar y queda scroll dentro de la lista, sin pasarse de ancho
    n = 30;
    const p30 = await br.newPage({ viewport: { width: 375, height: 553 } });
    await p30.goto(url); await p30.fill("#claveInput", "1234"); await p30.click("#claveBtn"); await p30.waitForSelector("#nombreLista button");
    const m30 = await medir(p30);
    chk(m30.r.length === 30 && m30.pagAncho <= m30.iw && m30.r.every((b) => b.h >= 47.5 && b.texto), `con 30 operarios: todos, sin pasarse de ancho (${m30.cols} col · fila ${m30.alto} · scroll ${m30.lista} px)`);
    await p30.close();
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? `\n${fallas.length} falla(s)` : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

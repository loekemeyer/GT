// 1.35 (Elías: «estoy en guardado y no me aparece nada al poner 224»): la API de Supabase corta en 1.000 filas y la lista
// de códigos tiene 2.273, ordenada por área. Esta base simulada corta igual que la real: gt_codigos_area devuelve las
// primeras 1.000 filas y gt_codigos_area2 la lista entera en una sola fila. El celular tiene que reconocer el código en
// las áreas que quedaban afuera (Guardado, Grampeado, Montaje) y preguntar la medida de un set de 3 en Montaje.
// Uso: node tests/codigos.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
// la lista con el tamaño real: 317 productos en 6 áreas + los propios de Corte (168), Grampeado (130) y Deco (71) + Recibir (2)
const PROD = Array.from({ length: 317 }, (_, i) => {
  const c = String(i + 1).padStart(3, "0");
  return c === "224" ? { codigo: "224", descripcion: "Porta Gigante Mold 30mm", medida: "30*40" }
    : c === "136" ? { codigo: "136", descripcion: "Cuadros Mold 03 Set x3 Botanica", medida: "30*40 + 20*30 + 15*21" }
    : { codigo: c, descripcion: "Cuadro Mold 03 Modelo " + c, medida: "20*30" };
});
const propios = (rubro, n, f) => Array.from({ length: n }, (_, i) => Object.assign({ rubro, codigo: String(i + 1).padStart(3, "0") }, f(i + 1)));
const LISTA = ["CONTR", "EMBL", "ENCOL", "GANCHO", "GUARD", "MONT"].flatMap((rubro) => PROD.map((p) => Object.assign({ rubro }, p)))
  .concat(propios("CORTE", 168, (n) => ({ descripcion: "03 Bco", medida: n + " cm" })),
          propios("GRAMP", 130, (n) => ({ descripcion: n === 235 - 105 ? "3P 3/4 Negro" : "03 Negro", medida: "27.5*40" })),
          propios("DECO", 71, () => ({ descripcion: "Bandeja", medida: null })),
          [{ rubro: "RECIB", codigo: "INSUMO", descripcion: "Insumo", medida: null }, { rubro: "RECIB", codigo: "MOLDURA", descripcion: "Moldura", medida: null }])
  .sort((a, b) => a.rubro.localeCompare(b.rubro) || a.codigo.localeCompare(b.codigo));
// 1.59: el 3080 de Deco sirve para 4 bandejas y pregunta cuál (gt.codigos_rubro.articulos)
Object.assign(LISTA.find((x) => x.rubro === "DECO" && x.codigo === "071"),
  { codigo: "3080", descripcion: "Armado Bandeja — 456/536/818/534 Bandeja 13x30", articulos: ["456", "536", "818", "534"] });
Object.assign(LISTA.find((x) => x.rubro === "ENCOL" && x.codigo === "317"), { codigo: "456", descripcion: "Bandeja manija/mad Mold 012 Colores", medida: "13*30" });
const FILAS = [];
const A = (codigo, nombre, orden) => ({ codigo, nombre, unidad: "cajas", orden, planta: "PELL", pide_codigo: true, pide_cantidad: true });
const AREAS = [A("DECO", "Deco", 9), A("GRAMP", "Grampeado", 2), A("MONT", "Montaje", 4), A("GUARD", "Guardado a góndola", 10), A("CONTR", "Contraído", 7)];
let conV2 = true;
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop();
      if (fn === "gt_codigos_area2" && !conV2) { res.writeHead(404); res.end("{}"); return; }
      const out = fn === "gt_clave_validar" ? { ok: true, principal: "PELL", empleados: [{ id: 7, nombre: "Ximena Ortiz", plantas: [] }] }
        : fn.startsWith("gt_botones") ? AREAS
        : fn === "gt_codigos_area" ? LISTA.slice(0, 1000)          // como la API real: corta en 1.000 filas
        : fn === "gt_codigos_area2" ? LISTA                         // una sola fila con todo
        : fn === "gt_registrar" ? (JSON.parse(body || "{}").p_filas || []).forEach((f) => { if (!FILAS.find((x) => x.client_id === f.client_id)) FILAS.push(f); }) || { ok: [], rechazados: [] } : [];
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
async function entrar(br, url) {
  const pg = await br.newPage({ viewport: { width: 390, height: 664 } });
  await pg.goto(url); await pg.fill("#claveInput", "1234"); await pg.click("#claveBtn");
  await pg.click("#nombreLista button[data-id='7']"); await pg.waitForSelector("#avisoPop:not(.hidden)"); await pg.waitForTimeout(450); await pg.click("#avisoBtns button[data-i='0']"); await pg.waitForSelector(".box[data-cod=GUARD]"); await pg.waitForTimeout(100);   // 1.49: «¿Sos …?» Sí
  return pg;
}
async function pista(pg, area, cod) {
  await pg.click(".box[data-cod=" + area + "]"); await pg.waitForSelector("#codScreen:not(.hidden)");
  await pg.fill("#codInput", cod);
  const t = (await pg.textContent("#codHint")).trim();
  await pg.click("#codVolver"); await pg.waitForSelector("#optionsScreen:not(.hidden)");
  return t;
}
srv.listen(0, async () => {
  const url = "http://localhost:" + srv.address().port + "/";
  const br = await pw.chromium.launch();
  try {
    chk(LISTA.length === 2273, "la lista simulada tiene el tamaño de la real: " + LISTA.length + " códigos");
    const pg = await entrar(br, url);
    const g = await pista(pg, "GUARD", "224");
    chk(g === "Porta Gigante Mold 30mm · 30*40", "Guardado: al poner 224 aparece «Porta Gigante Mold 30mm · 30*40» (" + g + ")");
    const gr = await pista(pg, "GRAMP", "130");
    chk(gr.includes("27.5*40"), "Grampeado: el 130 se reconoce (" + gr + ")");
    const c = await pista(pg, "CONTR", "224");
    chk(c === "Porta Gigante Mold 30mm · 30*40", "Contraído (que ya llegaba) sigue igual");
    const x = await pista(pg, "GUARD", "999");
    chk(x.includes("No está en la lista"), "Guardado: un código que no existe avisa «No está en la lista» (" + x + ")");
    // Montaje: un set de 3 pregunta la medida (sin la lista no la preguntaba)
    await pg.click(".box[data-cod=MONT]"); await pg.waitForSelector("#codScreen:not(.hidden)");
    await pg.fill("#codInput", "136"); await pg.click("#codBtn");
    chk(await pg.waitForSelector("#medScreen:not(.hidden)", { timeout: 3000 }).then(() => true, () => false), "Montaje: el set 136 pregunta qué medida va a montar");
    await pg.click("#medVolver"); await pg.waitForSelector("#optionsScreen:not(.hidden)");
    // 1.59: Deco 3080 pregunta qué artículo va a fabricar, al empezar y al seguir con el mismo código
    await pg.click(".box[data-cod=DECO]"); await pg.waitForSelector("#codScreen:not(.hidden)");
    await pg.fill("#codInput", "3080"); await pg.click("#codBtn");
    chk(await pg.waitForSelector("#medScreen:not(.hidden)", { timeout: 3000 }).then(() => true, () => false) &&
        (await pg.textContent("#medLabel")) === "¿Qué artículo vas a fabricar?" && (await pg.$$("#medOpts button")).length === 4,
        "Deco: el 3080 pregunta qué artículo va a fabricar (4 botones)");
    chk((await pg.textContent("#medOpts button[data-med='456']")).includes("Bandeja manija/mad Mold 012 Colores"), "el botón del 456 dice qué bandeja es");
    await pg.click("#medOpts button[data-med='534']"); await pg.waitForSelector("#optionsScreen:not(.hidden)"); await pg.waitForTimeout(300);
    let ap = FILAS.filter((f) => f.rubro === "DECO");
    chk(ap.length === 1 && ap[0].texto === "3080" && ap[0].detalle && ap[0].detalle.articulo === "534" && !ap[0].ts_inicio, "empezó Deco 3080 con el artículo 534");
    await pg.click(".termine-btn[data-cod=DECO]"); await pg.waitForSelector("#cantScreen:not(.hidden)");
    chk((await pg.textContent("#cantLabel")).includes("3080 · 534"), "al terminar pide las del 3080 · 534 (" + (await pg.textContent("#cantLabel")) + ")");
    await pg.fill("#cantInput", "12"); await pg.fill("#sigueInput", "3080"); await pg.click("#cantBtn");
    chk(await pg.waitForSelector("#medScreen:not(.hidden)", { timeout: 3000 }).then(() => true, () => false), "al seguir con el 3080 vuelve a preguntar el artículo");
    await pg.click("#medOpts button[data-med='818']"); await pg.waitForSelector("#optionsScreen:not(.hidden)"); await pg.waitForTimeout(300);
    ap = FILAS.filter((f) => f.rubro === "DECO");
    chk(ap.length === 3 && ap[1].ts_inicio && ap[1].cantidad === 12 && ap[1].detalle.articulo === "534" && ap[2].detalle.articulo === "818",
        "cerró el 534 con 12 y siguió con el 3080 · 818");
    const otro = await (async () => { await pg.click(".termine-btn[data-cod=DECO]"); await pg.waitForSelector("#cantScreen:not(.hidden)");
      await pg.fill("#cantInput", "1"); await pg.fill("#sigueInput", "001"); await pg.click("#cantBtn");
      return pg.waitForSelector("#medScreen:not(.hidden)", { timeout: 800 }).then(() => true, () => false); })();
    chk(!otro && FILAS.filter((f) => f.rubro === "DECO").pop().texto === "001", "un código de Deco sin artículos no pregunta");
    await pg.close();
    // con la base sin la consulta nueva, el celular cae a la vieja y no se rompe (Contraído, que entra en las 1.000, anda)
    conV2 = false;
    const p2 = await entrar(br, url);
    const c2 = await pista(p2, "CONTR", "224");
    chk(c2 === "Porta Gigante Mold 30mm · 30*40", "sin gt_codigos_area2 usa gt_codigos_area y la app sigue andando");
    await p2.close();
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? `\n${fallas.length} falla(s)` : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

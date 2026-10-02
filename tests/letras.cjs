// 1.42 (Elías: «que todos los inputs para poner código sean numéricos y con un botón al lado para agregar a ese código o
// sacarle (en caso de doble tap) una E»). Los productos con letra son 781E y 782E (los G y W, discontinuos desde el 02/10):
// la E está siempre; otra letra sale sólo si un código activo del área termina en ella (Montaje, con un 999X inventado).
// Uso: node tests/letras.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const A = (codigo, nombre, orden, x) => Object.assign({ codigo, nombre, unidad: "cajas", orden, planta: "PELL", pide_codigo: true, pide_cantidad: true }, x || {});
const AREAS = [A("CORTE", "Corte", 1, { unidad: "unidades cortadas" }), A("ENCOL", "Encolado", 3), A("MONT", "Montaje", 4), A("EMBL", "Emblistado", 6)];
const PROD = [["183", "Cuadro Mold 03 Botanica", "30*40"], ["781E", "Porta Mold 03 Caja Exhibidora", "13*18"], ["782E", "Porta Mold 03 Caja Exhibidora", "15*21"]];
const CODS = PROD.map(([codigo, descripcion, medida]) => ({ rubro: "EMBL", codigo, descripcion, medida }))
  .concat([{ rubro: "CORTE", codigo: "025", descripcion: "03 Bco", medida: "25 cm" },
           { rubro: "MONT", codigo: "781E", descripcion: "Porta Mold 03 Caja Exhibidora", medida: "13*18" },
           { rubro: "MONT", codigo: "999X", descripcion: "Inventado con otra letra", medida: "10*10" },
           { rubro: "ENCOL", codigo: "781", descripcion: "Porta Mold 03", medida: "13*18" },
           { rubro: "ENCOL", codigo: "781E", descripcion: "Porta Mold 03 Caja Exhibidora", medida: "13*18" }]);
const filas = [];
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop(), b = body ? JSON.parse(body) : {};
      if (fn === "gt_registrar") (b.p_filas || []).forEach((f) => { if (!filas.some((x) => x.client_id === f.client_id)) filas.push(f); });
      const out = fn === "gt_clave_validar" ? { ok: true, principal: "PELL", empleados: [{ id: 7, nombre: "Ximena Ortiz", plantas: [] }] }
        : fn.startsWith("gt_botones") ? AREAS : fn === "gt_codigos_area2" ? CODS
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
    for (const [w, h] of [[320, 568], [390, 664]]) {
      const pg = await br.newPage({ viewport: { width: w, height: h } });
      await pg.goto(url); await pg.fill("#claveInput", "1234"); await pg.click("#claveBtn");
      await pg.click("#nombreLista button[data-id='7']"); await pg.waitForSelector(".box[data-cod=EMBL]");
      const letras = (id) => pg.$$eval("#" + id + " .suf-btn", (bs) => bs.map((b) => b.dataset.l + (b.classList.contains("activo") ? "*" : "")).join(","));
      // Corte: sólo números en la lista → teclado numérico y la E sola
      await pg.click(".box[data-cod=CORTE]"); await pg.waitForSelector("#codScreen:not(.hidden)");
      chk((await pg.getAttribute("#codInput", "inputmode")) === "numeric" && (await letras("codSuf")) === "E", w + " px · Corte: teclado numérico y la E al lado");
      await pg.click("#codVolver"); await pg.waitForSelector("#optionsScreen:not(.hidden)");
      // 1.44 (Elías: «en el módulo de encolado no va la posibilidad de que pongan la E»)
      await pg.click(".box[data-cod=ENCOL]"); await pg.waitForSelector("#codScreen:not(.hidden)");
      const encAncho = await pg.evaluate(() => Math.round(document.getElementById("codInput").getBoundingClientRect().width));
      chk((await letras("codSuf")) === "" && !(await pg.isVisible("#codSuf")) && (await pg.getAttribute("#codInput", "inputmode")) === "numeric",
          w + " px · Encolado: teclado numérico y sin la E (el campo ocupa todo el ancho: " + encAncho + " px)");
      await pg.fill("#codInput", "781");
      chk((await pg.textContent("#codHint")).trim() === "Porta Mold 03 · 13*18", w + " px · Encolado: 781 es el Porta Mold 03, sin sugerir la E");
      await pg.click("#codVolver"); await pg.waitForSelector("#optionsScreen:not(.hidden)");
      // Montaje con un código inventado que termina en X: aparece también la X, y la X reemplaza a la E
      await pg.click(".box[data-cod=MONT]"); await pg.waitForSelector("#codScreen:not(.hidden)");
      chk((await letras("codSuf")) === "E,X", w + " px · un código activo con otra letra suma su botón (E, X)");
      await pg.fill("#codInput", "999"); await pg.click("#codSuf .suf-btn[data-l=E]"); await pg.click("#codSuf .suf-btn[data-l=X]");
      chk((await pg.inputValue("#codInput")) === "999X", w + " px · con la E puesta, la X la reemplaza (999X, no 999EX)");
      await pg.click("#codVolver"); await pg.waitForSelector("#optionsScreen:not(.hidden)");
      // Emblistado: la E sola (781E y 782E; los G y W están discontinuos)
      await pg.click(".box[data-cod=EMBL]"); await pg.waitForSelector("#codScreen:not(.hidden)");
      chk((await pg.getAttribute("#codInput", "inputmode")) === "numeric" && (await letras("codSuf")) === "E", w + " px · Emblistado: teclado numérico y la E al lado (" + (await letras("codSuf")) + ")");
      const caja = await pg.evaluate(() => { const i = document.getElementById("codInput").getBoundingClientRect(), s = document.getElementById("codSuf").getBoundingClientRect();
        return { input: Math.round(i.width), mismaFila: Math.abs(i.top - s.top) < 2, sobra: document.documentElement.scrollWidth - innerWidth, alto: Math.round(s.height) }; });
      chk(caja.mismaFila && caja.input >= 180 && caja.sobra <= 0 && caja.alto >= 48, w + " px · la E al lado del campo, sin pasarse de ancho (campo " + caja.input + " px)");
      await pg.click("#codInput"); await pg.keyboard.type("781");
      // «también tiene que buscar en la lista si se le agrega la E»: 781 solo no está, 781E sí → lo dice y marca la E
      const sinE = (await pg.textContent("#codHint")).trim();
      chk(sinE.includes("Sin la E no está") && sinE.includes("781E") && sinE.includes("Caja Exhibidora") &&
          (await pg.$eval("#codSuf .suf-btn[data-l=E]", (b) => b.classList.contains("sugerida"))), w + " px · 781 sin la E: avisa que el 781E sí está y marca la E (" + sinE + ")");
      await pg.click("#codBtn");
      chk((await pg.textContent("#codError")).includes("el 781E sí: tocá la E"), w + " px · Empezar con 781: «El 781 no está en la lista, el 781E sí: tocá la E»");
      await pg.click("#codInput");
      await pg.click("#codSuf .suf-btn[data-l=E]");
      chk((await pg.inputValue("#codInput")) === "781E" && (await letras("codSuf")) === "E*" && (await pg.textContent("#codHint")).includes("Caja Exhibidora · 13*18"),
          w + " px · 781 + E = 781E, la E queda marcada y abajo dice qué es");
      chk(await pg.evaluate(() => document.activeElement.id === "codInput"), w + " px · tocar la E no le saca el foco al campo (no se cierra el teclado)");
      await pg.click("#codSuf .suf-btn[data-l=E]");
      chk((await pg.inputValue("#codInput")) === "781" && (await letras("codSuf")) === "E", w + " px · otro toque en la E la saca: 781");
      await pg.click("#codSuf .suf-btn[data-l=E]"); await pg.click("#codBtn");
      await pg.waitForSelector(".termine-btn[data-cod=EMBL]"); await pg.evaluate(() => window.__gt.flush()); await pg.waitForTimeout(150);
      chk(filas.some((f) => f.rubro === "EMBL" && f.texto === "781E" && !f.ts_inicio), w + " px · Empezar con 781 + E registra el 781E");
      // «¿Con qué código seguís?» también tiene las letras
      await pg.click(".termine-btn[data-cod=EMBL]"); await pg.waitForSelector("#cantScreen:not(.hidden)");
      chk((await pg.getAttribute("#sigueInput", "inputmode")) === "numeric" && (await letras("sigueSuf")) === "E", w + " px · «¿Con qué código seguís?»: numérico y la E");
      await pg.fill("#cantInput", "2"); await pg.fill("#sigueInput", "782"); await pg.click("#sigueSuf .suf-btn[data-l=E]"); await pg.click("#cantBtn");
      await pg.waitForSelector(".termine-btn[data-cod=EMBL]"); await pg.evaluate(() => window.__gt.flush()); await pg.waitForTimeout(150);
      chk(filas.some((f) => f.texto === "782E" && !f.ts_inicio), w + " px · Terminar y seguir con 782 + E abre el 782E");
      // 1.44: Encolado también sin la E en «¿Con qué código seguís en Encolado?»
      await pg.click(".termine-btn[data-cod=EMBL]"); await pg.waitForSelector("#cantScreen:not(.hidden)");
      await pg.fill("#cantInput", "1"); await pg.click("#cambioBtn"); await pg.waitForSelector(".box[data-cod=ENCOL]");
      await pg.click(".box[data-cod=ENCOL]"); await pg.fill("#codInput", "781"); await pg.click("#codBtn");
      await pg.waitForSelector(".termine-btn[data-cod=ENCOL]"); await pg.click(".termine-btn[data-cod=ENCOL]"); await pg.waitForSelector("#cantScreen:not(.hidden)");
      chk((await pg.textContent("#sigueLabel")).includes("Encolado") && !(await pg.isVisible("#sigueSuf")) && (await letras("sigueSuf")) === "",
          w + " px · «¿Con qué código seguís en Encolado?»: sin la E");
      await pg.close(); filas.length = 0;
    }
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? `\n${fallas.length} falla(s)` : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

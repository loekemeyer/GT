// 1.50: «Puesta a punto encoladora» vive DENTRO de Encolado: no va en la botonera, es un botón en la pantalla del código de
// Encolado (y no en la de otra área). Sin código ni cantidad; al terminarla se propone seguir en Encolado con un código.
// Uso: node tests/puesta.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const A = (codigo, nombre, orden, x) => Object.assign({ codigo, nombre, unidad: "cajas", orden, planta: "PELL", pide_codigo: true, pide_cantidad: true }, x || {});
const AREAS = [A("CORTE", "Corte", 1, { unidad: "unidades cortadas" }), A("ENCOL", "Encolado", 3), A("MONT", "Montaje", 4), A("EMBL", "Emblistado", 6),
               A("PAPENC", "Puesta a punto encoladora", 32, { unidad: "—", pide_codigo: false, pide_cantidad: false })];
const PROD = [["183", "Cuadro Mold 03 Botanica", "30*40"], ["781E", "Porta Mold 03 Caja Exhibidora", "13*18"], ["782E", "Porta Mold 03 Caja Exhibidora", "15*21"]];
const CODS = PROD.map(([codigo, descripcion, medida]) => ({ rubro: "EMBL", codigo, descripcion, medida }))
  .concat([{ rubro: "CORTE", codigo: "025", descripcion: "03 Bco", medida: "25 cm" },
           { rubro: "MONT", codigo: "781E", descripcion: "Porta Mold 03 Caja Exhibidora", medida: "13*18" },
           { rubro: "MONT", codigo: "999X", descripcion: "Inventado con otra letra", medida: "10*10" },
           { rubro: "ENCOL", codigo: "781", descripcion: "Porta Mold 03", medida: "13*18" },
           { rubro: "ENCOL", codigo: "781E", descripcion: "Porta Mold 03 Caja Exhibidora", medida: "13*18" }]);
const filas = [];
// 1.60 (Thomas: «en puesta a punto encoladora tiene que preguntar con quién lo va a hacer»): la base manda «Solo» y todos
const PASOS = [{ rubro: "PAPENC", orden: 1, campo: "con", pregunta: "¿Con quién lo hacés?", fuente: "companeros", momento: "empezar",
                 opciones: ["Solo", "Ximena Ortiz", "Walter Saucedo", "Luis Luna"] }];
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop(), b = body ? JSON.parse(body) : {};
      if (fn === "gt_registrar") (b.p_filas || []).forEach((f) => { if (!filas.some((x) => x.client_id === f.client_id)) filas.push(f); });
      const out = fn === "gt_clave_validar" ? { ok: true, principal: "PELL", empleados: [{ id: 7, nombre: "Ximena Ortiz", plantas: [] }] }
        : fn.startsWith("gt_botones") ? AREAS : fn === "gt_codigos_area2" ? CODS
        : fn === "gt_pasos" ? PASOS
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
      filas.length = 0;
      const pg = await br.newPage({ viewport: { width: w, height: h } });
      await pg.goto(url); await pg.fill("#claveInput", "1234"); await pg.click("#claveBtn");
      await pg.click("#nombreLista button[data-id='7']"); await pg.waitForSelector("#avisoPop:not(.hidden)"); await pg.waitForTimeout(450); await pg.click("#avisoBtns button[data-i='0']"); await pg.waitForSelector(".box[data-cod=ENCOL]");
      chk(!(await pg.$(".box[data-cod=PAPENC]")), w + " px · la puesta a punto no está en la botonera");
      await pg.click(".box[data-cod=MONT]"); await pg.waitForSelector("#codScreen:not(.hidden)");
      chk(!(await pg.isVisible("#codHijas")), w + " px · en Montaje no aparece el botón");
      await pg.click("#codVolver"); await pg.waitForSelector("#optionsScreen:not(.hidden)");
      await pg.click(".box[data-cod=ENCOL]"); await pg.waitForSelector("#codScreen:not(.hidden)");
      const b = await pg.$("#codHijas button[data-cod=PAPENC]");
      const bb = b && await b.boundingBox();
      chk(b && (await b.isVisible()) && bb.height >= 48 && bb.y + bb.height <= h, w + " px · en Encolado, «🔧 Puesta a punto encoladora» a la vista (" + (b ? (await b.textContent()).trim() : "—") + ")");
      await b.click(); await pg.waitForSelector("#pasoScreen:not(.hidden)");
      const ops = await pg.$$eval("#pasoOpts button", (l) => l.map((x) => x.textContent.trim()));
      chk((await pg.textContent("#pasoLabel")) === "¿Con quién lo hacés?" && ops.join("|") === "Solo|Walter Saucedo|Luis Luna",
          w + " px · pregunta con quién, sin ella misma en la lista (" + ops.join(", ") + ")");
      await pg.click("#pasoOpts button[data-val='Walter Saucedo']"); await pg.waitForSelector("#optionsScreen:not(.hidden)");
      chk((await pg.textContent("#abiertaBox")).includes("Puesta a punto encoladora") && (await pg.isVisible(".termine-btn")), w + " px · queda abierta, con «Terminé»");
      await pg.waitForTimeout(300);
      const ap = filas.find((f) => f.rubro === "PAPENC" && !f.ts_inicio);
      chk(ap && !ap.texto && ap.cantidad == null && ap.detalle && ap.detalle.con === "Walter Saucedo", w + " px · la apertura va a la base sin código ni cantidad, con Walter Saucedo");
      chk((await pg.textContent("#abiertaBox")).includes("con Walter Saucedo"), w + " px · la botonera dice «con Walter Saucedo»");
      await pg.click(".termine-btn"); await pg.waitForSelector("#cantScreen:not(.hidden)");
      chk(!(await pg.isVisible("#cantBox")) && (await pg.textContent("#sigueLabel")).includes("Encolado") && (await pg.textContent("#cantBtn")).includes("Encolado"),
          w + " px · al terminar no pide cantidad y propone seguir en Encolado («" + (await pg.textContent("#sigueLabel")) + "»)");
      await pg.fill("#sigueInput", "781"); await pg.click("#cantBtn"); await pg.waitForSelector("#optionsScreen:not(.hidden)");
      await pg.waitForTimeout(300);
      const ci = filas.find((f) => f.rubro === "PAPENC" && f.ts_inicio), en = filas.find((f) => f.rubro === "ENCOL" && !f.ts_inicio);
      chk(ci && ci.cantidad == null && en && en.texto === "781" && (await pg.textContent("#abiertaBox")).includes("Encolado"), w + " px · cierra la puesta a punto y abre Encolado · 781");
      // 1.51 (D72): terminando Encolado, «Terminar e ir a Puesta a punto encoladora»
      await pg.click(".termine-btn"); await pg.waitForSelector("#cantScreen:not(.hidden)");
      const ir = await pg.$("#sigueHijas button[data-cod=PAPENC]"), irBox = ir && await ir.boundingBox();
      chk(ir && (await ir.isVisible()) && irBox.height >= 48 && irBox.y + irBox.height <= h, w + " px · al terminar Encolado, el botón de la puesta a punto a la vista");
      await ir.click();
      chk((await pg.textContent("#cantError")).includes("Poné un número"), w + " px · sin cantidad no cierra Encolado");
      await pg.fill("#cantInput", "5"); await pg.click("#sigueHijas button[data-cod=PAPENC]"); await pg.waitForSelector("#pasoScreen:not(.hidden)");
      await pg.click("#pasoOpts button[data-val='Solo']"); await pg.waitForSelector("#optionsScreen:not(.hidden)");
      await pg.waitForTimeout(300);
      const ce = filas.find((f) => f.rubro === "ENCOL" && f.ts_inicio), p2 = filas.filter((f) => f.rubro === "PAPENC" && !f.ts_inicio);
      chk(ce && ce.cantidad === 5 && ce.texto === "781" && p2.length === 2 && p2[1].detalle && p2[1].detalle.con === "Solo" && (await pg.textContent("#abiertaBox")).includes("Puesta a punto"),
          w + " px · cierra Encolado · 781 con 5 cajas y abre otra puesta a punto");
      await pg.click(".termine-btn"); await pg.waitForSelector("#cantScreen:not(.hidden)");
      chk(!(await pg.isVisible("#sigueHijas")), w + " px · al terminar la puesta a punto no se ofrece otra");
      await pg.close();
    }
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? "\n" + fallas.length + " falla(s)" : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

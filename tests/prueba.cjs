// 1.70 (Angely, 02/11/2026): «en la botonera del admin, un empleado de prueba que me permita probar todas las funciones y que lo que haga no se
// guarde. En las tareas de a 2 personas, que no pida que se sume la 2.ª, ya que es sólo para pruebas».
// La «🧪 Persona de Prueba» sólo sale en MODO VISTA (la Botonera del admin y la clave de vista): ve todas las áreas, elige planta como cualquiera,
// no pregunta «¿Con quién lo hacés?» ni ofrece «Tocá para sumarte», y no graba nada. En un celular normal no figura.
// Uso: node tests/prueba.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const A = (codigo, nombre, orden, x) => Object.assign({ codigo, nombre, unidad: "cajas", orden, planta: "PELL", pide_codigo: true, pide_cantidad: true, solo: null }, x || {});
const AREAS = [A("CORTE", "Corte", 1, { unidad: "unidades cortadas" }), A("ENCOL", "Encolado", 3), A("PAPENC", "Puesta a punto encoladora", 32, { unidad: "—", pide_codigo: false, pide_cantidad: false }),
               A("ISIS", "Contraído a ISIS", 40, { pide_codigo: false, pide_cantidad: false, solo: [1, 10] })];
const EMPS = [{ id: 1, nombre: "Javier Burgos", plantas: [] }, { id: 8, nombre: "Walter Saucedo", plantas: [] }];
const PRUEBA = { id: 10, nombre: "🧪 Persona de Prueba", legajo: null, prueba: true, plantas: [{ codigo: "PELL", nombre: "Pellegrini" }, { codigo: "ESNA", nombre: "Esnaola" }] };
const PASOS = [{ rubro: "PAPENC", orden: 1, campo: "con", pregunta: "¿Con quién lo hacés?", fuente: "companeros", momento: "empezar", opciones: ["Solo", "Walter Saucedo"] }];
const SOCIO = [{ de: "Walter Saucedo", texto: "173", medida: null, client_id: "walter-1", planta: "PELL", descripcion: "Cuadro", medida_cod: null }];
let llamadas = []; const filas = [];
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop(), b = body ? JSON.parse(body) : {};
      llamadas.push(fn);
      if (fn === "gt_registrar") (b.p_filas || []).forEach((f) => { if (!filas.some((x) => x.client_id === f.client_id)) filas.push(f); });
      const out = fn === "gt_clave_validar" ? { ok: true, vista: false, principal: "PELL", empleados: EMPS }
        : fn === "gt_empleado_prueba" ? PRUEBA
        : fn === "gt_botones3" ? AREAS : fn === "gt_pasos" ? PASOS
        : fn === "gt_codigos_area2" ? [{ rubro: "ENCOL", codigo: "173", descripcion: "Cuadro Mold 03", medida: "30*40" }]
        : fn === "gt_pareja_abiertos" ? SOCIO
        : fn.startsWith("gt_registros_hoy") ? []
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
    for (const w of [320, 390]) {
      llamadas = []; filas.length = 0;
      // ── modo vista (Botonera del admin) ──
      let pg = await br.newPage({ viewport: { width: w, height: 760 } });
      await pg.goto(url + "?vista=1&cod=4821"); await pg.waitForSelector("#nombreScreen:not(.hidden)");
      const nombres = await pg.$$eval("#nombreLista button", (l) => l.map((b) => b.textContent.trim()));
      chk(nombres[0] === "🧪 Persona de Prueba" && nombres.length === 3, w + " px · en la Botonera la «🧪 Persona de Prueba» sale primera (" + nombres.join(" · ") + ")");
      const ini = await pg.$eval("#nombreLista button[data-id='10']", (b) => b.dataset.ini);
      chk(/^[A-Z]{1,2}$/.test(ini), w + " px · sus iniciales son letras, no el emoji (" + ini + ")");
      await pg.click("#nombreLista button[data-id='10']"); await pg.waitForSelector("#plantaScreen:not(.hidden)");
      chk(true, w + " px · trabaja en las dos plantas: pregunta «¿En qué planta?» como cualquiera");
      await pg.click("#plantaOpts button[data-planta='PELL']"); await pg.waitForSelector("#optionsScreen:not(.hidden)");
      await pg.waitForSelector(".box[data-cod=ISIS]", { timeout: 3000 }).catch(() => {});   // la botonera se pinta apenas entra y se completa cuando llegan las áreas
      chk(!!(await pg.$(".box[data-cod=ISIS]")), w + " px · ve también las áreas exclusivas de Javier (Contraído a ISIS)");
      chk((await pg.textContent("#syncBadge")).includes("no graba"), w + " px · dice «Vista · no graba»");
      // Encolado: no ofrece sumarse a Walter, que tiene un tramo abierto
      await pg.click(".box[data-cod=ENCOL]"); await pg.waitForSelector("#codScreen:not(.hidden)"); await pg.waitForTimeout(500);
      chk(llamadas.filter((x) => x === "gt_pareja_abiertos").length === 0 && (await pg.isHidden("#codJunta")), w + " px · Encolado NO ofrece «Tocá para sumarte» a un compañero");
      // Puesta a punto encoladora: no pregunta «¿Con quién lo hacés?»
      await pg.click("#codHijas button[data-cod=PAPENC]"); await pg.waitForSelector("#optionsScreen:not(.hidden)"); await pg.waitForTimeout(300);
      chk(await pg.isHidden("#pasoScreen") && (await pg.textContent("#abiertaBox")).includes("Puesta a punto"), w + " px · la Puesta a punto empieza directo: no pregunta «¿Con quién lo hacés?»");
      await pg.close();
      // el mismo recorrido con Javier (de verdad): SÍ ofrece sumarse y SÍ pregunta con quién
      pg = await br.newPage({ viewport: { width: w, height: 760 } });
      await pg.goto(url + "?vista=1&cod=4821"); await pg.waitForSelector("#nombreScreen:not(.hidden)");
      await pg.click("#nombreLista button[data-id='1']"); await pg.waitForSelector("#optionsScreen:not(.hidden)");
      await pg.click(".box[data-cod=ENCOL]"); await pg.waitForSelector("#codScreen:not(.hidden)"); await pg.waitForTimeout(500);
      chk(!(await pg.isHidden("#codJunta")) && (await pg.textContent("#codJunta")).includes("Walter Saucedo"), w + " px · con Javier (no es la de prueba) sigue ofreciendo sumarse a Walter");
      await pg.click("#codHijas button[data-cod=PAPENC]"); await pg.waitForSelector("#pasoScreen:not(.hidden)");
      chk((await pg.textContent("#pasoLabel")) === "¿Con quién lo hacés?", w + " px · con Javier sigue preguntando «¿Con quién lo hacés?»");
      await pg.close();
      chk(filas.length === 0 && !llamadas.includes("gt_registrar"), w + " px · no se grabó NADA");
    }
    // ── celular normal (sin modo vista): la persona de prueba no figura ──
    llamadas = [];
    const pg = await br.newPage({ viewport: { width: 390, height: 760 } });
    await pg.goto(url); await pg.fill("#claveInput", "4821"); await pg.click("#claveBtn"); await pg.waitForSelector("#nombreScreen:not(.hidden)");
    const n2 = await pg.$$eval("#nombreLista button", (l) => l.map((b) => b.textContent.trim()));
    chk(n2.join("|") === "Javier Burgos|Walter Saucedo" && !llamadas.includes("gt_empleado_prueba"), "celular normal · la persona de prueba NO figura y ni se la pide (" + n2.join(" · ") + ")");
    await pg.close();
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? "\n" + fallas.length + " falla(s)" : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

// 1.53 (Thomas, 05/10/2026): en Esnaola no hay monitor. Darío (encargado) entra con su clave personal de 6 números (el
// celular la recuerda: después es un toque) y su celular le muestra, con la 🔑 de arriba, el código de Esnaola para Luis.
// Con ese código sólo aparecen los de Esnaola y se entra directo en Esnaola (sin «¿En qué planta?»).
// Uso: node tests/esnaola.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const A = (codigo, nombre, orden, planta) => ({ codigo, nombre, unidad: "metros", orden, planta, pide_codigo: false, pide_cantidad: false, solo: null });
const AREAS = [A("CORTE", "Corte", 1, "PELL"), A("MOLDU", "Moldurado", 21, "ESNA"), A("LIJA", "Lijado", 22, "ESNA")];
const PELL = { codigo: "PELL", nombre: "Pellegrini" }, ESNA = { codigo: "ESNA", nombre: "Esnaola" };
const DARIO = { id: 6, nombre: "Dario Mendez", plantas: [PELL, ESNA] }, LUIS = { id: 5, nombre: "Luis Luna", plantas: [PELL, ESNA] };
const filas = [], llamadas = [];
let cambio = false;   // el «minuto» del código de planta: lo da vuelta el test
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop(), b = body ? JSON.parse(body) : {};
      llamadas.push(fn);
      if (fn === "gt_registrar") (b.p_filas || []).forEach((f) => { if (!filas.some((x) => x.client_id === f.client_id)) filas.push(f); });
      const out = fn === "gt_clave_validar" ? (b.p_clave === "123456" ? { ok: true, personal: true, da_codigo: "ESNA", principal: "PELL", empleados: [DARIO] }
          : b.p_clave === "5300" ? { ok: true, planta: "ESNA", principal: "PELL", empleados: [LUIS, DARIO] }
          : b.p_clave === "1234" ? { ok: true, principal: "PELL", empleados: [LUIS, DARIO, { id: 7, nombre: "Ximena Ortiz", plantas: [PELL] }] } : { ok: false })
        : fn === "gt_google_llave" ? (req.headers.authorization === "Bearer tokD" ? { ok: true, llave: "123456" } : { ok: false, email: "otro@gmail.com" })
        : fn === "gt_codigo_planta" ? (b.p_llave === "123456" ? { ok: true, planta: "ESNA", planta_nombre: "Esnaola", clave: cambio ? "6411" : "5300", cambia_en_s: 2 } : { ok: false })
        : fn.startsWith("gt_botones") ? AREAS
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
    // --- el celular de Darío
    const cD = await br.newContext({ viewport: { width: 360, height: 640 } }), d = await cD.newPage();
    await d.goto(url);
    chk(await d.isHidden("#llaveBtn"), "celular nuevo: sin «Entrar como»");
    await d.fill("#claveInput", "999999"); await d.click("#claveBtn"); await d.waitForTimeout(200);
    chk((await d.textContent("#claveError")).includes("personal incorrecta"), "clave personal mala: «Clave personal incorrecta»");
    await d.fill("#claveInput", "123456"); await d.click("#claveBtn");
    await d.waitForSelector("#plantaScreen:not(.hidden)");
    chk(await d.isHidden("#nombreScreen") && await d.isHidden("#avisoPop"), "con su clave: sin lista de nombres ni «¿Sos …?», directo a «¿En qué planta?»");
    await d.click("#plantaOpts button[data-planta='ESNA']"); await d.waitForSelector("#optionsScreen:not(.hidden)");
    await d.waitForTimeout(400);
    chk(filas.some((f) => f.opcion === "INGRESO" && f.empleado_id === 6 && f.planta === "ESNA"), "graba su ingreso en Esnaola");
    chk(await d.isVisible("#codPlantaBtn"), "en Esnaola tiene la 🔑 arriba");
    const caja = await d.evaluate(() => { const t = document.querySelector("#optionsScreen .top-bar"); return t.scrollWidth <= t.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth; });
    chk(caja, "la 🔑 entra en el encabezado sin pasarse de ancho (360 px)");
    // 1.63: el monitor de Esnaola abajo de la botonera
    chk(await d.isVisible("#monitorBox") && (await d.textContent("#monitorNum")) === "5300" && (await d.textContent("#monitorTit")).includes("Esnaola"), "abajo: 📺 Monitor Esnaola 5300");
    chk(await d.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "el monitor no se pasa de ancho (360 px)");
    await d.click("#codPlantaBtn"); await d.waitForSelector("#avisoPop:not(.hidden)");
    chk((await d.textContent("#codPlantaNum")) === "5300" && (await d.textContent("#avisoTit")).includes("Esnaola"), "la 🔑 muestra el código de Esnaola (5300)");
    cambio = true;
    await d.waitForTimeout(3500);
    chk((await d.textContent("#monitorNum")) === "6411", "el monitor de abajo también cambia (6411)");
    chk((await d.textContent("#codPlantaNum")) === "6411", "al cambiar el minuto se actualiza solo (6411)");
    await d.click("#avisoBtns button"); await d.waitForTimeout(100);
    // salir y volver: un toque
    await d.click("#salirBtn"); await d.waitForSelector("#claveScreen:not(.hidden)");
    chk((await d.textContent("#llaveBtn")).includes("Dario Mendez") && await d.isVisible("#llaveBtn"), "al salir: «👷 Entrar como Dario Mendez»");
    await d.click("#llaveBtn"); await d.waitForSelector("#plantaScreen:not(.hidden)");
    await d.click("#plantaOpts button[data-planta='PELL']"); await d.waitForSelector("#optionsScreen:not(.hidden)");
    chk(await d.isHidden("#codPlantaBtn"), "en Pellegrini no tiene la 🔑");
    chk(await d.isHidden("#monitorBox"), "en Pellegrini no tiene el monitor abajo");
    // --- el celular de Luis
    // 1.63: login con Google → vuelve con #access_token y entra como él (mail no habilitado → aviso)
    const cG = await br.newContext({ viewport: { width: 360, height: 640 } }), g = await cG.newPage();
    await g.goto(url + "#access_token=tokX&token_type=bearer"); await g.waitForTimeout(500);
    chk((await g.textContent("#claveError")).includes("no está habilitado") && !(await g.evaluate(() => location.hash)), "Google con otro mail: «no está habilitado» y limpia el token de la URL");
    await g.goto(url + "?g=1#access_token=tokD&token_type=bearer"); await g.waitForSelector("#plantaScreen:not(.hidden)");
    await g.click("#plantaOpts button[data-planta='ESNA']"); await g.waitForSelector("#optionsScreen:not(.hidden)");
    chk((await g.textContent("#opName")).includes("Dario Mendez") && await g.isVisible("#monitorBox"), "Google con su mail: entra como Dario Mendez en Esnaola con el monitor abajo");
    await cG.close();
    const cL = await br.newContext({ viewport: { width: 360, height: 640 } }), l = await cL.newPage();
    await l.goto(url);
    await l.fill("#claveInput", "5300"); await l.click("#claveBtn"); await l.waitForSelector("#nombreScreen:not(.hidden)");
    const nombres = await l.$$eval("#nombreLista button", (bs) => bs.map((b) => b.dataset.nombre).join(","));
    chk(nombres === "Luis Luna,Dario Mendez", "con el código de Esnaola sólo aparecen los de Esnaola (" + nombres + ")");
    await l.click("#nombreLista button[data-id='5']"); await l.waitForSelector("#avisoPop:not(.hidden)"); await l.waitForTimeout(450); await l.click("#avisoBtns button[data-i='0']");
    await l.waitForSelector("#optionsScreen:not(.hidden)"); await l.waitForTimeout(400);
    chk(filas.some((f) => f.opcion === "INGRESO" && f.empleado_id === 5 && f.planta === "ESNA") && await l.isVisible(".box[data-cod=MOLDU]"), "Luis entra directo en Esnaola, sin «¿En qué planta?»");
    chk(await l.isHidden("#codPlantaBtn") && await l.isHidden("#llaveBtn"), "Luis no tiene 🔑 ni «Entrar como»");
    // Luis en Pellegrini con el monitor: pregunta la planta como siempre
    await l.click("#salirBtn"); await l.waitForSelector("#claveScreen:not(.hidden)");
    await l.fill("#claveInput", "1234"); await l.click("#claveBtn");
    await l.click("#nombreLista button[data-id='5']"); await l.waitForSelector("#avisoPop:not(.hidden)"); await l.waitForTimeout(450); await l.click("#avisoBtns button[data-i='0']");
    await l.waitForSelector("#plantaScreen:not(.hidden)");
    chk(true, "con el código del monitor vuelve a preguntar la planta");
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? "\n" + fallas.length + " falla(s)" : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

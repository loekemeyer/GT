// 1.66 (Thomas, 19/10/2026): «dentro del admin un módulo para ver botonera de operario sin mover stocks ni contabilizar
// para productividad». La pestaña 👁 Botonera del admin abre la app REAL en un iframe con ?vista=1 + el código del
// monitor: se toca todo y NO se graba nada (ni el INGRESO, ni «Empecé», ni «Terminé»), así que no toca stock,
// Producción, Ritmo ni Rendimiento. Y el iframe no deja sesión en este navegador (no pisa la del celular del operario).
// Uso: node tests/admin-botonera.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const A = (codigo, nombre, orden, x) => Object.assign({ codigo, nombre, unidad: "cajas", orden, planta: "PELL", pide_codigo: false, pide_cantidad: true, solo: null }, x || {});
const AREAS = [A("CORTE", "Corte", 1, { unidad: "unidades cortadas" }), A("CONTR", "Contraído", 7), A("PED", "Pedidos", 8, { pide_cantidad: false })];
const EMPS = [{ id: 1, nombre: "Javier Burgos", plantas: [] }, { id: 6, nombre: "Dario Mendez", plantas: [] }];
const CLAVE_MIN = "4821";              // el código que muestra el monitor
const PASS = "9999";                   // la clave del admin
const filas = [], llamadas = [];
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop(), b = body ? JSON.parse(body) : {};
      llamadas.push(fn);
      if (fn === "gt_registrar") (b.p_filas || []).forEach((f) => { if (!filas.some((x) => x.client_id === f.client_id)) filas.push(f); });
      const out = fn === "gt_monitor_login" ? { ok: b.p_pass === PASS }
        : fn === "gt_monitor_clave" ? (b.p_pass === PASS ? { ok: true, clave: CLAVE_MIN, cambia_en_s: 42 } : { ok: false })
        : fn === "gt_clave_validar" ? (b.p_clave === CLAVE_MIN ? { ok: true, vista: false, principal: "PELL", empleados: EMPS } : { ok: false })
        : fn === "gt_botones3" ? AREAS
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
    const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
    await pg.goto(url + "admin.html");
    await pg.fill("#passInput", PASS); await pg.click("#passBtn");
    await pg.waitForSelector("#monitor:not(.hidden)");
    chk(!!(await pg.$('.tab[data-tab="bot"]')), "el admin tiene la pestaña 👁 Botonera");

    await pg.click('.tab[data-tab="bot"]');
    await pg.waitForSelector("#bot:not(.hidden)");
    await pg.waitForFunction(() => { const f = document.getElementById("botFrame"); return f && f.getAttribute("src"); });
    const src = await pg.getAttribute("#botFrame", "src");
    chk(/\?vista=1&cod=4821/.test(src), "el iframe abre la app con ?vista=1 y el código del monitor (" + src + ")");
    chk((await pg.textContent("#botInfo")).includes("NO graba"), "avisa que no graba nada");

    const fr = await (await pg.$("#botFrame")).contentFrame();
    await fr.waitForSelector("#nombreScreen:not(.hidden)");
    chk(true, "entra solo con el código: no hay que tipearlo");
    await fr.click("#nombreLista button[data-id='6']");
    await fr.waitForSelector("#optionsScreen:not(.hidden)");
    chk(await fr.isHidden("#avisoPop"), "elige a Darío sin «¿Sos …?»");
    chk((await fr.textContent("#opName")).startsWith("👁 Dario") && (await fr.textContent("#syncBadge")).includes("no graba"),
      "dentro del iframe dice 👁 Dario Mendez y «Vista · no graba»");
    chk(await fr.isHidden("#llaveBtn"), "no ofrece «Entrar como …» (la llave del celular del encargado)");

    // tocar la botonera entera: empezar Contraído, terminarlo con cantidad, empezar Pedidos
    await fr.click(".box[data-cod=CONTR]"); await fr.waitForTimeout(250);
    chk((await fr.textContent("#abiertaBox")).includes("Contraído"), "los toques andan igual (Contraído abierto)");
    await fr.click(".termine-btn"); await fr.waitForSelector("#cantScreen:not(.hidden)");
    await fr.fill("#cantInput", "8"); await fr.click("#cambioBtn"); await fr.waitForSelector("#optionsScreen:not(.hidden)");
    await fr.click(".box[data-cod=PED]"); await fr.waitForTimeout(1600);

    chk(filas.length === 0 && !llamadas.includes("gt_registrar") && !llamadas.includes("gt_reingreso"),
      "no se grabó NADA: ni stock ni productividad (" + llamadas.filter((x) => x === "gt_registrar").length + " gt_registrar)");
    chk(await pg.evaluate(() => { try { return !localStorage.getItem("gt_sesion_v2"); } catch { return false; } }),
      "el iframe no deja sesión guardada (no pisa la del celular del operario)");
    chk((await pg.evaluate(() => { try { return localStorage.getItem("gt_queue_v3") || "[]"; } catch { return "?"; } })) === "[]",
      "la cola del navegador quedó vacía");

    // salir de la pestaña apaga el iframe; volver lo reabre
    await pg.click('.tab[data-tab="prod"]'); await pg.waitForTimeout(200);
    chk(!(await pg.getAttribute("#botFrame", "src")), "al cambiar de pestaña el iframe se apaga");
    await pg.click('.tab[data-tab="bot"]');
    await pg.waitForFunction(() => { const f = document.getElementById("botFrame"); return f && f.getAttribute("src"); });
    chk(/vista=1/.test(await pg.getAttribute("#botFrame", "src")), "al volver se reabre en modo vista");
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? "\n" + fallas.length + " falla(s)" : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

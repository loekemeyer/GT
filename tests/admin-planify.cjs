// gt_v191 (18/11/2026): el admin se entra con el CÓDIGO DE PLANIFY («🔑 Código admin»), como Gestión Virgilio.
// gt_admin_identificar devuelve un token de 8 h que reemplaza a la clave en todas las gt_admin_* (gt.pass_ok lo acepta).
// La clave del monitor sigue entrando por el mismo campo (la TV). Y en la Botonera la 🧪 Persona de Prueba sale en otro color.
// Uso: node tests/admin-planify.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const AREAS = [{ codigo: "CORTE", nombre: "Corte", unidad: "cajas", orden: 1, planta: "PELL", pide_codigo: false, pide_cantidad: true, solo: null }];
const PRUEBA = { id: 10, nombre: "🧪 Persona de Prueba", plantas: [], prueba: true };
const EMPS = [{ id: 1, nombre: "Javier Burgos", plantas: [] }];
const COD = "K7P+4M", TOK = "pl.abc123", PASS = "9999", CLAVE_MIN = "4821";
let tokVale = true; const ident = [];
const passOk = (p) => p === PASS || (p === TOK && tokVale);
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop(), b = body ? JSON.parse(body) : {};
      if (fn === "gt_admin_identificar") ident.push(b);
      const out = fn === "gt_admin_identificar" ? (b.p_codigo === COD ? { ok: true, token: TOK, nombre: "Angely Asuaje", resta_s: 28800 }
            : b.p_codigo === "AAAAAA" ? { ok: false, motivo: "Juan no tiene permiso al Admin de GT." } : { ok: false, motivo: "Código incorrecto o vencido." })
        : fn === "gt_monitor_login" ? { ok: b.p_pass === PASS }
        : fn === "gt_monitor_clave" ? (passOk(b.p_pass) ? { ok: true, clave: CLAVE_MIN, cambia_en_s: 42 } : { ok: false })
        : fn === "gt_clave_validar" ? (b.p_clave === CLAVE_MIN ? { ok: true, vista: false, principal: "PELL", empleados: EMPS } : { ok: false })
        : fn === "gt_empleado_prueba" ? PRUEBA
        : fn === "gt_botones3" ? AREAS : [];
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
    const cx = await br.newContext({ viewport: { width: 1280, height: 900 } }), pg = await cx.newPage();
    await pg.goto(url + "admin.html"); await pg.waitForSelector("#login:not(.hidden)");
    chk((await pg.textContent("#login .rot")).includes("Planify"), "el admin pide el código de Planify");
    await pg.fill("#passInput", "AAAAAA"); await pg.click("#passBtn"); await pg.waitForTimeout(300);
    chk((await pg.textContent("#passError")).includes("no tiene permiso"), "sin permiso al panel: lo dice y no entra");
    await pg.fill("#passInput", "k7p+ 4m"); await pg.click("#passBtn");
    await pg.waitForSelector("#home:not(.hidden)");
    chk(ident.some((x) => x.p_codigo === COD), "el código va sin espacios y en mayúsculas");
    chk((await pg.textContent("#quienAdm")).includes("Angely"), "arriba dice quién entró");
    chk(await pg.evaluate(() => localStorage.getItem("gt_monitor_pass")) === TOK, "guarda el token (no el código)");

    await pg.evaluate(() => window.verTab("bot"));
    const fr = await (await (await pg.waitForSelector("#botFrame[src]")).contentFrame());
    await fr.waitForSelector("#nombreScreen:not(.hidden)");
    await fr.waitForSelector("#nombreLista button[data-id='10']");
    await pg.waitForTimeout(300);
    const bgP = await fr.$eval("#nombreLista button[data-id='10']", (b) => getComputedStyle(b).backgroundColor);
    const bgJ = await fr.$eval("#nombreLista button[data-id='1']", (b) => getComputedStyle(b).backgroundColor);
    chk(bgP !== bgJ && bgP === "rgb(254, 243, 199)", "la 🧪 Persona de Prueba sale en otro color (" + bgP + " vs " + bgJ + ")");

    // recarga: sigue adentro con el token; si el token vence, vuelve a pedir el código
    await pg.reload(); await pg.waitForSelector("#home:not(.hidden)");
    chk(true, "al recargar sigue adentro con el token");
    tokVale = false; await pg.reload(); await pg.waitForSelector("#login:not(.hidden)");
    chk((await pg.textContent("#passError")).includes("Planify"), "token vencido en la base: vuelve a pedir el código de Planify");
    await cx.close();

    // la TV: la clave del monitor sigue entrando por el mismo campo
    const cT = await br.newContext({ viewport: { width: 1280, height: 900 } }), t = await cT.newPage();
    await t.goto(url + "admin.html"); await t.waitForSelector("#login:not(.hidden)");
    await t.fill("#passInput", PASS); await t.click("#passBtn"); await t.waitForSelector("#monitor:not(.hidden)");
    chk((await t.textContent("#quienAdm")) === "", "la clave del monitor sigue entrando a la TV (Monitor), sin nombre arriba");
    await t.click("#btnInicio"); await t.waitForSelector("#login:not(.hidden)");
    chk((await t.textContent("#passError")).includes("Planify") && !(await t.isVisible("#home")), "con la clave del monitor, «Inicio» pide el código de Planify");
    await t.reload(); await t.waitForSelector("#monitor:not(.hidden)");
    chk(true, "al recargar con la clave del monitor guardada abre el Monitor, no el admin");
    // viene de Google con la clave del monitor guardada en la PC: pide el código igual
    await t.evaluate(() => sessionStorage.setItem("gt_google_mail", "x@gmail.com")); await t.reload(); await t.waitForSelector("#login:not(.hidden)");
    chk((await t.textContent("#loginMail")).includes("x@gmail.com"), "desde Google con la clave del monitor guardada: pide el código de Planify");
    await cT.close();
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? "\n" + fallas.length + " falla(s)" : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

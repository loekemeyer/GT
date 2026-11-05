// 1.70 (Angely, 02/11/2026): «se marcó por error dos tareas al mismo tiempo: agregá la opción de editar y eliminar para corregir a mano. Cuando se edite o
// elimine algún tiempo, el programa debe volver a hacer los cálculos de la duración». En Producción → «Por operario» cada tramo tiene ✏️ y 🗑️, y los que se
// pisan se marcan «⚠ se superpone». La duración se recalcula al volver a pedir la pantalla (sale de los horarios).
// Uso: node tests/tramos.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const PASS = "9999";
const HOY = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const t = (hhmmss) => HOY + "T" + hhmmss + "-03:00";
const base = { empleado: "Walter Saucedo", uxb: null, unidades: null, auto: false, unidad: "cajas", familia: null, descripcion: null };
let tramos, llamadas, sinCuatro;
const reset = () => {
  llamadas = []; sinCuatro = false;
  tramos = [
    Object.assign({}, base, { area: "Puesta a punto encoladora", rubro: "PAPENC", codigo: "—", desde: t("08:02:10"), hasta: t("08:33:05"), cantidad: null, id_apertura: "a1", id_cierre: "c1" }),
    Object.assign({}, base, { area: "Encolado", rubro: "ENCOL", codigo: "137", desde: t("08:33:05"), hasta: t("09:24:30"), cantidad: 5, id_apertura: "a2", id_cierre: "c2" }),
    Object.assign({}, base, { area: "Limpieza", rubro: "LIMP", codigo: "—", desde: t("08:33:20"), hasta: t("09:25:10"), cantidad: null, id_apertura: "a3", id_cierre: "c3" }),
    Object.assign({}, base, { area: "Encolado", rubro: "ENCOL", codigo: "299", desde: t("09:25:15"), hasta: null, cantidad: null, id_apertura: "a4", id_cierre: null }),
  ];
};
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop(), b = body ? JSON.parse(body) : {};
      if (fn.startsWith("gt_admin_tramo") || fn.startsWith("gt_admin_produccion")) llamadas.push({ fn, b });
      if (fn === "gt_admin_produccion4" && sinCuatro) { res.writeHead(404); return res.end("no existe"); }
      let out = [];
      if (fn === "gt_monitor_login") out = { ok: b.p_pass === PASS };
      else if (fn === "gt_monitor_clave") out = b.p_pass === PASS ? { ok: true, clave: "4821", cambia_en_s: 42 } : { ok: false };
      else if (fn === "gt_admin_produccion4") out = tramos;
      else if (fn === "gt_admin_produccion3") out = tramos.map((r) => { const x = Object.assign({}, r); delete x.id_apertura; delete x.id_cierre; return x; });
      else if (fn === "gt_admin_tramo_editar") {
        const r = tramos.find((x) => x.id_apertura === b.p_id_apertura);
        if (!r) out = { ok: false, error: "no_existe", mensaje: "No encuentro ese tramo" };
        else if (r.id_cierre && new Date(b.p_hasta) <= new Date(b.p_desde)) out = { ok: false, error: "orden", mensaje: "El «hasta» tiene que ser después del «desde»" };
        else { r.desde = b.p_desde; if (r.id_cierre) { r.hasta = b.p_hasta; if (b.p_cantidad != null) r.cantidad = b.p_cantidad; } out = { ok: true }; }
      }
      else if (fn === "gt_admin_tramo_eliminar") {
        const i = tramos.findIndex((x) => x.id_apertura === b.p_id_apertura);
        if (i < 0) out = { ok: false, error: "no_existe", mensaje: "No encuentro ese tramo" }; else { tramos.splice(i, 1); out = { ok: true }; }
      }
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
const filas = (pg) => pg.$$eval("#prodOp tr", (l) => l.slice(1).map((r) => [...r.children].map((c) => c.textContent.replace(/\s+/g, " ").trim())));
srv.listen(0, async () => {
  const url = "http://localhost:" + srv.address().port + "/";
  const br = await pw.chromium.launch();
  try {
    reset();
    const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
    pg.on("dialog", (d) => d.accept());
    await pg.goto(url + "admin.html"); await pg.fill("#passInput", PASS); await pg.click("#passBtn");
    await pg.waitForSelector("#home:not(.hidden)");
    await pg.evaluate((t)=>window.verTab(t),"prod"); await pg.waitForSelector("#prodOp table");
    let f = await filas(pg);
    chk(f.length === 4 && (await pg.$$("#prodOp button[data-tr='editar']")).length === 4 && (await pg.$$("#prodOp button[data-tr='eliminar']")).length === 4, "producción · cada tramo tiene ✏️ y 🗑️ (4 tramos)");
    chk(/se superpone/.test(f[1][1]) && /se superpone/.test(f[2][1]) && !/se superpone/.test(f[0][1]) && !/se superpone/.test(f[3][1]), "producción · los dos que se pisan (Encolado 137 y Limpieza) se marcan, los consecutivos no (" + f.map((r) => /se superpone/.test(r[1]) ? "⚠" : "·").join("") + ")");
    chk(f[1][6].startsWith("0:51"), "producción · el Encolado dura 0:51 (08:33 a 09:24)");
    // ── editar: el error de marcar Limpieza al mismo tiempo se corrige con la hora real ──
    await pg.click("#prodOp tr:nth-child(4) button[data-tr='editar']"); await pg.waitForSelector("#trForm:not(.hidden)");
    chk((await pg.textContent("#trTit")).includes("Limpieza") && (await pg.inputValue("#trDesde")) === "08:33" && (await pg.inputValue("#trHasta")) === "09:25", "editar · abre con las horas del tramo (" + (await pg.inputValue("#trDesde")) + "–" + (await pg.inputValue("#trHasta")) + ")");
    await pg.fill("#trHasta", "08:30"); await pg.click("#trGuardar");
    chk((await pg.textContent("#trMsg")).includes("tiene que ser después") && !llamadas.some((x) => x.fn === "gt_admin_tramo_editar"), "editar · «hasta» antes del «desde»: avisa y no manda nada");
    await pg.fill("#trDesde", "09:20"); await pg.fill("#trHasta", "09:24");
    chk((await pg.textContent("#trDur")).includes("0:04"), "editar · muestra cuánto dura mientras se tipea (" + (await pg.textContent("#trDur")) + ")");
    await pg.click("#trGuardar"); await pg.waitForFunction(() => document.querySelector("#trForm").classList.contains("hidden"));
    const e = llamadas.find((x) => x.fn === "gt_admin_tramo_editar").b;
    chk(e.p_id_apertura === "a3" && e.p_id_cierre === "c3" && e.p_desde === t("09:20:00") && e.p_hasta === t("09:24:00") && e.p_pass === PASS, "editar · manda los ids del tramo y las horas en hora argentina (" + e.p_desde + " → " + e.p_hasta + ")");
    await pg.waitForFunction(() => document.querySelector("#prodInfo").textContent.includes("recalculó"));
    f = await filas(pg);
    chk(!/se superpone/.test(f[1][1]) && !/se superpone/.test(f[2][1]), "editar · al corregir (la limpieza queda adentro del Encolado, como una pausa) ya no se marcan");
    chk(f[2][6].startsWith("0:04") && f[1][6].startsWith("0:47") && /−0:04 pausa/.test(f[1][6]), "editar · las duraciones se recalcularon: Limpieza " + f[2][6] + " y el Encolado descuenta esa pausa (" + f[1][6] + ")");
    // ── cantidad ──
    await pg.click("#prodOp tr:nth-child(3) button[data-tr='editar']"); await pg.waitForSelector("#trForm:not(.hidden)");
    await pg.fill("#trCant", "7"); await pg.click("#trGuardar"); await pg.waitForFunction(() => document.querySelector("#trForm").classList.contains("hidden"));
    chk(llamadas.filter((x) => x.fn === "gt_admin_tramo_editar").pop().b.p_cantidad === 7, "editar · también se puede corregir la cantidad");
    // ── tramo en curso: sólo el «desde» ──
    await pg.click("#prodOp tr:nth-child(5) button[data-tr='editar']"); await pg.waitForSelector("#trForm:not(.hidden)");
    chk(await pg.isHidden("#trHastaL") && await pg.isHidden("#trCantL"), "en curso · sólo se puede corregir el «desde» (no hay hasta ni cantidad)");
    await pg.fill("#trDesde", "09:30"); await pg.click("#trGuardar"); await pg.waitForFunction(() => document.querySelector("#trForm").classList.contains("hidden"));
    const en = llamadas.filter((x) => x.fn === "gt_admin_tramo_editar").pop().b;
    chk(en.p_id_cierre === null && en.p_hasta === null && en.p_desde === t("09:30:00"), "en curso · manda el cierre vacío");
    // ── eliminar ──
    await pg.click("#prodOp tr:nth-child(4) button[data-tr='eliminar']"); await pg.waitForFunction(() => document.querySelector("#prodInfo").textContent.includes("eliminado"));
    const d = llamadas.find((x) => x.fn === "gt_admin_tramo_eliminar").b;
    f = await filas(pg);
    chk(d.p_id_apertura === "a3" && d.p_id_cierre === "c3" && f.length === 3 && !f.some((r) => r[1].includes("Limpieza")), "eliminar · el tramo desaparece de la lista (" + f.length + " tramos)");
    // ── la base vieja (sin produccion4): sigue mostrando, sin botones ──
    sinCuatro = true; await pg.click("#prodRef"); await pg.waitForTimeout(700);
    chk((await filas(pg)).length === 3 && (await pg.$$("#prodOp button[data-tr]")).length === 0, "sin gt_admin_produccion4 cae a la anterior: muestra los tramos y no ofrece corregir");
    await pg.close();
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? "\n" + fallas.length + " falla(s)" : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

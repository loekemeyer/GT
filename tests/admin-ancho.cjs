// 1.71 (Angely, 02/11/2026): «se ve mal el admin, no veo todas las opciones: que se vea todo sin scrollear horizontalmente». En una ventana de ~930 px
// (la de la captura) cada pestaña tiene que entrar entera: las pestañas del menú, y las tablas de Producción, Asistencia y Empleados sin barra horizontal.
// Uso: node tests/admin-ancho.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const PASS = "9999";
const HOY = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const t = (hhmm) => HOY + "T" + hhmm + ":00-03:00";
// lo de la captura de Angely: Javier, con descripciones y familias largas
const T = (area, rubro, codigo, desc, fam, d, h, cant, uni, ia) => ({ empleado: "Javier Burgos", area, rubro, codigo, descripcion: desc, familia: fam, desde: t(d), hasta: h ? t(h) : null, cantidad: cant, unidad: "cajas", uxb: 16,
  unidades: uni, auto: false, id_apertura: "a" + ia, id_cierre: h ? "c" + ia : null });
const PROD = [
  T("Corte", "CORTE", "22 (03 Natural)", "03 Natural", null, "14:17", null, null, null, 1),
  T("Emblistado", "EMBL", "416", "Cuadro Mold 03 Animales ByN", "Mold 03 · 40*50", "08:00", "09:44", 12, 192, 2),
  T("Movimientos", "MOVIM", "—", "Armado cajas", null, "09:48", "09:48", null, null, 3),
  T("Armado de cajas", "ARMCAJ", "38*38", null, null, "09:49", "10:09", 20, null, 4),
  T("Contraído", "CONTR", "584", "Cajon 2 Tablas Mold 045 Natural c/Grabado", "Cajon 2 Tablas · Mold 045 · 20*30", "10:09", "10:53", 20, 120, 5),
  T("Armado de cajas", "ARMCAJ", "40*15", null, null, "10:56", "11:16", 28, null, 6),
  T("Contraído", "CONTR", "134", "Cuadro Mold 03 Nature", "Mold 03 · 30*40", "11:16", "11:35", 15, 240, 7),
  T("Puesta a punto encoladora", "PAPENC", "—", "con Ximena Ortiz", null, "11:35", "11:41", null, null, 8),
  T("Montaje", "MONT", "409 (30*40)", "Cuadros Mold 03 Set x3 Ciudades", "Mold 03 · 30*40", "13:55", null, null, null, 9),
];
const ASIS = [
  { empleado: "Javier Burgos", legajo: "t95", entrada: HOY + "T07:23:00", entrada_prevista: HOY + "T08:00:00", almuerzo_sale: HOY + "T12:00:52", almuerzo_vuelve: HOY + "T13:00:24", almuerzo_desde: HOY + "T12:00:00", almuerzo_hasta: HOY + "T13:00:00",
    flexible: true, fin: null, salida_prevista: HOY + "T17:30:00", area_abierta: true, termino: false, tolerancia_min: 5, con_codigo: true, productivo: HOY + "T08:00:45", productivo_area: "Movimientos", libre: false },
  { empleado: "Lautaro Durante", legajo: "t161", entrada: HOY + "T08:12:00", entrada_prevista: HOY + "T08:00:00", almuerzo_sale: null, almuerzo_vuelve: null, almuerzo_desde: HOY + "T12:40:00", almuerzo_hasta: HOY + "T13:00:00",
    flexible: false, fin: null, salida_prevista: HOY + "T17:30:00", area_abierta: false, termino: false, tolerancia_min: 5, con_codigo: true, productivo: HOY + "T08:30:00", productivo_area: "Encolado", libre: false },
];
const dia = (dow, e, ad, ah, s, x) => Object.assign({ dow, libre: false, entrada: e, almuerzo_desde: ad, almuerzo_hasta: ah, sin_almuerzo: false, salida: s }, x || {});
const EMPS = [
  { id: 1, nombre: "Javier Burgos", legajo: "t95", activo: true, baja_en: null, plantas: [], flexible: true, con_horario: false, horario: [] },
  { id: 2, nombre: "Lautaro Durante", legajo: "t161", activo: true, baja_en: null, plantas: ["ESNA", "PELL"], flexible: false, con_horario: true,
    horario: [dia(1, "08:00", "12:40", "13:00", "17:30"), dia(2, "08:00", null, null, "13:30", { sin_almuerzo: true }), dia(3, "08:00", "12:40", "13:00", "17:30"), dia(4, "08:00", "12:40", "13:00", "17:30"),
              dia(5, "08:00", "12:40", "13:00", "17:30"), { dow: 6, libre: true }, { dow: 7, libre: true }] },
  { id: 9, nombre: "David Galarza", legajo: "t172", activo: false, baja_en: "2026-10-29T13:17:00+00:00", plantas: [], flexible: false, con_horario: false, horario: [] },
];
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop(), b = body ? JSON.parse(body) : {};
      let out = [];
      if (fn === "gt_monitor_login") out = { ok: b.p_pass === PASS };
      else if (fn === "gt_monitor_clave") out = b.p_pass === PASS ? { ok: true, clave: "4821", cambia_en_s: 42 } : { ok: false };
      else if (fn === "gt_admin_produccion4") out = PROD;
      else if (fn === "gt_admin_asistencia3") out = ASIS;
      else if (fn === "gt_admin_empleados") out = EMPS;
      else if (fn === "gt_admin_horario_general") out = { ok: true, entrada: "08:00", almuerzo_desde: "12:00", almuerzo_hasta: "13:00", salida: "17:30", tolerancia_min: 5, principal: "PELL", plantas: [{ codigo: "PELL", nombre: "Pellegrini" }, { codigo: "ESNA", nombre: "Esnaola" }] };
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
const medir = (pg, sel) => pg.$eval(sel, (e) => ({ sw: e.scrollWidth, cw: e.clientWidth }));
srv.listen(0, async () => {
  const url = "http://localhost:" + srv.address().port + "/";
  const br = await pw.chromium.launch();
  try {
    for (const w of [930, 1366]) {
      const pg = await br.newPage({ viewport: { width: w, height: 760 } });
      await pg.goto(url + "admin.html"); await pg.fill("#passInput", PASS); await pg.click("#passBtn");
      await pg.waitForSelector("#monitor:not(.hidden)");
      const tabs = await medir(pg, "#tabs");
      chk(tabs.sw <= tabs.cw + 1, w + " px · las 8 pestañas del menú se ven todas, sin scrollear (" + tabs.sw + " de " + tabs.cw + ")");
      await pg.click('.tab[data-tab="prod"]'); await pg.waitForSelector("#prodOp table");
      let m = await medir(pg, "#prodOp");
      chk(m.sw <= m.cw + 1, w + " px · Producción «Por operario» entra entera: se ven las 10 columnas y los botones ✏️ 🗑️ (" + m.sw + " de " + m.cw + ")");
      const ult = await pg.$eval("#prodOp tr:nth-child(2) td:last-child button", (b) => { const r = b.getBoundingClientRect(); return { der: r.right, vw: window.innerWidth }; });
      chk(ult.der <= ult.vw, w + " px · el botón ✏️ queda dentro de la ventana (a " + Math.round(ult.der) + " px de " + ult.vw + ")");
      const arriba = await pg.$eval("#prodOp", (e) => e.getBoundingClientRect().left);
      chk(arriba >= 0, w + " px · la tabla no se corta por la izquierda");
      for (const id of ["prodArea", "prodRitmo"]) { m = await medir(pg, "#" + id); chk(m.sw <= m.cw + 1, w + " px · Producción #" + id + " sin scroll horizontal"); }
      await pg.click('.tab[data-tab="asis"]'); await pg.waitForSelector("#asisTabla table");
      m = await medir(pg, "#asisTabla"); chk(m.sw <= m.cw + 1, w + " px · Asistencia entra entera (" + m.sw + " de " + m.cw + ")");
      await pg.click('.tab[data-tab="emp"]'); await pg.waitForSelector("#empLista table");
      m = await medir(pg, "#empLista"); chk(m.sw <= m.cw + 1, w + " px · Empleados entra entero (" + m.sw + " de " + m.cw + ")");
      await pg.close();
    }
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? "\n" + fallas.length + " falla(s)" : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

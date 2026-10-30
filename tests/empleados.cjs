// 1.69 (Angely, 30/10/2026): «un módulo para ingresar o dar de baja a los empleados… sus datos y su horario, para que el programa pueda
// controlar su fichada». Pestaña 👥 Empleados del admin: lista con el horario resumido, alta, edición, baja y reactivación, y en Asistencia
// el día de franco dice «Franco» (no «No vino»).
// Uso: node tests/empleados.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const PASS = "9999";
const dia = (dow, ent, ad, ah, sal, x) => Object.assign({ dow, libre: false, entrada: ent, almuerzo_desde: ad, almuerzo_hasta: ah, sin_almuerzo: false, salida: sal }, x || {});
const libre = (dow) => ({ dow, libre: true, entrada: null, almuerzo_desde: null, almuerzo_hasta: null, sin_almuerzo: false, salida: null });
const SEMANA = [dia(1, "08:00", "12:40", "13:00", "17:30"), dia(2, "08:00", null, null, "13:30", { sin_almuerzo: true }), dia(3, "08:00", "12:40", "13:00", "17:30"),
                dia(4, "08:00", "12:40", "13:00", "17:30"), dia(5, "08:00", "12:40", "13:00", "17:30"), libre(6), libre(7)];
let emps, nextId, llamadas, asisCae;
const reset = () => {
  nextId = 20; llamadas = []; asisCae = false;
  emps = [
    { id: 1, nombre: "Javier Burgos", legajo: "t95", activo: true, baja_en: null, plantas: [], flexible: true, con_horario: false, horario: [] },
    { id: 2, nombre: "Lautaro Durante", legajo: "t161", activo: true, baja_en: null, plantas: [], flexible: false, con_horario: true, horario: SEMANA },
    { id: 5, nombre: "Luis Luna", legajo: "t157", activo: true, baja_en: null, plantas: ["ESNA", "PELL"], flexible: false, con_horario: false, horario: [] },
    { id: 9, nombre: "David Galarza", legajo: "t172", activo: false, baja_en: "2026-10-29T13:17:00+00:00", plantas: [], flexible: false, con_horario: false, horario: [] },
  ];
};
const GRAL = { ok: true, entrada: "08:00", almuerzo_desde: "12:00", almuerzo_hasta: "13:00", salida: "17:30", tolerancia_min: 5, principal: "PELL",
               plantas: [{ codigo: "PELL", nombre: "Pellegrini" }, { codigo: "ESNA", nombre: "Esnaola" }] };
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop(), b = body ? JSON.parse(body) : {};
      if (fn.startsWith("gt_admin_empleado")) llamadas.push({ fn, b });
      if (fn === "gt_admin_asistencia3" && asisCae) { res.writeHead(404); return res.end("no existe"); }
      let out = [];
      if (fn === "gt_monitor_login") out = { ok: b.p_pass === PASS };
      else if (fn === "gt_monitor_clave") out = b.p_pass === PASS ? { ok: true, clave: "4821", cambia_en_s: 42 } : { ok: false };
      else if (fn === "gt_admin_empleados") out = emps.filter((e) => e.activo || b.p_bajas);
      else if (fn === "gt_admin_horario_general") out = GRAL;
      else if (fn === "gt_admin_empleado_guardar") {
        if (emps.some((e) => e.nombre === b.p_nombre && e.id !== b.p_id)) out = { ok: false, error: "nombre", mensaje: "Ya hay alguien con ese nombre" };
        else {
          const id = b.p_id || nextId++, ex = emps.find((e) => e.id === id), n = { id, nombre: b.p_nombre, legajo: b.p_legajo, activo: ex ? ex.activo : true, baja_en: null,
            plantas: b.p_plantas.length === 1 && b.p_plantas[0] === "PELL" ? [] : b.p_plantas, flexible: b.p_flexible, con_horario: true,
            horario: b.p_horario.map((d) => d.libre ? libre(d.dow) : Object.assign({ almuerzo_desde: null, almuerzo_hasta: null, sin_almuerzo: false }, d)) };
          emps = ex ? emps.map((e) => e.id === id ? n : e) : emps.concat([n]);
          out = { ok: true, id, nombre: b.p_nombre };
        }
      }
      else if (fn === "gt_admin_empleado_baja") {
        const e = emps.find((x) => x.id === b.p_id);
        if (e) { e.activo = b.p_activo; e.baja_en = b.p_activo ? null : "2026-10-30T14:00:00+00:00"; }
        out = e ? { ok: true, id: e.id, nombre: e.nombre, activo: e.activo } : { ok: false, error: "sin_cambio" };
      }
      else if (fn === "gt_admin_asistencia3" || fn === "gt_admin_asistencia2") {
        const base = { legajo: null, entrada: null, entrada_prevista: "2026-10-30T08:00:00", almuerzo_sale: null, almuerzo_vuelve: null, almuerzo_desde: null, almuerzo_hasta: null, flexible: false, fin: null,
                       salida_prevista: "2026-10-30T17:30:00", area_abierta: false, termino: false, tolerancia_min: 5, con_codigo: false, productivo: null, productivo_area: null };
        out = [Object.assign({}, base, { empleado: "Ana Franco", libre: true }), Object.assign({}, base, { empleado: "Beto Faltó", libre: false })];
        if (fn === "gt_admin_asistencia2") out.forEach((r) => delete r.libre);
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
srv.listen(0, async () => {
  const url = "http://localhost:" + srv.address().port + "/";
  const br = await pw.chromium.launch();
  try {
    reset();
    const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
    pg.on("dialog", (d) => d.accept());
    await pg.goto(url + "admin.html"); await pg.fill("#passInput", PASS); await pg.click("#passBtn");
    await pg.waitForSelector("#monitor:not(.hidden)");
    await pg.click('.tab[data-tab="emp"]'); await pg.waitForSelector("#empLista table");
    // ── lista ──
    const filas = await pg.$$eval("#empLista tr", (l) => l.slice(1).map((r) => [...r.children].map((c) => c.textContent.replace(/\s+/g, " ").trim())));
    chk(filas.length === 4 && filas[0][1] === "Javier Burgos" && filas[3][1] === "David Galarza", "lista · los activos primero y el de baja al final (" + filas.map((r) => r[1]).join(", ") + ")");
    chk(/general 08:00–17:30/.test(filas[0][3]) && /Pellegrini/.test(filas[0][2]), "lista · quien no tiene horario propio dice «general» y su planta (" + filas[0][3] + " · " + filas[0][2] + ")");
    chk(/Lun 08:00–17:30 alm 12:40–13:00/.test(filas[1][3]) && /Mar 08:00–13:30 de corrido/.test(filas[1][3]) && /Mié–Vie 08:00–17:30 alm 12:40–13:00/.test(filas[1][3]) && !/Sáb|Dom/.test(filas[1][3]),
        "lista · el horario por día se resume y los francos no figuran (" + filas[1][3] + ")");
    chk(/Esnaola/.test(filas[2][2]) && /Pellegrini/.test(filas[2][2]), "lista · quien trabaja en las dos plantas las muestra (" + filas[2][2] + ")");
    chk(/De baja 29\/10/.test(filas[3][4]) && /Reactivar/.test(filas[3][5]) && /Dar de baja/.test(filas[0][5]), "lista · el de baja dice la fecha y se puede reactivar (" + filas[3][4] + ")");
    // ── alta ──
    await pg.click("#empNuevo"); await pg.waitForSelector("#empForm:not(.hidden)");
    const base = await pg.$$eval("#efSemana tr[data-dow]", (l) => l.map((r) => [r.querySelector(".ef-trab").checked, r.querySelector(".ef-ent").value, r.querySelector(".ef-ad").value, r.querySelector(".ef-ah").value, r.querySelector(".ef-sal").value].join("|")));
    chk(base.slice(0, 5).every((x) => x === "true|08:00|12:00|13:00|17:30") && base[5].startsWith("false") && base[6].startsWith("false"), "alta · arranca con el horario general de lunes a viernes y sábado y domingo de franco");
    chk(await pg.$eval("#efSemana tr[data-dow='6'] .ef-ent", (e) => e.disabled), "alta · el día de franco no tiene horas para tipear");
    await pg.fill("#efNombre", "Nuevo Empleado"); await pg.fill("#efLegajo", "t175");
    await pg.fill("#efSemana tr[data-dow='3'] .ef-sal", "07:00"); await pg.click("#efGuardar");
    chk((await pg.textContent("#efMsg")).includes("la entrada tiene que ser antes que la salida") && !llamadas.some((x) => x.fn === "gt_admin_empleado_guardar"), "alta · entrada después de la salida: avisa y no manda nada (" + (await pg.textContent("#efMsg")) + ")");
    await pg.fill("#efSemana tr[data-dow='3'] .ef-sal", "17:30");
    await pg.fill("#efSemana tr[data-dow='4'] .ef-ad", "14:00"); await pg.click("#efGuardar");
    chk((await pg.textContent("#efMsg")).includes("el almuerzo tiene que quedar entre"), "alta · almuerzo fuera del horario: avisa (" + (await pg.textContent("#efMsg")) + ")");
    await pg.fill("#efSemana tr[data-dow='4'] .ef-ad", "12:00");
    // copiar el lunes, jueves de franco, martes de corrido
    await pg.fill("#efSemana tr[data-dow='1'] .ef-sal", "16:00"); await pg.click("#efCopiar");
    chk((await pg.inputValue("#efSemana tr[data-dow='5'] .ef-sal")) === "16:00", "alta · «Copiar el lunes a lun–vie» pasa las horas al viernes");
    await pg.uncheck("#efSemana tr[data-dow='4'] .ef-trab");
    await pg.check("#efSemana tr[data-dow='2'] .ef-sin"); await pg.fill("#efSemana tr[data-dow='2'] .ef-sal", "13:30");
    chk(await pg.$eval("#efSemana tr[data-dow='2'] .ef-ad", (e) => e.disabled), "alta · «de corrido» apaga las horas de almuerzo de ese día");
    await pg.click("#efGuardar"); await pg.waitForFunction(() => document.querySelector("#empForm").classList.contains("hidden"));
    const g = llamadas.find((x) => x.fn === "gt_admin_empleado_guardar").b;
    chk(g.p_id === null && g.p_nombre === "Nuevo Empleado" && g.p_legajo === "t175" && g.p_plantas.join() === "PELL" && g.p_flexible === false && g.p_pass === PASS, "alta · manda nombre, legajo, planta y clave (" + [g.p_id, g.p_nombre, g.p_legajo, g.p_plantas.join()].join(" · ") + ")");
    chk(g.p_horario.length === 7 && g.p_horario[3].libre === true && g.p_horario[5].libre === true && g.p_horario[6].libre === true && g.p_horario[1].sin_almuerzo === true && g.p_horario[1].salida === "13:30" && g.p_horario[0].salida === "16:00",
        "alta · el horario sale con los 7 días: francos jueves, sábado y domingo, martes de corrido");
    await pg.waitForFunction(() => document.querySelectorAll("#empLista tr").length === 6);
    const nuevo = await pg.$$eval("#empLista tr", (l) => l.map((r) => r.textContent.replace(/\s+/g, " ").trim()).find((t) => t.includes("Nuevo Empleado")));
    chk(/Lun–Mié.*|Lun 08:00–16:00/.test(nuevo) && /Activo/.test(nuevo) && (await pg.textContent("#empInfo")).includes("Alta hecha: Nuevo Empleado"), "alta · aparece en la lista, activo y con su horario (" + (nuevo || "").slice(0, 110) + ")");
    // nombre repetido: el error de la base se ve y el formulario queda abierto
    await pg.click("#empNuevo"); await pg.fill("#efNombre", "Nuevo Empleado"); await pg.click("#efGuardar"); await pg.waitForFunction(() => document.querySelector("#efMsg").textContent.includes("Ya hay alguien"));
    chk(!(await pg.isHidden("#empForm")), "alta · nombre repetido: lo dice la base y el formulario sigue abierto");
    await pg.click("#efCancelar");
    // ── edición ──
    await pg.click('#empLista button[data-acc="editar"][data-id="5"]'); await pg.waitForSelector("#empForm:not(.hidden)");
    chk((await pg.textContent("#efTit")) === "Editar: Luis Luna" && (await pg.inputValue("#efNombre")) === "Luis Luna" && (await pg.inputValue("#efLegajo")) === "t157", "edición · trae los datos de la persona");
    chk((await pg.$$eval("#efPlantas .ef-pl", (l) => l.map((c) => c.checked + "/" + c.disabled).join())) === "true/true,true/true", "edición · las plantas que ya tiene quedan marcadas y no se pueden sacar desde acá");
    await pg.click("#efFlex");
    chk(await pg.$eval("#efSemana tr[data-dow='1'] .ef-ad", (e) => e.disabled), "edición · almuerzo flexible: no se tipea el almuerzo");
    await pg.click("#efCancelar");
    // ── baja y reactivación ──
    await pg.click('#empLista button[data-acc="baja"][data-id="2"]'); await pg.waitForFunction(() => document.querySelector("#empInfo").textContent.includes("dado de baja"));
    const baja = llamadas.filter((x) => x.fn === "gt_admin_empleado_baja").pop().b;
    chk(baja.p_id === 2 && baja.p_activo === false, "baja · Lautaro Durante se da de baja (sin borrar nada: activo = false)");
    chk((await pg.$$eval("#empLista tr", (l) => l.map((r) => r.textContent).find((t) => t.includes("Lautaro")))).includes("De baja"), "baja · queda en la lista como «De baja»");
    await pg.click('#empLista button[data-acc="alta"][data-id="2"]'); await pg.waitForFunction(() => document.querySelector("#empInfo").textContent.includes("reactivado"));
    chk(llamadas.filter((x) => x.fn === "gt_admin_empleado_baja").pop().b.p_activo === true, "baja · reactivar lo vuelve a activar");
    await pg.uncheck("#empBajas"); await pg.waitForFunction(() => !document.querySelector("#empLista").textContent.includes("David Galarza"));
    chk(true, "lista · sin «ver dados de baja» el de baja no figura");
    // ── Asistencia: el franco ──
    await pg.click('.tab[data-tab="asis"]'); await pg.waitForSelector("#asisTabla table");
    const asis = await pg.$$eval("#asisTabla tr", (l) => l.slice(1).map((r) => r.textContent.replace(/\s+/g, " ").trim()));
    chk(/Ana Franco.*Franco/.test(asis[0]) && !/No vino/.test(asis[0]) && /Beto Faltó.*No vino/.test(asis[1]), "asistencia · el día de franco dice «Franco» y no «No vino»; quien faltó sin franco sigue como falta");
    chk((await pg.textContent("#asisInfo")).includes("1 con faltas") && (await pg.textContent("#asisInfo")).includes("1 de franco"), "asistencia · cuenta 1 con faltas y 1 de franco (" + (await pg.textContent("#asisInfo")) + ")");
    asisCae = true; await pg.click("#asisRef"); await pg.waitForTimeout(600);
    chk((await pg.$$eval("#asisTabla tr", (l) => l.length)) === 3, "asistencia · si la base no tiene asistencia3 cae a la anterior y sigue mostrando");
    await pg.close();
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? "\n" + fallas.length + " falla(s)" : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

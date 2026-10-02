// Smoke de la app de operario GT con la base simulada (no pega a Supabase).
// Uso: node tests/smoke.cjs   (necesita playwright; Chromium en /opt/pw-browsers)
const path = require("path");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const http = require("http"), fs = require("fs");
const ROOT = path.join(__dirname, "..");
const AREAS = [
  { codigo: "CORTE", nombre: "Corte", unidad: "unidades cortadas", orden: 1 },
  { codigo: "GRAMP", nombre: "Grampeado", unidad: "unidades grampeadas", orden: 2, pide_codigo: true },
  { codigo: "MONT", nombre: "Montaje", unidad: "cajas fabricadas", orden: 4, pide_codigo: true },
  { codigo: "PED", nombre: "Pedidos", unidad: "pedidos armados", orden: 8, pide_cantidad: false },
  { codigo: "DECO", nombre: "Deco", unidad: "unidades fabricadas", orden: 9 },
  { codigo: "GUARD", nombre: "Guardado a góndola", unidad: "cajas guardadas", orden: 10, pide_codigo: true },
  { codigo: "RECIB", nombre: "Recibir mercadería", unidad: "unidades recibidas", orden: 11, pide_codigo: false, pide_cantidad: false },
  { codigo: "ALMU", nombre: "Almuerzo", unidad: "—", orden: 12, pide_codigo: false, pide_cantidad: false },
];
// 1.22: las áreas de Esnaola (gt_botones2 trae la planta); en Pellegrini no se ven
const AREAS2 = AREAS.concat([
  { codigo: "MOLDU", nombre: "Moldurado", unidad: "metros", orden: 21, pide_codigo: false, pide_cantidad: true, planta: "ESNA" },
  { codigo: "LIJA", nombre: "Lijado", unidad: "metros", orden: 22, pide_codigo: false, pide_cantidad: true, planta: "ESNA" },
  { codigo: "PINT", nombre: "Pintado", unidad: "paquetes", orden: 23, pide_codigo: false, pide_cantidad: true, planta: "ESNA" },
  // 1.28 (D31): Movimientos está en TODAS las plantas: gt_botones2 lo devuelve una vez por planta
  { codigo: "MOVIM", nombre: "Movimientos", unidad: "—", orden: 30, pide_codigo: false, pide_cantidad: false, planta: "PELL" },
  { codigo: "MOVIM", nombre: "Movimientos", unidad: "—", orden: 30, pide_codigo: false, pide_cantidad: false, planta: "ESNA" },
  // 1.31 (Elías): Baño, igual que Movimientos
  { codigo: "BANO", nombre: "Baño", unidad: "—", orden: 31, pide_codigo: false, pide_cantidad: false, planta: "PELL" },
  { codigo: "BANO", nombre: "Baño", unidad: "—", orden: 31, pide_codigo: false, pide_cantidad: false, planta: "ESNA" }]);
// 1.24: las preguntas de Esnaola (gt_pasos). El paso de PINT al TERMINAR es sólo del mock: prueba el momento 'terminar'.
const MOLD = ["03", "05", "012"];
const PASOS = [
  { rubro: "LIJA", orden: 1, campo: "texto", pregunta: "¿Qué moldura vas a lijar?", opciones: MOLD, fuente: "molduras", momento: "empezar" },
  { rubro: "LIJA", orden: 2, campo: "anilina", pregunta: "¿Le ponés anilina?", opciones: ["Sí", "No"], momento: "empezar" },
  { rubro: "LIJA", orden: 3, campo: "color", pregunta: "¿De qué color es la anilina?", opciones: ["Marrón", "Cedro", "Roble", "Verde"], si_campo: "anilina", si_valor: "Sí", momento: "empezar" },
  { rubro: "MOLDU", orden: 1, campo: "texto", pregunta: "¿Qué moldura vas a hacer?", opciones: MOLD, fuente: "molduras", momento: "empezar" },
  { rubro: "PINT", orden: 1, campo: "color", pregunta: "¿De qué color vas a pintar?", opciones: ["Blanco parcial", "Blanco total", "Negro"], momento: "empezar" },
  { rubro: "PINT", orden: 2, campo: "texto", pregunta: "¿Qué moldura vas a pintar?", opciones: MOLD, fuente: "molduras", momento: "empezar" },
  { rubro: "PINT", orden: 3, campo: "manos", pregunta: "¿Cuántas manos?", opciones: ["1", "2"], momento: "terminar" },
  // 1.33 (Elías): Movimientos pregunta qué está haciendo, con respuesta libre (sin opciones)
  { rubro: "MOVIM", orden: 1, campo: "que", pregunta: "¿Qué estás haciendo?", opciones: null, momento: "empezar" }];
const PELL = { codigo: "PELL", nombre: "Pellegrini" }, ESNA = { codigo: "ESNA", nombre: "Esnaola" };
let CLAVE_MON = null; const LOGINS = []; const REING = []; const ARMAR = [];
let SOLO_CORTO = false;   // 1.32: día con un solo tramo de menos de 2 min
const INGRESOS = [];   // 1.33: los INGRESO van aparte (las posiciones de db de abajo son de los eventos de área)
const db = [];
const CODIGOS = [{ codigo: "505", descripcion: "Pinza", medida: "10*15", rubro: "GRAMP" }, { codigo: "760", descripcion: "Otra", medida: null, rubro: "DECO" },
  { codigo: "136", descripcion: "Cuadros Mold 03 Set x3 Botanica", medida: "30*40 + 20*30 + 15*21", rubro: "MONT" },
  { codigo: "INSUMO", descripcion: "Insumo", medida: null, rubro: "RECIB" }, { codigo: "MOLDURA", descripcion: "Moldura", medida: null, rubro: "RECIB" }];
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const b = JSON.parse(body || "{}"), fn = req.url.split("/").pop();
      let out;
      if (fn === "gt_monitor_clave") out = !CLAVE_MON ? { ok: true, sin_clave: true, clave: "1234", cambia_en_s: 42 } : b.p_pass === CLAVE_MON ? { ok: true, clave: "1234", cambia_en_s: 42 } : { ok: false };
      else if (fn === "gt_monitor_login") { LOGINS.push(b); out = { ok: b.p_pass === CLAVE_MON, en_horario: false }; }
      else if (fn === "gt_reingreso") { REING.push(b.p_empleado); out = null; }
      else if (fn === "gt_clave_validar") out = b.p_clave === "1234" ? { ok: true, principal: "PELL", empleados: [{ id: 7, nombre: "Prueba", plantas: [PELL] }, { id: 8, nombre: "Otro", plantas: [PELL] },
          { id: 6, nombre: "Dario Mendez", plantas: [PELL, ESNA] }] } : { ok: false };
      else if (fn === "gt_botones") out = AREAS;
      else if (fn === "gt_botones2") out = AREAS2;
      else if (fn === "gt_codigos_area" || fn === "gt_codigos_area2") out = CODIGOS;
      else if (fn === "gt_admin_produccion3" && SOLO_CORTO) out = [{ empleado: "Luis Luna", area: "Encolado", rubro: "ENCOL", codigo: "173", descripcion: "Cuadro Mold 03 Grafic Work",
          desde: "2026-10-02T13:23:26Z", hasta: "2026-10-02T13:24:09Z", cantidad: 1, unidad: "cajas encoladas", uxb: 16, unidades: 16, familia: "Mold 03 · 10*30" }];
      else if (fn === "gt_admin_ritmo2" && SOLO_CORTO) out = [];
      else if (fn === "gt_admin_produccion2" || fn === "gt_admin_produccion3") out = b.p_pass === CLAVE_MON ? [
        { empleado: "Prueba", area: "Encolado", rubro: "ENCOL", codigo: "080", descripcion: "Cuadro Ciudades MDF", desde: "2026-10-01T11:00:00Z", hasta: "2026-10-01T12:00:00Z", cantidad: 10, unidad: "cajas encoladas", uxb: 24, unidades: 240, familia: "MDF · 30*40" },
        { empleado: "Prueba", area: "Baño", rubro: "BANO", codigo: null, descripcion: null, desde: "2026-10-01T11:15:00Z", hasta: "2026-10-01T11:30:00Z", cantidad: null, unidad: "—", uxb: null, unidades: null },
        // 1.36: un movimiento de 11:35 a 11:55 con un baño de 11:40 a 11:45 ADENTRO: al encolado se le restan 20, no 25
        { empleado: "Prueba", area: "Movimientos", rubro: "MOVIM", codigo: null, descripcion: null, desde: "2026-10-01T11:35:00Z", hasta: "2026-10-01T11:55:00Z", cantidad: null, unidad: "—", uxb: null, unidades: null },
        { empleado: "Prueba", area: "Baño", rubro: "BANO", codigo: null, descripcion: null, desde: "2026-10-01T11:40:00Z", hasta: "2026-10-01T11:45:00Z", cantidad: null, unidad: "—", uxb: null, unidades: null },
        { empleado: "Prueba", area: "Corte", rubro: "CORTE", codigo: "1", descripcion: "03 Bco", desde: "2026-10-01T12:00:00Z", hasta: null, cantidad: null, unidad: "unidades cortadas", uxb: null, unidades: null },
        { empleado: "Otro", area: "Gancho", rubro: "GANCHO", codigo: "080", descripcion: null, desde: "2026-10-01T15:00:00Z", hasta: "2026-10-01T20:30:00Z", cantidad: null, unidad: "cajas", uxb: 24, unidades: null, auto: true }] : [];
      else if (fn === "gt_admin_ritmo2") out = b.p_pass === CLAVE_MON ? [
        { empleado: "Prueba", legajo: "t1", area: "Montaje", rubro: "MONT", grupo: "Mold 03 · 30*40", codigos: "183", unidad: "unidades", hecho: 240, horas: 1, por_hora: 240, prom_grupo: 400, tramos: 1 }] : [];
      // 1.37: rendimiento (json en una fila). Fila 10*30: promedio 2.200 s / 700 u = 3,14 → Prueba 2,5 (rápido), Otro 4,0 (lento)
      else if (fn === "gt_admin_rendimiento") out = b.p_pass === CLAVE_MON ? { desde: b.p_desde, hasta: b.p_hasta, filas: [
          { area: "Corte", rubro: "CORTE", orden: 1, variable: "Mold 03 · 25 cm", empleado: "Otro", legajo: "t2", unidades: 100, segundos: 3600, tramos: 2 },
          { area: "Encolado", rubro: "ENCOL", orden: 3, variable: "10*30", empleado: "Prueba", legajo: "t1", unidades: 400, segundos: 1000, tramos: 3 },
          { area: "Encolado", rubro: "ENCOL", orden: 3, variable: "10*30", empleado: "Otro", legajo: "t2", unidades: 300, segundos: 1200, tramos: 2 },
          { area: "Encolado", rubro: "ENCOL", orden: 3, variable: "30*40", empleado: "Prueba", legajo: "t1", unidades: 12, segundos: 187, tramos: 1 }] } : null;
      else if (fn === "gt_admin_asistencia2") out = b.p_pass === CLAVE_MON ? [
        { empleado: "Prueba", legajo: "t1", entrada: "2026-10-01T08:12:00", entrada_prevista: "2026-10-01T08:00:00", almuerzo_sale: null, almuerzo_vuelve: null,
          almuerzo_desde: "2026-10-01T12:00:00", almuerzo_hasta: "2026-10-01T13:00:00", flexible: false, fin: null, salida_prevista: "2026-10-01T17:30:00",
          area_abierta: true, termino: false, tolerancia_min: 5, con_codigo: true, productivo: "2026-10-01T08:30:00", productivo_area: "Corte" },
        { empleado: "Otro", legajo: "t2", entrada: null, entrada_prevista: "2026-10-01T08:00:00", almuerzo_sale: null, almuerzo_vuelve: null,
          almuerzo_desde: "2026-10-01T12:00:00", almuerzo_hasta: "2026-10-01T13:00:00", flexible: false, fin: null, salida_prevista: "2026-10-01T17:30:00",
          area_abierta: false, termino: false, tolerancia_min: 5, con_codigo: false, productivo: null, productivo_area: null },
        { empleado: "Tercero", legajo: "t3", entrada: "2026-10-01T07:42:00", entrada_prevista: "2026-10-01T08:00:00", almuerzo_sale: null, almuerzo_vuelve: null,
          almuerzo_desde: "2026-10-01T12:00:00", almuerzo_hasta: "2026-10-01T13:00:00", flexible: false, fin: null, salida_prevista: "2026-10-01T17:30:00",
          area_abierta: false, termino: false, tolerancia_min: 5, con_codigo: true, productivo: null, productivo_area: null }] : [];
      else if (fn === "gt_admin_asistencia") out = b.p_pass === CLAVE_MON ? [
        { empleado: "Prueba", legajo: "t1", entrada: "2026-10-01T08:12:00", entrada_prevista: "2026-10-01T08:00:00", almuerzo_sale: null, almuerzo_vuelve: null,
          almuerzo_desde: "2026-10-01T12:00:00", almuerzo_hasta: "2026-10-01T13:00:00", flexible: false, fin: null, salida_prevista: "2026-10-01T17:30:00",
          area_abierta: true, termino: false, tolerancia_min: 5 },
        { empleado: "Otro", legajo: "t2", entrada: null, entrada_prevista: "2026-10-01T08:00:00", almuerzo_sale: null, almuerzo_vuelve: null,
          almuerzo_desde: "2026-10-01T12:00:00", almuerzo_hasta: "2026-10-01T13:00:00", flexible: false, fin: null, salida_prevista: "2026-10-01T17:30:00",
          area_abierta: false, termino: false, tolerancia_min: 5 }] : [];
      else if (fn === "gt_admin_pedidos") out = b.p_pass === CLAVE_MON ? [
        { id: 1, np: "TN 0001", pedido_ref: "29", cliente_cod: "1971", cliente: "Huang Chun Chieh", fecha: "2026-09-08T14:00:00Z", dias: 23, vence: "2026-09-22", vencido: true, estado: "abierto", es_super: false, cajas: 26, armadas: 0, pct_armado: 0, nota: null,
          items: [{ codigo: "134", descripcion: "Cuadro Mold 03 Nature", medida: "30*40", uxb: 16, cajas: 3, cajas_armadas: 0 }, { codigo: "183", descripcion: "Cuadro Mold 03 Ciudades", medida: "30*40", uxb: 16, cajas: 23, cajas_armadas: 0 }] },
        { id: 2, np: "TN 0002", pedido_ref: "30", cliente_cod: "2024", cliente: "Bazares y Mas S.A", fecha: "2026-09-09T14:00:00Z", dias: 22, vence: "2026-09-23", vencido: false, estado: "cargado", es_super: false, cajas: 11, armadas: 11, pct_armado: 100, nota: "salió con el flete",
          items: [{ codigo: "281", descripcion: "Multiple X6 Mold 012", medida: "10*10 + 10*15 + 13*18", uxb: 6, cajas: 11, cajas_armadas: 11 }] }] : [];
      else if (fn === "gt_admin_pedido_armar") { ARMAR.push(b); out = b.p_pass === CLAVE_MON ? { ok: true, estado: b.p_estado || "parcial" } : { ok: false, error: "clave" }; }
      else if (fn === "gt_contraido_pendiente") out = [{ codigo: "760", descripcion: "Otra", cajas: 12 }];
      else if (fn === "gt_registros_hoy2" || fn === "gt_registros_hoy3") out = db.concat(INGRESOS).filter((r) => r.empleado_id === b.p_empleado);
      else if (fn === "gt_pasos") out = PASOS;
      else if (fn === "gt_registrar") {
        const ok = [], rech = [];
        b.p_filas.forEach((f) => { if (f.opcion === "INGRESO") { if (!INGRESOS.find((x) => x.client_id === f.client_id)) INGRESOS.push(f); ok.push(f.client_id); }
          else if (f.opcion !== "FIN" && !AREAS2.find((a) => a.codigo === f.rubro)) rech.push({ client_id: f.client_id, motivo: "área inexistente" });
          else { if (!db.find((x) => x.client_id === f.client_id)) db.push(f); ok.push(f.client_id); } });
        out = { ok, rechazados: rech };
      }
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(out));
    }); return;
  }
  const f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]) === "/" ? "index.html" : decodeURIComponent(req.url.split("?")[0]));
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  let txt = fs.readFileSync(f);
  if (f.endsWith("config.js")) txt = Buffer.from(txt.toString().replace(/https:\/\/[a-z]+\.supabase\.co/, "http://localhost:" + srv.address().port));
  res.writeHead(200, { "Content-Type": f.endsWith(".js") ? "application/javascript" : f.endsWith(".css") ? "text/css" : "text/html" });
  res.end(txt);
});
const fallas = [];
const chk = (c, m) => { if (!c) fallas.push(m); console.log((c ? "✓ " : "✗ ") + m); };
srv.listen(0, async () => {
  const url = "http://localhost:" + srv.address().port + "/";
  const br = await pw.chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? undefined : undefined });
  const pg = await br.newPage({ viewport: { width: 390, height: 800 } });
  try {
    await pg.goto(url);
    await pg.fill("#claveInput", "9999"); await pg.click("#claveBtn");
    await pg.waitForFunction(() => document.getElementById("claveError").textContent.length > 0);
    chk(await pg.isVisible("#claveScreen"), "código equivocado no entra");
    await pg.fill("#claveInput", "1234"); await pg.click("#claveBtn");
    await pg.waitForSelector("#nombreLista button");
    chk((await pg.$$("#nombreLista button")).length === 3, "con el código bueno aparece la lista de nombres");
    // 1.49 (02/10: «quiero que confirmen que la persona es tal persona»): tocar el nombre pregunta «¿Sos …?»
    const sinIngreso = () => pg.evaluate(() => !JSON.parse(localStorage.getItem("gt_queue_v3") || "[]").some((x) => x.opcion === "INGRESO") && !localStorage.getItem("gt_sesion_v2"));
    await pg.click("#nombreLista button[data-id='7']"); await pg.waitForSelector("#avisoPop:not(.hidden)");
    chk((await pg.textContent("#avisoTit")) === "¿Sos Prueba?" && (await pg.textContent("#avisoBtns")).includes("Sí, soy Prueba"),
        "1.49: tocar el nombre no entra: pregunta «¿Sos Prueba?» con «Sí, soy Prueba»");
    await pg.click("#avisoBtns button[data-i='0']");   // enseguida, como el segundo toque de un doble toque
    await pg.waitForTimeout(100);
    chk(await pg.isVisible("#avisoPop") && await pg.isVisible("#nombreScreen") && await sinIngreso(), "1.49: un doble toque sobre el nombre no confirma solo");
    await pg.waitForTimeout(450); await pg.click("#avisoBtns button[data-i='1']");
    chk(!(await pg.isVisible("#avisoPop")) && await pg.isVisible("#nombreScreen") && await sinIngreso(),
        "1.49: «No, elegir otro nombre» vuelve a la lista sin entrar ni grabar el ingreso");
    await pg.click("#nombreLista button[data-id='7']"); await pg.waitForSelector("#avisoPop:not(.hidden)"); await pg.waitForTimeout(450);
    await pg.mouse.click(195, 20);
    chk(!(await pg.isVisible("#avisoPop")) && await pg.isVisible("#nombreScreen") && await sinIngreso(), "1.49: tocar afuera es «No»");
    await pg.click("#nombreLista button[data-id='7']"); await pg.waitForSelector("#avisoPop:not(.hidden)"); await pg.waitForTimeout(450);
    await pg.click("#avisoBtns button[data-i='0']");
    await pg.waitForSelector(".box[data-cod=CORTE]");
    chk((await pg.textContent("#opName")) === "Prueba", "entra con el nombre elegido");
    chk((await pg.$$(".box")).length === 9, "botonera = las áreas de Pellegrini (7 + Movimientos + Baño): las de Esnaola no aparecen");
    chk(!(await pg.$("#plantaBtn")), "la botonera no tiene «Cambiar de planta» (1.31)");
    const alDia = () => pg.waitForFunction(() => document.getElementById("syncBadge").textContent.includes("al día"));
    await alDia();
    chk(INGRESOS.length === 1 && INGRESOS[0].empleado_id === 7 && !INGRESOS[0].rubro && db.length === 0,
        "elegir el nombre después del código registra el INGRESO (1.33), aparte de las áreas");
    await pg.click(".box[data-cod=CORTE]"); await alDia();
    chk(db.length === 1 && db[0].opcion === "AREA" && db[0].rubro === "CORTE" && db[0].ts_inicio === null, "Empecé Corte: apertura con ts_inicio NULL");
    chk(db[0].planta === "PELL", "el evento lleva la planta (Pellegrini, la de siempre)");
    await pg.reload(); await pg.waitForSelector(".termine-btn[data-cod=CORTE]");
    chk(INGRESOS.length === 1, "al recargar, Corte sigue abierta (sesión del día + historial del servidor) y no se registra otro INGRESO");
    const termino = async (cod) => { await pg.click(".termine-btn[data-cod=" + cod + "]"); await pg.waitForSelector("#cantScreen:not(.hidden)"); };
    chk((await pg.$$("#botonera .box")).length === 0 && (await pg.$$("#botonera .termine-btn")).length === 1,
        "con un sector abierto, la botonera muestra SÓLO «Terminé» (no deja tocar otra área)");
    await termino("CORTE");
    chk((await pg.textContent("#cantLabel")).includes("unidades cortadas"), "«Terminé» pide cuánto hizo, en la unidad del área");
    await pg.fill("#cantInput", "abc"); await pg.click("#cambioBtn");
    chk((await pg.textContent("#cantError")).length > 0 && db.length === 1, "cantidad no numérica no se registra");
    await pg.fill("#cantInput", "120"); await pg.click("#cambioBtn"); await alDia();
    chk((await pg.$$("#botonera .box")).length === 9, "cerrado el sector, vuelven todas las áreas");
    await pg.click(".box[data-cod=GRAMP]"); await pg.waitForSelector("#codScreen:not(.hidden)");
    await pg.fill("#codInput", "999"); await pg.click("#codBtn");
    chk((await pg.textContent("#codError")).includes("¿Lo registro igual?") && db.length === 2, "código que no está en la lista: pregunta antes de grabar");
    chk(!(await pg.$("#codInput[list]")) && (await pg.getAttribute("#codInput", "inputmode")) === "numeric",
        "sin lista desplegable (no tapa el campo) y teclado numérico si los códigos son números");
    await pg.fill("#codInput", "0505");
    chk((await pg.textContent("#codHint")) === "Pinza · 10*15", "al tipear muestra qué es el código (Pinza · 10*15)");
    await pg.click("#codBtn"); await alDia();
    chk(db.length === 3 && db[1].rubro === "CORTE" && db[1].cantidad === 120 && db[1].ts_inicio === db[0].ts_cliente &&
        db[2].rubro === "GRAMP" && db[2].texto === "505" && db[2].ts_inicio === null,
        "Terminé Corte 120 y empezó Grampeado 505 («0505»)");
    chk((await pg.textContent("#abiertaBox")).includes("505"), "el área abierta muestra el código");
    await termino("GRAMP");
    chk((await pg.textContent("#sigueLabel")).includes("en Grampeado") && (await pg.textContent("#cantLabel")).includes("del 505"),
        "al terminar, por defecto propone seguir en la MISMA área");
    await pg.fill("#cantInput", "0"); await pg.fill("#sigueInput", "777"); await pg.click("#cantBtn");
    chk(db.length === 3 && (await pg.textContent("#sigueHint")).includes("No está en la lista"), "código nuevo: avisa y espera la confirmación");
    await pg.click("#cantBtn"); await alDia();
    chk(db.length === 5 && db[3].cantidad === 0 && db[3].texto === "505" && db[4].rubro === "GRAMP" && db[4].texto === "777" && !db[4].ts_inicio,
        "confirmado, registra el código nuevo y sigue en Grampeado");
    await termino("GRAMP"); await pg.fill("#cantInput", "4"); await pg.click("#cambioBtn"); await alDia();
    chk(db.length === 6 && db[5].cantidad === 4 && !(await pg.$(".box.abierta")), "«Cambiar de área / no sigo» cierra sin abrir otra");
    await pg.click(".box[data-cod=DECO]"); await alDia();
    chk(db.length === 7 && db[6].rubro === "DECO" && !(await pg.isVisible("#codScreen")), "un área sin código (Deco) empieza directo");
    await termino("DECO");
    chk(!(await pg.isVisible("#sigueInput")), "si el área no pide código, no muestra el campo de código siguiente");
    await pg.fill("#cantInput", "7"); await pg.click("#cambioBtn"); await alDia();
    await pg.click(".box[data-cod=PED]"); await alDia();
    await termino("PED");
    chk(!(await pg.isVisible("#cantInput")), "Pedidos no pregunta cantidad al terminar");
    await pg.click("#cambioBtn"); await alDia();
    chk(db.length === 10 && db[9].rubro === "PED" && db[9].ts_inicio && db[9].cantidad == null, "Pedidos se termina sin cantidad");
    await pg.click(".box[data-cod=GUARD]"); await pg.waitForSelector("#codScreen:not(.hidden)");
    await pg.waitForSelector("#codPend button[data-cod='760']");
    chk((await pg.textContent("#codPend")).includes("12 cajas"), "Guardado muestra lo que salió de Contraído (760 · 12 cajas)");
    await pg.fill("#codInput", "505"); await pg.click("#codBtn");
    chk((await pg.textContent("#codError")).includes("no salió de Contraído") && db.length === 10,
        "Guardado con un código que no salió de Contraído: avisa y pide confirmar");
    await pg.fill("#codInput", "");
    await pg.click("#codPend button[data-cod='760']"); await alDia();
    chk(db.length === 11 && db[10].rubro === "GUARD" && db[10].texto === "760", "tocar el pendiente empieza Guardado con ese código");
    await termino("GUARD"); await pg.waitForSelector("#siguePend button[data-cod='760']");
    chk(true, "al terminar Guardado, los pendientes de Contraído aparecen también para seguir");
    await pg.fill("#cantInput", "3"); await pg.click("#cambioBtn"); await alDia();
    await pg.click(".box[data-cod=RECIB]"); await alDia();
    const nR = db.length;
    chk(db[nR - 1].rubro === "RECIB" && !db[nR - 1].ts_inicio && !(await pg.isVisible("#codScreen")),
        "Recibir mercadería empieza directo, sin preguntar Insumo o Moldura (D29)");
    await termino("RECIB");
    chk(!(await pg.isVisible("#sigueBox")) && !(await pg.isVisible("#cantInput")) && (await pg.textContent("#cantBtn")) === "Listo",
        "al terminar Recibir no pregunta nada: sólo «Listo» (D30)");
    await pg.click("#cantBtn"); await alDia();
    chk(db.length === nR + 1 && db[nR].cantidad == null && db[nR].rubro === "RECIB" && db[nR].ts_inicio, "Terminé Recibir sin cantidad");
    // 1.28 (D31) / 1.33 (Elías): Movimientos desde la botonera pregunta qué está haciendo (respuesta libre); al terminar
    // se cierra y vuelve la botonera, sin proponer el área anterior
    await pg.click(".box[data-cod=MOVIM]"); await pg.waitForSelector("#pasoScreen:not(.hidden) #pasoTexto:not(.hidden)");
    chk((await pg.textContent("#pasoLabel")) === "¿Qué estás haciendo?", "Movimientos pregunta «¿Qué estás haciendo?» con un campo para escribir");
    await pg.click("#pasoBtn");
    chk((await pg.textContent("#pasoError")).length > 0 && await pg.isVisible("#pasoScreen"), "sin escribir nada no sigue");
    await pg.fill("#pasoTexto", "acomodar racks"); await pg.click("#pasoBtn"); await alDia();
    chk(db[db.length - 1].rubro === "MOVIM" && !db[db.length - 1].ts_inicio && db[db.length - 1].detalle && db[db.length - 1].detalle.que === "acomodar racks",
        "Empecé Movimientos con lo que escribió («acomodar racks») en el detalle");
    await pg.click(".termine-btn[data-cod=MOVIM]"); await alDia(); await pg.waitForSelector("#botonera .box");
    chk(db[db.length - 1].rubro === "MOVIM" && db[db.length - 1].ts_inicio && db[db.length - 1].cantidad == null && !(await pg.isVisible("#cantScreen")),
        "Terminé Movimientos (desde la botonera): se cierra sin preguntar nada y vuelve la botonera");
    // 1.31 / 1.33: Baño desde la botonera, lo mismo
    await pg.click(".box[data-cod=BANO]"); await alDia();
    chk(db[db.length - 1].rubro === "BANO" && !db[db.length - 1].ts_inicio && !(await pg.isVisible("#codScreen")), "Baño empieza directo, sin código");
    await pg.click(".termine-btn[data-cod=BANO]"); await alDia(); await pg.waitForSelector("#botonera .box");
    chk(db[db.length - 1].rubro === "BANO" && db[db.length - 1].ts_inicio && db[db.length - 1].cantidad == null, "Terminé Baño: cierre sin cantidad y vuelve la botonera");
    // 1.33 (Elías): con un área abierta, Baño y Movimiento son una PAUSA dentro del área: no la cierran
    await pg.click(".box[data-cod=CORTE]"); await alDia(); const nP = db.length;
    chk((await pg.$$(".pausa-btn")).length === 2, "con Corte abierto: «Terminé» y además Baño y Movimiento");
    await pg.click(".pausa-btn[data-pausa=BANO]"); await alDia();
    chk(db.length === nP + 1 && db[nP].rubro === "BANO" && !db[nP].ts_inicio && (await pg.textContent("#abiertaBox")).includes("Corte en pausa") &&
        (await pg.textContent(".termine-btn")).includes("Volví del baño"), "Baño con Corte abierto: Corte queda en pausa (no se cierra) y el botón es «Volví del baño»");
    await pg.click(".termine-btn[data-cod=BANO]"); await alDia(); await pg.waitForSelector(".termine-btn[data-cod=CORTE]");
    chk(db.length === nP + 2 && db[nP + 1].rubro === "BANO" && db[nP + 1].ts_inicio && (await pg.$$(".pausa-btn")).length === 2,
        "Volví del baño: sigue en Corte, sin preguntar nada");
    await pg.click(".pausa-btn[data-pausa=MOVIM]"); await pg.waitForSelector("#pasoScreen:not(.hidden) #pasoTexto:not(.hidden)");
    await pg.fill("#pasoTexto", "buscar tablas"); await pg.click("#pasoBtn"); await alDia();
    chk(db[nP + 2].rubro === "MOVIM" && db[nP + 2].detalle.que === "buscar tablas" && (await pg.textContent(".termine-btn")).includes("Terminé el movimiento"),
        "Movimiento con Corte abierto: pregunta qué está haciendo y Corte queda en pausa");
    await pg.click(".termine-btn[data-cod=MOVIM]"); await pg.waitForFunction(() => document.getElementById("pasoLabel").textContent.includes("¿Seguís con Corte"));
    chk((await pg.$$("#pasoOpts button")).length === 2, "Terminé el movimiento: «¿Seguís con Corte?» Sí / No");
    await pg.click("#pasoOpts button[data-val='Sí, sigo en Corte']"); await alDia(); await pg.waitForSelector(".termine-btn[data-cod=CORTE]");
    chk(db[nP + 3].rubro === "MOVIM" && db[nP + 3].ts_inicio && db.length === nP + 4, "Sí: cierra el movimiento y sigue en Corte");
    await pg.click(".pausa-btn[data-pausa=MOVIM]"); await pg.waitForSelector("#pasoTexto:not(.hidden)");
    await pg.fill("#pasoTexto", "llevar cajas"); await pg.click("#pasoBtn"); await alDia();
    await pg.click(".termine-btn[data-cod=MOVIM]"); await pg.waitForFunction(() => document.getElementById("pasoLabel").textContent.includes("¿Seguís con Corte"));
    await pg.click("#pasoOpts button[data-val='No, terminé Corte']"); await pg.waitForSelector("#cantScreen:not(.hidden)");
    chk(await pg.isVisible("#cantInput") && (await pg.textContent("#cantLabel")).includes("unidades cortadas"), "No: pide las cantidades de Corte");
    await pg.fill("#cantInput", "12"); await pg.click("#cantBtn"); await alDia(); await pg.waitForSelector("#botonera .box");
    const ult = db[db.length - 1];
    chk(ult.rubro === "CORTE" && ult.cantidad === 12 && ult.ts_inicio === db[nP - 1].ts_cliente && db[db.length - 2].rubro === "MOVIM" && db[db.length - 2].ts_inicio,
        "cierra el movimiento, cierra Corte con 12 y vuelve la botonera");
    chk(!(await pg.$(".box[data-cod=ALMU]")) && await pg.isVisible("#almuBtn") && await pg.isVisible("#finBtn"),
        "Almuerzo y Terminar día son botones aparte, no tarjetas de área");
    // almuerzo con un área abierta: cierra el área (cantidad) y empieza el almuerzo
    await pg.click(".box[data-cod=CORTE]"); await alDia();
    chk(!(await pg.isVisible("#almuBtn")) && !(await pg.isVisible("#finBtn")), "con un sector abierto no están Almuerzo ni Terminar día (D31)");
    await termino("CORTE");
    chk(await pg.isVisible("#cantAlmuBtn") && await pg.isVisible("#cantFinBtn"), "«Terminé» ofrece «Me voy a almorzar» y «Terminé el día»");
    await pg.fill("#cantInput", "50"); await pg.click("#cantAlmuBtn"); await alDia();
    const nA = db.length;
    chk(db[nA - 1].rubro === "ALMU" && !db[nA - 1].ts_inicio && db[nA - 2].rubro === "CORTE" && db[nA - 2].cantidad === 50, "cerró Corte con 50 y empezó el almuerzo");
    chk((await pg.textContent("#almuBtn")).includes("Volví"), "el botón pasa a «Volví de almorzar»");
    await pg.click("#almuBtn"); await pg.waitForSelector("#cantScreen:not(.hidden)");
    chk(!(await pg.isVisible("#cantInput")) && (await pg.textContent("#sigueLabel")).includes("Corte"), "al volver, no pide cantidad y propone seguir en Corte (el área de antes)");
    await pg.click("#cantBtn"); await alDia();
    chk(db[db.length - 2].rubro === "ALMU" && db[db.length - 2].ts_inicio && db[db.length - 1].rubro === "CORTE", "volvió de almorzar y siguió en Corte");
    // terminar el día con Corte abierto
    await termino("CORTE");
    await pg.fill("#cantInput", "30"); await pg.click("#cantFinBtn"); await alDia();
    chk(db[db.length - 1].opcion === "FIN" && db[db.length - 2].rubro === "CORTE" && db[db.length - 2].cantidad === 30, "cerró Corte y registró el fin del día");
    await pg.waitForSelector("#claveScreen:not(.hidden)");
    chk(!(await pg.evaluate(() => localStorage.getItem("gt_sesion_v2"))), "al terminar el día vuelve a la pantalla del código de la TV (sin sesión)");
    await pg.fill("#claveInput", "1234"); await pg.click("#claveBtn");
    await pg.waitForSelector("#nombreLista button[data-id='7']"); await pg.click("#nombreLista button[data-id='7']"); await pg.waitForSelector("#avisoPop:not(.hidden)"); await pg.waitForTimeout(450); await pg.click("#avisoBtns button[data-i='0']");   // 1.49: «¿Sos …?» Sí
    await pg.waitForSelector("#optionsScreen:not(.hidden)");
    const vioFin = await pg.waitForFunction(() => document.getElementById("abiertaBox").textContent.includes("Día terminado"), null, { timeout: 5000 }).then(() => true, () => false);
    chk(vioFin, "si vuelve a entrar, la botonera muestra «Día terminado»");
    await pg.waitForTimeout(300);
    chk(REING.length === 1 && REING[0] === 7, "volver a entrar después de terminar el día avisa (gt_reingreso)");
    await pg.evaluate(() => { const q = JSON.parse(localStorage.getItem("gt_queue_v3") || "[]");
      q.push({ client_id: "malo", empleado_id: 7, opcion: "AREA", rubro: "NOEXISTE", ts_cliente: new Date().toISOString() });
      localStorage.setItem("gt_queue_v3", JSON.stringify(q)); return window.__gt.flush(); });
    const q = await pg.evaluate(() => [JSON.parse(localStorage.getItem("gt_queue_v3")).length, JSON.parse(localStorage.getItem("gt_rechazados_v3")).length]);
    chk(q[0] === 0 && q[1] === 1, "fila rechazada sale de la cola y queda anotada (no traba)");
    await pg.click("#histBtn");
    const nh = (await pg.$$("#hist .hist-row")).length; chk(nh === 17, "resumen de hoy con 16 tramos (Movimientos, Baño y las pausas dentro de Corte) + fin del día (" + nh + ")");
    chk(await pg.isVisible("#histPop") && await pg.evaluate(() => getComputedStyle(document.getElementById("histPop")).position === "fixed"),
        "el Resumen de hoy se abre como pop-up (no se despliega abajo)");
    await pg.click("#histCerrar"); chk(!(await pg.isVisible("#histPop")), "el ✕ cierra el pop-up");
    chk(db.every((r) => r.empleado_id === 7), "los registros llevan el empleado_id");
    chk(await pg.evaluate(() => window.__gt.verNum("1.10") > window.__gt.verNum("1.9") && window.__gt.verNum("2.0") > window.__gt.verNum("1.99")),
        "versiones: 1.10 es más nueva que 1.9, y 2.0 que 1.99");
    // 1.17: set de 3 en Montaje → pregunta la medida; al seguir con el mismo set, la vuelve a preguntar
    await pg.click(".box[data-cod=MONT]"); await pg.waitForSelector("#codScreen:not(.hidden)");
    await pg.fill("#codInput", "136"); await pg.click("#codBtn"); await pg.waitForSelector("#medScreen:not(.hidden)");
    chk((await pg.textContent("#medLabel")) === "¿Qué medida vas a montar?" && (await pg.$$("#medOpts button")).length === 3,
        "set de 3 en Montaje: pregunta qué medida va a montar (3 botones)");
    await pg.click("#medOpts button[data-med='30*40']"); await alDia();
    let nM = db.length;
    chk(db[nM - 1].rubro === "MONT" && db[nM - 1].texto === "136" && db[nM - 1].medida === "30*40", "empezó Montaje 136 en la medida 30*40");
    await termino("MONT"); await pg.fill("#cantInput", "5"); await pg.fill("#sigueInput", "136"); await pg.click("#cantBtn");
    await pg.waitForSelector("#medScreen:not(.hidden)"); await pg.click("#medOpts button[data-med='20*30']"); await alDia();
    chk(db[nM].cantidad === 5 && db[nM].medida === "30*40" && db[nM + 1].medida === "20*30" && !db[nM + 1].ts_inicio,
        "cerró 30*40 con 5 y siguió con el mismo set en 20*30");
    await termino("MONT"); await pg.fill("#cantInput", "2"); await pg.click("#cambioBtn"); await alDia();
    // 1.22: Darío trabaja en dos plantas → al entrar elige; en Esnaola la botonera es Moldurado / Lijado / Pintado
    const ctx2 = await br.newContext({ viewport: { width: 390, height: 800 } }); const p2 = await ctx2.newPage();
    await p2.goto(url); await p2.fill("#claveInput", "1234"); await p2.click("#claveBtn");
    await p2.waitForSelector("#nombreLista button[data-id='6']"); await p2.click("#nombreLista button[data-id='6']"); await p2.waitForSelector("#avisoPop:not(.hidden)"); await p2.waitForTimeout(450); await p2.click("#avisoBtns button[data-i='0']");   // 1.49: «¿Sos …?» Sí
    await p2.waitForSelector("#plantaScreen:not(.hidden)");
    chk((await p2.$$("#plantaOpts button")).length === 2 && (await p2.textContent("#plantaScreen")).includes("¿En qué planta trabajás hoy?"),
        "Darío (dos plantas): lo primero que pregunta es en qué planta trabaja (Pellegrini o Esnaola)");
    await p2.click("#plantaOpts button[data-planta='ESNA']"); await p2.waitForSelector(".box[data-cod=MOLDU]");
    await p2.waitForFunction(() => document.getElementById("syncBadge").textContent.includes("al día"));
    const cods = await p2.$$eval("#botonera .box", (bs) => bs.map((b) => b.dataset.cod).join(","));
    chk(cods === "MOLDU,LIJA,PINT,MOVIM,BANO" && (await p2.textContent("#opName")) === "Dario Mendez · Esnaola", "en Esnaola: Moldurado, Lijado, Pintado, Movimientos y Baño (en todas las plantas), y nada de Pellegrini");
    const n0 = db.length;
    const sync2 = () => p2.waitForFunction(() => document.getElementById("syncBadge").textContent.includes("al día"));
    const paso = async (val) => { await p2.waitForSelector("#pasoScreen:not(.hidden) #pasoOpts button[data-val='" + val + "']"); await p2.click("#pasoOpts button[data-val='" + val + "']"); };
    const termino2 = async (cod) => { await p2.click(".termine-btn[data-cod=" + cod + "]"); await p2.waitForSelector("#cantScreen:not(.hidden)"); };
    // 1.24: Moldurado pregunta la moldura (las de Corte) al empezar y los metros al terminar
    await p2.click(".box[data-cod=MOLDU]"); await p2.waitForSelector("#pasoScreen:not(.hidden)");
    chk((await p2.textContent("#pasoLabel")) === "¿Qué moldura vas a hacer?" && (await p2.$$("#pasoOpts button")).length === 3,
        "Empecé Moldurado: pregunta qué moldura, con las molduras de Corte como botones");
    await p2.click("#pasoVolver"); await p2.waitForSelector("#optionsScreen:not(.hidden)");
    chk(db.length === n0, "‹ en la primera pregunta cancela sin registrar nada");
    await p2.click(".box[data-cod=MOLDU]"); await paso("012"); await sync2();
    chk(db.length === n0 + 1 && db[n0].rubro === "MOLDU" && db[n0].texto === "012" && db[n0].planta === "ESNA" && db[n0].empleado_id === 6 && !db[n0].detalle,
        "Empecé Moldurado 012: el evento lleva la moldura y la planta Esnaola");
    chk((await p2.textContent("#abiertaBox")).includes("012"), "el área abierta muestra la moldura");
    await termino2("MOLDU");
    chk((await p2.textContent("#cantLabel")) === "¿Cuántos metros de moldura 012?" && (await p2.textContent("#sigueLabel")).includes("Moldurado"),
        "Terminé Moldurado: pide los metros de la moldura y propone seguir en Moldurado");
    await p2.fill("#cantInput", "35"); await p2.click("#cantBtn"); await p2.waitForSelector("#pasoScreen:not(.hidden)");
    chk(db[n0 + 1].cantidad === 35 && db[n0 + 1].texto === "012" && db[n0 + 1].ts_inicio === db[n0].ts_cliente,
        "cerró Moldurado 012 con 35 metros ANTES de preguntar la moldura siguiente");
    await paso("05"); await sync2();
    chk(db[n0 + 2].rubro === "MOLDU" && db[n0 + 2].texto === "05" && !db[n0 + 2].ts_inicio, "siguió en Moldurado con la moldura 05");
    await termino2("MOLDU"); await p2.fill("#cantInput", "10"); await p2.click("#cambioBtn"); await sync2();
    // Lijado: moldura, anilina y —sólo si es Sí— el color
    const n1 = db.length;
    await p2.click(".box[data-cod=LIJA]"); await paso("012");
    await p2.waitForFunction(() => document.getElementById("pasoLabel").textContent === "¿Le ponés anilina?");
    chk((await p2.textContent("#pasoResp")) === "Moldura 012", "Lijado: después de la moldura pregunta la anilina (y muestra lo ya elegido)");
    await p2.click("#pasoVolver"); await p2.waitForFunction(() => document.getElementById("pasoLabel").textContent === "¿Qué moldura vas a lijar?");
    chk(await p2.isHidden("#pasoResp"), "‹ vuelve a la pregunta anterior");
    await paso("012"); await paso("Sí");
    await p2.waitForFunction(() => document.getElementById("pasoLabel").textContent === "¿De qué color es la anilina?");
    chk((await p2.$$("#pasoOpts button")).length === 4 && (await p2.textContent("#pasoResp")) === "Moldura 012 · con anilina", "con anilina pregunta el color (4)");
    await paso("Cedro"); await sync2();
    chk(db.length === n1 + 1 && db[n1].rubro === "LIJA" && db[n1].texto === "012" && db[n1].detalle && db[n1].detalle.anilina === "Sí" && db[n1].detalle.color === "Cedro",
        "Empecé Lijado 012 con anilina Cedro (detalle)");
    chk((await p2.textContent("#abiertaBox")).includes("012 · anilina Cedro"), "el área abierta dice «012 · anilina Cedro»");
    await termino2("LIJA");
    chk((await p2.textContent("#cantTitulo")).includes("anilina Cedro") && (await p2.textContent("#cantLabel")) === "¿Cuántos metros de moldura 012?",
        "Terminé Lijado: muestra la anilina y pide los metros");
    await p2.fill("#cantInput", "20"); await p2.click("#cambioBtn"); await sync2();
    chk(db[n1 + 1].cantidad === 20 && db[n1 + 1].detalle && db[n1 + 1].detalle.color === "Cedro" && db[n1 + 1].ts_inicio, "el cierre lleva los metros y el detalle de la apertura");
    await p2.click(".box[data-cod=LIJA]"); await paso("03"); await paso("No"); await sync2();
    chk(db[n1 + 2].texto === "03" && db[n1 + 2].detalle && db[n1 + 2].detalle.anilina === "No" && !db[n1 + 2].detalle.color, "sin anilina no pregunta el color");
    await termino2("LIJA"); await p2.fill("#cantInput", "5"); await p2.click("#cambioBtn"); await sync2();
    // Pintado: color y moldura; el paso «al terminar» va antes de la pantalla de cierre
    const n2 = db.length;
    await p2.click(".box[data-cod=PINT]"); await p2.waitForFunction(() => document.getElementById("pasoLabel").textContent === "¿De qué color vas a pintar?");
    await paso("Negro"); await paso("03"); await sync2();
    chk(db[n2].rubro === "PINT" && db[n2].texto === "03" && db[n2].detalle && db[n2].detalle.color === "Negro", "Empecé Pintado: color Negro y moldura 03");
    await p2.click(".termine-btn[data-cod=PINT]"); await p2.waitForFunction(() => document.getElementById("pasoLabel").textContent === "¿Cuántas manos?");
    await paso("2"); await p2.waitForSelector("#cantScreen:not(.hidden)");
    chk((await p2.textContent("#cantLabel")) === "¿Cuántos paquetes de moldura 03?", "Terminé Pintado: pide los PAQUETES de la moldura (D8)");
    await p2.fill("#cantInput", "4"); await p2.click("#cambioBtn"); await sync2();
    chk(db[n2 + 1].ts_inicio && db[n2 + 1].cantidad === 4 && db[n2 + 1].detalle && db[n2 + 1].detalle.color === "Negro" && db[n2 + 1].detalle.manos === "2",
        "cierre de Pintado con 4 paquetes; la pregunta del momento «terminar» se suma al detalle");
    await p2.click("#histBtn");
    chk((await p2.textContent("#hist")).includes("Lijado · 012 · anilina Cedro"), "el resumen del día muestra moldura y anilina");
    await p2.click("#histCerrar");
    await p2.reload(); await p2.waitForSelector(".box[data-cod=LIJA]");
    chk(true, "al recargar sigue en Esnaola (la planta queda en la sesión del día)");
    // 1.31: sin «Cambiar de planta», se cambia saliendo (‹) y volviendo a entrar con el código
    await p2.click("#salirBtn"); await p2.waitForSelector("#claveScreen:not(.hidden)");
    await p2.fill("#claveInput", "1234"); await p2.click("#claveBtn");
    await p2.waitForSelector("#nombreLista button[data-id='6']"); await p2.click("#nombreLista button[data-id='6']"); await p2.waitForSelector("#avisoPop:not(.hidden)"); await p2.waitForTimeout(450); await p2.click("#avisoBtns button[data-i='0']");   // 1.49: «¿Sos …?» Sí
    await p2.click("#plantaOpts button[data-planta='PELL']"); await p2.waitForSelector(".box[data-cod=CORTE]");
    chk((await p2.$$("#botonera .box")).length === 9 && (await p2.textContent("#opName")) === "Dario Mendez · Pellegrini",
        "saliendo y volviendo a entrar pasa a Pellegrini con su botonera");
    // 1.26 (D15): Corte pregunta al terminar si se terminó el paquete de moldura (paso «terminar» de la base)
    PASOS.push({ rubro: "CORTE", orden: 1, campo: "paquete", pregunta: "¿Terminaste el paquete de moldura?", opciones: ["Sí", "No"], momento: "terminar" });
    await p2.reload(); await p2.waitForSelector(".box[data-cod=CORTE]");
    const n3 = db.length;
    await p2.click(".box[data-cod=CORTE]"); await sync2();
    await p2.click(".termine-btn[data-cod=CORTE]"); await p2.waitForFunction(() => document.getElementById("pasoLabel").textContent === "¿Terminaste el paquete de moldura?");
    await paso("Sí"); await p2.waitForSelector("#cantScreen:not(.hidden)");
    await p2.fill("#cantInput", "40"); await p2.click("#cambioBtn"); await sync2();
    chk(db[n3 + 1].rubro === "CORTE" && db[n3 + 1].ts_inicio && db[n3 + 1].cantidad === 40 && db[n3 + 1].detalle && db[n3 + 1].detalle.paquete === "Sí",
        "Terminé Corte: pregunta si se terminó el paquete y lo guarda en el detalle (D15)");
    await ctx2.close();
    const ad = await br.newPage({ viewport: { width: 1280, height: 720 } });
    await ad.goto(url + "admin.html");
    await ad.waitForFunction(() => document.getElementById("clave").textContent === "1234");
    chk(true, "sin clave configurada en la base, el monitor muestra el código (como antes)");
    CLAVE_MON = "151515"; await ad.reload();
    await ad.waitForSelector("#login:not(.hidden)");
    chk(!(await ad.isVisible("#monitor")), "monitor sin clave no muestra el código");
    await ad.fill("#passInput", "111111"); await ad.click("#passBtn");
    await ad.waitForFunction(() => document.getElementById("passError").textContent.length > 0);
    chk((await ad.textContent("#clave")) !== "1234", "clave equivocada no muestra el código");
    await ad.fill("#passInput", "151515"); await ad.click("#passBtn");
    await ad.waitForFunction(() => document.getElementById("clave").textContent === "1234");
    await ad.reload(); await ad.waitForFunction(() => document.getElementById("clave").textContent === "1234");
    chk(true, "con la clave buena muestra el código y la recuerda al recargar");
    chk(LOGINS.length === 2 && LOGINS[1].p_dispositivo && LOGINS[1].p_navegador,
        "cada clave TIPEADA pasa por gt_monitor_login con el equipo (la lectura de cada minuto no cuenta)");
    // la clave guardada vence el lunes 07:00: una guardada hace 8 días ya no vale
    await ad.evaluate(() => localStorage.setItem("gt_monitor_pass_ts", String(Date.now() - 8 * 864e5)));
    await ad.reload(); await ad.waitForSelector("#login:not(.hidden)");
    chk((await ad.textContent("#passError")).includes("lunes"), "clave guardada antes del último lunes 07:00 vence y la pide de nuevo");
    await ad.fill("#passInput", "151515"); await ad.click("#passBtn");
    await ad.waitForFunction(() => document.getElementById("clave").textContent === "1234");
    await ad.waitForFunction(() => document.getElementById("seg").textContent !== "--");
    const seg = Number(await ad.textContent("#seg"));
    chk(seg > 0 && seg <= 42, "monitor admin muestra el código y la cuenta regresiva (" + seg + " s)");
    await ad.click(".tab[data-tab=prod]"); await ad.waitForSelector("#prodArea table");
    chk((await ad.textContent("#prodArea")).includes("240") && (await ad.textContent("#prodOp")).includes("en curso"),
        "Producción: por área con unidades (10 cajas × 24 = 240) y lo en curso");
    chk((await ad.textContent("#prodOp")).includes("cerrado solo"), "el tramo que cerró el sistema se marca «🔒 cerrado solo» (D34)");
    chk((await ad.textContent("#prodOp")).includes("MDF · 30*40"), "Por operario muestra la familia del tramo (1.32, gt_admin_produccion3)");
    chk((await ad.textContent("#prodOp")).includes("0:25") && (await ad.textContent("#prodOp")).includes("−0:35 pausa"),
        "encolado de 11:00 a 12:00 con baño de 15 y movimiento de 20 (con 5 de baño adentro): 0:25, −0:35 de pausa (1.33 / 1.36)");
    chk((await ad.textContent("#prodOp")).includes("−0:05 pausa"), "el movimiento descuenta el baño que tuvo adentro (0:15, −0:05 de pausa)");
    await ad.selectOption("#fOper", "Otro");
    chk(!(await ad.textContent("#prodOp")).includes("Prueba") && (await ad.textContent("#prodOp")).includes("Otro") && !(await ad.textContent("#prodArea")).includes("240"),
        "filtro por operario (1.33): sólo Otro, en Por operario y en Por área");
    await ad.selectOption("#fOper", ""); await ad.selectOption("#fFam", "MDF · 30*40");
    chk((await ad.textContent("#prodOp")).includes("Encolado") && !(await ad.textContent("#prodOp")).includes("Corte"), "filtro por familia: sólo los tramos de MDF · 30*40");
    await ad.selectOption("#fFam", ""); await ad.selectOption("#fArea", "Corte");
    chk(!(await ad.textContent("#prodOp")).includes("Encolado") && (await ad.textContent("#prodArea")).includes("Corte"), "filtro por área: sólo Corte");
    await ad.selectOption("#fArea", "");
    await ad.waitForFunction(() => document.getElementById("prodRitmo").textContent.includes("-40 %"));
    chk((await ad.textContent("#prodRitmo")).includes("Mold 03 · 30*40"), "Ritmo: 240 u/h contra 400 del GRUPO (Mold 03 · 30*40) = -40 %");
    // 1.32 (Elías): el día del encolado de 43 s del 173 — el ritmo vacío explica por qué, y la familia sale igual
    SOLO_CORTO = true; await ad.click("#prodRef");
    await ad.waitForFunction(() => document.getElementById("prodRitmo").textContent.includes("2 min"));
    chk((await ad.textContent("#prodRitmo")).includes("el que hubo duró menos") && (await ad.textContent("#prodOp")).includes("Mold 03 · 10*30"),
        "un día con sólo un tramo corto: el ritmo dice que no cuenta los de menos de 2 min, y Por operario muestra la familia Mold 03 · 10*30");
    SOLO_CORTO = false;
    await ad.click(".tab[data-tab=asis]"); await ad.fill("#asisDia", "2026-09-30"); await ad.dispatchEvent("#asisDia", "change");
    await ad.waitForFunction(() => document.getElementById("asisTabla").textContent.includes("No terminó"));
    const asis = await ad.textContent("#asisTabla");
    chk(asis.includes("Llegó tarde") && asis.includes("No vino") && asis.includes("Sin almuerzo") && asis.includes("No terminó el día"),
        "Asistencia: llegó tarde, no vino, sin almuerzo y no terminó el día");
    chk(asis.includes("Arrancó 30 min tarde") && asis.includes("Sin trabajo productivo") && asis.includes("07:42"),
        "Asistencia (1.33): ingreso y 1.er trabajo por separado · arrancó 30 min tarde · ingresó a las 07:42 (desayuno) y no trabajó");
    // 1.37 (Elías): Rendimiento — una tabla por área, filas = variable, columnas = operarios, celda = segundos por unidad
    await ad.click(".tab[data-tab=rend]"); await ad.waitForSelector("#rendTablas table");
    const rend = await ad.textContent("#rendTablas");
    chk(rend.includes("Encolado") && rend.includes("10*30") && rend.includes("2,5") && rend.includes("4,0") && rend.includes("36,0"),
        "Rendimiento: Encolado 10*30 (Prueba 2,5 · Otro 4,0 s por unidad) y Corte Mold 03 (36,0 s por pieza)");
    chk((await ad.textContent("#rendTablas td.bueno")) === "2,5" && (await ad.textContent("#rendTablas td.malo")) === "4,0",
        "más rápido que el promedio de la fila en verde, más lento en rojo (± 20 %)");
    chk((await ad.$$eval("#rendTablas td.poco", (ts) => ts.map((t) => t.textContent))).join(",") === "15,6,15,6" && !rend.includes("0:03"),
        "con menos de 15 min el número sale igual (15,6 s por unidad), en gris, no el tiempo acumulado (1.38)");
    chk(/Sin tramos de 2 min.*Grampeado, Montaje, Gancho, Emblistado, Contraído/.test(rend) && (await ad.$$("#rendTablas .bloque")).length === 2,
        "las áreas sin datos van juntas en una línea, sin bloques vacíos (Corte y Encolado tienen tabla)");
    chk(rend.includes("Moldura · largo") && rend.includes("Mold 03 · 25 cm"), "Corte: la fila es moldura + largo de la pieza («Mold 03 · 25 cm», gt_v156)");
    chk(rend.includes("las unidades se reparten según el tiempo de cada uno") && !rend.includes("cada uno con lo suyo"),
        "Encolado de a dos: dice que la pareja se reparte las unidades según el tiempo de cada uno (gt_v153)");
    if (process.env.FOTO) await ad.screenshot({ path: process.env.FOTO, fullPage: true });
    // D29: Pedidos, por ahora sólo desde el admin
    await ad.click(".tab[data-tab=ped]"); await ad.waitForSelector("#pedLista .bloque");
    chk((await ad.$$("#pedLista .bloque")).length === 2 && (await ad.textContent("#pedLista")).includes("VENCIDO") && (await ad.textContent("#pedInfo")).includes("1 por armar"),
        "Pedidos (D29): los pedidos de TN con su estado, el vencido marcado y cuántos faltan armar");
    chk((await ad.$$('#pedLista .bloque[data-id="1"] input.arm')).length === 2 && (await ad.$$('#pedLista .bloque[data-id="2"] input.arm')).length === 0,
        "el armado se edita sólo en el pedido abierto: el cargado no tiene campos");
    await ad.fill('#pedLista .bloque[data-id="1"] input.arm[data-cod="134"]', "3"); await ad.click('#pedLista .bloque[data-id="1"] button[data-acc=guardar]');
    for (let i = 0; i < 30 && ARMAR.length < 1; i++) await ad.waitForTimeout(100);
    chk(ARMAR.length === 1 && ARMAR[0].p_pedido_id === 1 && ARMAR[0].p_estado === null && ARMAR[0].p_items.find((i) => i.codigo === "134").cajas_armadas === 3 && ARMAR[0].p_items.length === 2,
        "«Guardar armado» manda las cajas armadas por renglón (134 → 3) y deja que la base decida el estado");
    await ad.waitForFunction(() => document.getElementById("pedMsg1") && document.getElementById("pedMsg1").textContent === "");
    await ad.click('#pedLista .bloque[data-id="2"] button[data-acc=entregado]');
    for (let i = 0; i < 30 && ARMAR.length < 2; i++) await ad.waitForTimeout(100);
    chk(ARMAR.length === 2 && ARMAR[1].p_pedido_id === 2 && ARMAR[1].p_estado === "entregado" && ARMAR[1].p_items === null,
        "«Entregado» manda sólo el estado: el pedido cargado no reenvía armado");
    await ad.click("#salirMon"); await ad.click(".tab[data-tab=prod]"); await ad.waitForTimeout(800); await ad.waitForSelector("#login:not(.hidden)");
    chk(!(await ad.isVisible("#prod")), "sin clave, Producción no muestra datos y pide la clave");
  } catch (e) { fallas.push(String(e)); console.log("✗", e.message); }
  await br.close(); srv.close();
  console.log(fallas.length ? "ROJO: " + fallas.length : "VERDE");
  process.exit(fallas.length ? 1 : 0);
});

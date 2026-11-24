// 1.74 (24/11/2026): «↩ Me equivoqué». Ximena cargó en Encolado el 3079 (es de Deco) y para salir tuvo que cerrarlo con 0 y
// abrir Deco. Pedido: «permití ir para atrás cuando se equivocan, hasta 5 minutos después de haberlo ingresado».
// Uso: node tests/deshacer.cjs   (necesita playwright)
const path = require("path"), http = require("http"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch { pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright"); }
const ROOT = path.join(__dirname, "..");
const A = (codigo, nombre, orden, x) => Object.assign({ codigo, nombre, unidad: "cajas encoladas", orden, planta: "PELL", pide_codigo: false, pide_cantidad: true }, x || {});
const AREAS = [A("ENCOL", "Encolado", 3), A("DECO", "Deco", 9, { unidad: "unidades fabricadas" }), A("CORTE", "Corte", 1),
               A("BANO", "Baño", 31, { pide_cantidad: false }), A("MOVIM", "Movimientos", 30, { pide_cantidad: false })];
let confirma = false, mandado = [];
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.split("/").pop(), b = body ? JSON.parse(body) : {};
      if (fn === "gt_registrar") mandado = mandado.concat(b.p_filas || []);
      const out = fn === "gt_clave_validar" ? { ok: true, principal: "PELL", empleados: [{ id: 7, nombre: "Ximena Ortiz", plantas: [] }] }
        : fn.startsWith("gt_botones") ? AREAS
        : fn === "gt_registrar" ? { ok: confirma ? (b.p_filas || []).map((x) => x.client_id) : [], rechazados: [] } : [];
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
  const entrar = async (vp) => {
    const p = await br.newPage({ viewport: vp || { width: 390, height: 664 } });
    await p.goto(url); await p.fill("#claveInput", "1234"); await p.click("#claveBtn");
    await p.click("#nombreLista button[data-id='7']"); await p.waitForSelector("#avisoPop:not(.hidden)"); await p.waitForTimeout(450);
    await p.click("#avisoBtns button[data-i='0']"); await p.waitForSelector(".box[data-cod=ENCOL]");
    return p;
  };
  // carga eventos en la cola (seg = segundos antes de ahora) y recarga
  const cargar = async (p, evs) => {
    await p.evaluate((evs) => {
      const ya = Date.now(), t = (s) => new Date(ya - s * 1000).toISOString();
      const q = JSON.parse(localStorage.getItem("gt_queue_v3") || "[]");
      evs.forEach(([id, rubro, seg, ini, x]) => q.push(Object.assign({ client_id: id, empleado_id: 7, opcion: "AREA", rubro, descripcion: rubro, texto: "",
        cantidad: null, ts_cliente: t(seg), ts_inicio: ini == null ? null : t(ini), dispositivo: "prueba", planta: "PELL" }, x || {})));
      localStorage.setItem("gt_queue_v3", JSON.stringify(q));
    }, evs);
    await p.reload();
  };
  const colaIds = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("gt_queue_v3") || "[]").filter((x) => x.opcion !== "INGRESO").map((x) => x.opcion === "DESHACER" ? "DESHACER:" + x.detalle.anula.join("+") : x.client_id).join(","));
  try {
    // a) el caso de Ximena, por la pantalla: Encolado 348 desde hace 9 min → Terminé con 1 → «Terminar y seguir en Encolado»
    //    (tenía que ser Deco) → «↩ Me equivoqué» → «Sólo Empecé» → queda sin nada abierto, el 348 terminado con 1, y va a Deco
    const pa = await entrar();
    await cargar(pa, [["e1", "ENCOL", 540, null, { texto: "348" }]]);
    await pa.waitForSelector(".termine-btn[data-cod=ENCOL]");
    chk(await pa.isHidden("#deshBtn"), "Encolado abierto hace 9 min: no hay «Me equivoqué» (pasaron más de 5 min)");
    await pa.click(".termine-btn[data-cod=ENCOL]"); await pa.waitForSelector("#cantScreen:not(.hidden)");
    await pa.fill("#cantInput", "1"); await pa.click("#cantBtn");
    await pa.waitForSelector(".termine-btn[data-cod=ENCOL]"); await pa.waitForSelector("#deshBtn:not(.hidden)");
    const txtBtn = (await pa.textContent("#deshBtn")).replace(/\s+/g, " ").trim();
    chk(/Me equivoqué 4:5\d|Me equivoqué 5:00/.test(txtBtn), "terminó y siguió en Encolado: aparece «↩ Me equivoqué» con la cuenta de 5 min (" + txtBtn + ")");
    await pa.click("#deshBtn"); await pa.waitForSelector("#avisoPop:not(.hidden)");
    const pop = (await pa.textContent("#avisoPop")).replace(/\s+/g, " ");
    chk(/Terminé Encolado · 348 \(1\)/.test(pop) && /Empecé Encolado/.test(pop) && /Sólo «Empecé Encolado»/.test(pop) && /Todo, también el «Terminé»/.test(pop),
        "el aviso muestra el cierre y la apertura, y ofrece «Sólo Empecé» y «Todo»");
    await pa.click("#avisoBtns button[data-i='0']"); await pa.waitForSelector("#botonera .box[data-cod=DECO]");
    chk(await pa.isHidden("#abiertaBox"), "«Sólo Empecé»: no queda nada abierto, vuelve la botonera");
    const qa = await colaIds(pa);
    chk(/^e1,[^,]+,DESHACER:[^,+]+$/.test(qa), "la apertura sin enviar sale de la cola, el cierre queda y se agrega el DESHACER (" + qa + ")");
    await pa.click("#histBtn"); await pa.waitForSelector("#histPop:not(.hidden)");
    const hist = (await pa.textContent("#hist")).replace(/\s+/g, " ");
    chk(/348/.test(hist) && !/en curso/.test(hist), "Resumen de hoy: Encolado 348 terminado, sin la apertura deshecha (" + hist.trim() + ")");
    await pa.click("#histPop"); await pa.keyboard.press("Escape");
    const txt2 = (await pa.textContent("#deshBtn")).replace(/\s+/g, " ");
    chk(!(await pa.isHidden("#deshBtn")), "se puede seguir volviendo atrás: ahora ofrece deshacer el «Terminé Encolado» (" + txt2.trim() + ")");
    await pa.close();

    // b) «Todo»: el cierre también se deshace y Encolado 348 vuelve a quedar abierto desde su hora original
    const pb = await entrar();
    await cargar(pb, [["e1", "ENCOL", 540, null, { texto: "348" }], ["c1", "ENCOL", 30, 540, { texto: "348", cantidad: 1 }], ["o2", "ENCOL", 29.999, null, { texto: "3079" }]]);
    await pb.waitForSelector("#deshBtn:not(.hidden)");
    await pb.click("#deshBtn"); await pb.waitForSelector("#avisoPop:not(.hidden)"); await pb.click("#avisoBtns button[data-i='1']");
    await pb.waitForSelector(".termine-btn[data-cod=ENCOL]");
    const ab = (await pb.textContent("#abiertaBox")).replace(/\s+/g, " ");
    chk(/348/.test(ab) && !/3079/.test(ab), "«Todo»: Encolado 348 vuelve a estar abierto (" + ab.trim() + ")");
    const qb = await colaIds(pb);
    chk(qb === "e1,DESHACER:c1+o2", "salen de la cola el cierre y la apertura, y va el DESHACER de los dos (" + qb + ")");
    await pb.close();

    // c) una pausa: Baño dentro de Encolado tocado sin querer → se deshace y Encolado sigue (sin pausa)
    const pc = await entrar();
    await cargar(pc, [["e1", "ENCOL", 600, null, { texto: "137" }], ["b1", "BANO", 20, null]]);
    await pc.waitForSelector("#deshBtn:not(.hidden)");
    await pc.click("#deshBtn"); await pc.waitForSelector("#avisoPop:not(.hidden)");
    chk((await pc.$$("#avisoBtns button")).length === 2, "un toque de una sola fila: «Sí, deshacer» / «No, dejarlo así»");
    await pc.click("#avisoBtns button[data-i='0']"); await pc.waitForSelector(".termine-btn[data-cod=ENCOL]");
    chk(!/pausa/.test(await pc.textContent("#abiertaBox")), "Baño deshecho: Encolado sigue abierto, sin pausa");
    // «No, dejarlo así» no toca nada
    await cargar(pc, [["m1", "MOVIM", 10, null]]);
    await pc.waitForSelector(".termine-btn[data-cod=MOVIM]");
    await pc.click("#deshBtn"); await pc.waitForSelector("#avisoPop:not(.hidden)"); await pc.click("#avisoBtns button[data-i='1']");
    await pc.waitForTimeout(200);
    chk(await pc.isVisible(".termine-btn[data-cod=MOVIM]") && !/DESHACER:m1/.test(await colaIds(pc)), "«No, dejarlo así»: no se deshace nada");
    await pc.close();

    // d) lo que la base ya confirmó: se manda el DESHACER con las filas, y el celular las saca del estado
    confirma = true; mandado = [];
    const pd = await entrar();
    await cargar(pd, [["d1", "CORTE", 60, null, { texto: "207" }]]);
    await pd.waitForSelector(".termine-btn[data-cod=CORTE]");
    await pd.waitForFunction(() => JSON.parse(localStorage.getItem("gt_queue_v3") || "[]").length === 0, null, { timeout: 15000 });
    await pd.click("#deshBtn"); await pd.waitForSelector("#avisoPop:not(.hidden)"); await pd.click("#avisoBtns button[data-i='0']");
    await pd.waitForSelector("#botonera .box[data-cod=CORTE]");
    await pd.waitForFunction(() => JSON.parse(localStorage.getItem("gt_queue_v3") || "[]").length === 0, null, { timeout: 15000 });
    const dx = mandado.find((x) => x.opcion === "DESHACER");
    chk(!!dx && dx.detalle.anula.join() === "d1" && dx.detalle.sin_enviar.length === 0 && dx.detalle.filas[0].texto === "207" && dx.rubro === null && dx.empleado_id === 7,
        "confirmado por la base: va el DESHACER con anula [d1], sin_enviar [] y la fila descripta");
    await pd.reload(); await pd.waitForSelector("#botonera .box[data-cod=CORTE]");
    chk(await pd.isHidden("#abiertaBox"), "después de recargar (lo de hoy guardado en el celular) Corte sigue deshecho");
    confirma = false;
    await pd.close();

    // e) a los 5 minutos el botón se va solo
    const pe = await entrar();
    await cargar(pe, [["x1", "DECO", 298, null, { texto: "3079" }]]);
    await pe.waitForSelector("#deshBtn:not(.hidden)");
    await pe.waitForSelector("#deshBtn.hidden", { state: "attached", timeout: 5000 });
    chk(true, "abierto hace 4:58: el botón se va solo al cumplir los 5 min");
    await pe.close();

    // f) celular chico (320×480) sin nada abierto: con el botón a la vista, las áreas entran sin bajar la pantalla
    const pf = await entrar({ width: 320, height: 480 });
    await cargar(pf, [["f1", "CORTE", 50, null], ["f2", "CORTE", 20, 50, { cantidad: 4 }]]);
    await pf.waitForSelector("#deshBtn:not(.hidden)");
    const m = await pf.evaluate(() => ({ alto: document.scrollingElement.scrollHeight, vh: innerHeight,
      partidas: [...document.querySelectorAll("#botonera .box")].filter((b) => b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1).length }));
    chk(m.alto <= m.vh + 1 && m.partidas === 0, "320×480: botón + 5 áreas sin scroll y sin nombres cortados (alto " + m.alto + " de " + m.vh + ")");
    await pf.close();
  } catch (e) { fallas.push(String(e)); console.log("✗ " + e); }
  await br.close(); srv.close();
  console.log(fallas.length ? `\n${fallas.length} falla(s)` : "\nTodo OK");
  process.exit(fallas.length ? 1 : 0);
});

/* Producción GT — app de operario.
 * Mismo molde que la de Virgilio: código del monitor + nombre → botonera → cada toque es un evento.
 * El código (4 dígitos) cambia cada minuto y sólo se pide al entrar; la sesión dura el día.
 *
 * ETAPA 1 (Thomas, 01/10/2026): la botonera son las ÁREAS (gt.rubros).
 *  · tocar un área sin nada abierto      → «Empecé» (opcion AREA, ts_inicio NULL)
 *  · tocar el área abierta               → «Terminé»: pide la cantidad en la unidad del área
 *    (ts_inicio = hora de la apertura, cantidad)
 *  · tocar OTRA área con una abierta     → en una sola pantalla cierra la anterior (con su
 *    cantidad) y empieza la nueva.
 * v11.0: Guardado a góndola acepta cualquier producto, pero si el código no salió de Contraído (o ya no le
 *        quedan cajas pendientes) avisa y pide confirmar con un segundo toque.
 * v10.0: sin lista desplegable (en el iPhone tapaba el campo): abajo del campo se muestra qué es el código
 *        mientras se tipea. Un código que NO está en la lista se pregunta y, confirmado, se registra igual.
 * v9.0: al terminar, en la misma pantalla se pregunta «¿con qué seguís?»: por defecto la misma área
 *       (o la que tocó) con el código siguiente. «Cambiar de área / no sigo» cierra y vuelve a la botonera.
 * v8.0: Guardado a góndola «se nutre de lo que salió de Contraído»: al empezar muestra como botones
 *       los códigos con cajas contraídas y todavía sin guardar (public.gt_contraido_pendiente).
 * v7.0: el código se compara sin ceros adelante («21» = «021») y se guarda como figura en la lista.
 * v6.0: los códigos son POR ÁREA (gt.codigo_area). Un área con códigos asignados sólo acepta esos;
 *       un área sin códigos asignados acepta cualquiera (hoy Grampeado).
 * v5.0: un área con pide_cantidad = false (hoy Pedidos) se cierra sin preguntar cantidad.
 * v4.0: un área con pide_codigo (hoy GRAMPEADO) pregunta al empezar «¿Qué vas a grampear?» y el
 * código viaja en `texto` de la apertura y del cierre. Si gt.codigos tiene filas, el código tiene
 * que estar ahí (del área o sin área); vacía, acepta cualquiera.
 *
 * Los eventos van a una cola en localStorage y se mandan en lote; la base contesta fila por
 * fila qué entró y qué rechazó, así una fila mala no traba al resto.
 */
(function () {
  "use strict";
  const CFG = window.GT_CFG;
  const LS_SESION = "gt_sesion_v2";
  const LS_QUEUE = "gt_queue_v3";
  const LS_RECH = "gt_rechazados_v3";
  const LS_AREAS = "gt_areas_v5";
  const LS_CODS = "gt_codigos_v6";
  const LS_DISP = "gt_dispositivo";
  const TIMEOUT_MS = 15000;

  const $ = (id) => document.getElementById(id);
  const st = { emp: null, nombre: null, areas: [], codigos: [], server: [], pend: null, codPara: null, pendCont: null };

  /* ---------- utilidades ---------- */
  function lsGet(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin storage */ } }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "x" + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  function dispositivo() { let d = lsGet(LS_DISP, null); if (!d) { d = uuid(); lsSet(LS_DISP, d); } return d; }
  function hoyAR() { return new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); }
  function diaAR(iso) { return new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString().slice(0, 10); }
  function hhmm(iso) {
    return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
  }
  function dur(ms) { const m = Math.max(0, Math.round(ms / 60000)); return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"); }
  function num(n) { return Number(n).toLocaleString("es-AR"); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.remove("hidden"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), 2500); }
  function show(id) { ["claveScreen", "nombreScreen", "optionsScreen", "cantScreen", "codScreen"].forEach((s) => $(s).classList.toggle("hidden", s !== id)); }

  async function rpc(name, body) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(CFG.SUPABASE_URL + "/rest/v1/rpc/" + name, {
        method: "POST",
        headers: { apikey: CFG.SUPABASE_KEY, Authorization: "Bearer " + CFG.SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
        signal: ctl.signal,
      });
      if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 200));
      return await r.json();
    } finally { clearTimeout(timer); }
  }

  /* ---------- cola ---------- */
  function cola() { return lsGet(LS_QUEUE, []); }
  function syncBadge() {
    const n = cola().length, b = $("syncBadge");
    b.textContent = n ? "⏳ " + n + " sin enviar" : "✓ al día";
    b.classList.toggle("pend", n > 0);
  }
  let flushing = false;
  async function flush() {
    if (flushing) return;
    const q = cola();
    if (!q.length) { syncBadge(); return; }
    flushing = true;
    try {
      const res = await rpc("gt_registrar", { p_filas: q });
      const ok = new Set(res.ok || []);
      const rech = res.rechazados || [];
      const rechIds = new Set(rech.map((r) => r.client_id));
      if (rech.length) {
        const viejos = lsGet(LS_RECH, []);
        rech.forEach((r) => viejos.push(Object.assign({ fila: q.find((x) => x.client_id === r.client_id) || null, ts: new Date().toISOString() }, r)));
        lsSet(LS_RECH, viejos.slice(-200));
        toast("⚠ " + rech.length + " registro(s) rechazado(s): " + rech[0].motivo);
      }
      st.server = st.server.concat(q.filter((x) => ok.has(x.client_id) && x.empleado_id === st.emp));
      lsSet(LS_QUEUE, cola().filter((x) => !ok.has(x.client_id) && !rechIds.has(x.client_id)));
    } catch (e) {
      // sin red o base caída: queda en la cola y se reintenta
    } finally { flushing = false; syncBadge(); }
  }

  /* ---------- estado del día ---------- */
  function eventosHoy() {
    const vistos = new Set(), out = [];
    st.server.concat(cola().filter((x) => x.empleado_id === st.emp)).forEach((r) => {
      if (vistos.has(r.client_id)) return; vistos.add(r.client_id);
      if (r.ts_cliente && diaAR(r.ts_cliente) === hoyAR()) out.push(r);
    });
    return out.sort((a, b) => a.ts_cliente.localeCompare(b.ts_cliente));
  }
  function areaDe(cod) { return st.areas.find((a) => a.codigo === cod) || null; }
  // el área abierta se DEDUCE de los eventos (servidor + cola), no se guarda aparte
  function abierta() {
    let ab = null;
    eventosHoy().forEach((r) => {
      if (r.opcion !== "AREA") return;
      if (!r.ts_inicio) ab = r;
      else if (ab && ab.rubro === r.rubro) ab = null;
    });
    return ab;
  }

  function registrar(area, extra, offsetMs) {
    const fila = Object.assign({
      client_id: uuid(), empleado_id: st.emp, opcion: "AREA", rubro: area.codigo,
      descripcion: area.nombre, texto: "", cantidad: null,
      ts_cliente: new Date(Date.now() + (offsetMs || 0)).toISOString(), ts_inicio: null,
      dispositivo: dispositivo(),
    }, extra || {});
    const q = cola(); q.push(fila); lsSet(LS_QUEUE, q);
    return fila;
  }

  /* ---------- botonera de áreas ---------- */
  function renderBotonera() {
    const ab = abierta();
    $("abiertaBox").classList.toggle("hidden", !ab);
    if (ab) {
      const a = areaDe(ab.rubro);
      $("abiertaBox").innerHTML = "Estás en <b>" + esc(a ? a.nombre : ab.rubro) + "</b>" + (ab.texto ? " · código <b>" + esc(ab.texto) + "</b>" : "") +
        " desde " + hhmm(ab.ts_cliente) +
        "<br><small>Tocala para terminar · tocá otra área para pasarte</small>";
    }
    $("botonera").innerHTML = st.areas.length ?
      '<div class="row row-3">' + st.areas.map((a) => {
        const esAb = ab && ab.rubro === a.codigo;
        return '<div class="box' + (esAb ? " abierta" : "") + '" data-cod="' + esc(a.codigo) + '">' +
          '<div class="box-title">' + esc(a.nombre) + '</div><div class="box-desc">' +
          (esAb ? "Terminé" : "Empecé") + "</div></div>";
      }).join("") + "</div>" :
      '<div class="error">No hay áreas cargadas para GT (gt.rubros).</div>';
    syncBadge();
    if (!$("hist").classList.contains("hidden")) renderHist();
  }

  function tocar(cod) {
    const a = areaDe(cod); if (!a) return;
    const ab = abierta();
    if (!ab) { empezar(a); return; }
    // v9.0: terminar la abierta y, EN LA MISMA PANTALLA, «¿con qué seguís?». Por defecto se sigue en
    // la misma área (lo normal en el día); si tocó otra, se propone ésa.
    const cierra = areaDe(ab.rubro) || { codigo: ab.rubro, nombre: ab.rubro, unidad: "cantidad" };
    const sigue = ab.rubro === cod ? cierra : a;
    st.pend = { ab, cierra, sigue };
    const pideCant = cierra.pide_cantidad !== false;
    $("cantTitulo").textContent = "Terminé " + cierra.nombre + (ab.texto ? " · " + ab.texto : "");
    $("cantSub").textContent = "desde " + hhmm(ab.ts_cliente);
    $("cantBox").classList.toggle("hidden", !pideCant);
    $("cantLabel").textContent = "¿Cuántas " + cierra.unidad + (ab.texto ? " del " + ab.texto : "") + "?";
    $("cantInput").value = ""; $("cantError").textContent = "";
    $("sigueLabel").textContent = sigue.pide_codigo ? "¿Con qué código seguís en " + sigue.nombre + "?" : "¿Seguís en " + sigue.nombre + "?";
    $("sigueInput").classList.toggle("hidden", !sigue.pide_codigo);
    prepararInput("sigueInput", "sigueHint", sigue); $("sigueError").textContent = "";
    $("siguePend").classList.add("hidden"); $("siguePend").innerHTML = "";
    if (sigue.codigo === "GUARD" && sigue.pide_codigo) pendientesContraido("siguePend", () => st.pend && st.pend.sigue.codigo === "GUARD");
    restaurarBtn("cantBtn"); $("cantBtn").textContent = "Terminar y seguir en " + sigue.nombre;
    show("cantScreen");
    (pideCant ? $("cantInput") : $("sigueInput")).focus();
  }

  // seguir = true → cierra y empieza el área propuesta (con su código); false → cierra y vuelve a la botonera
  function confirmarCant(seguir) {
    const p = st.pend; if (!p) return;
    const pideCant = p.cierra.pide_cantidad !== false;
    let cant = null;
    if (pideCant) {
      const v = $("cantInput").value.trim().replace(",", ".");
      if (!/^\d+(\.\d+)?$/.test(v)) { $("cantError").textContent = "Poné un número (0 si no hiciste ninguna)"; $("cantInput").focus(); return; }
      cant = Number(v);
    }
    let nuevo = null;
    if (seguir && p.sigue.pide_codigo) {
      nuevo = validarCodigo(p.sigue, $("sigueInput").value);
      if (nuevo.err) { $("sigueError").textContent = nuevo.err; $("sigueInput").focus(); return; }
      const avisoS = nuevo.nuevo ? null : fueraDeContraido(p.sigue, nuevo.guardo);
      if ((nuevo.nuevo || avisoS) && !confirmoNuevo(nuevo.guardo, "sigueError", "cantBtn", avisoS)) return;
    }
    registrar(p.cierra, { ts_inicio: p.ab.ts_cliente, cantidad: cant, texto: p.ab.texto || "" });
    if (seguir) registrar(p.sigue, nuevo ? { texto: nuevo.guardo } : null, 1);
    flush();
    toast("✓ Terminaste " + p.cierra.nombre + (cant != null ? " · " + num(cant) + " " + p.cierra.unidad : "") +
          (seguir ? " · seguís en " + p.sigue.nombre + (nuevo ? " · " + nuevo.guardo : "") : ""));
    st.pend = null; restaurarBtn("cantBtn"); show("optionsScreen"); renderBotonera();
  }

  // empezar un área: si pide código, primero «¿Qué vas a grampear?»
  function verbo(a) {
    const n = String(a.nombre || "").toLowerCase();
    return /ado$/.test(n) ? "¿Qué vas a " + n.replace(/ado$/, "ar") + "?" : "¿Qué código vas a hacer en " + a.nombre + "?";
  }
  // input de código: teclado numérico si todos los códigos del área son números; abajo, qué es lo tipeado
  function prepararInput(inputId, hintId, a) {
    const lista = codigosDe(a);
    const el = $(inputId);
    el.value = ""; el.dataset.area = a.codigo; el.dataset.hint = hintId;
    el.setAttribute("inputmode", lista.length && lista.every((c) => /^\d+$/.test(c.codigo)) ? "numeric" : "text");
    $(hintId).textContent = ""; $(hintId).classList.remove("nuevo");
    st.nuevoOk = null;
  }
  function mostrarHint(el) {
    const a = areaDe(el.dataset.area), h = $(el.dataset.hint);
    if (!a || !h) return;
    st.nuevoOk = null;
    const v = el.value.trim();
    if (!v) { h.textContent = ""; h.classList.remove("nuevo"); return; }
    const r = validarCodigo(a, v);
    const c = r.cod;
    h.classList.toggle("nuevo", !!r.nuevo);
    h.textContent = c ? [c.descripcion, c.medida].filter(Boolean).join(" · ") || "✓" :
      r.nuevo ? "No está en la lista de " + a.nombre : "";
  }
  // un código fuera de la lista se registra sólo si se confirma (segundo toque con el mismo código)
  function confirmoNuevo(cod, errId, btnId, msg) {
    if (st.nuevoOk === cod) return true;
    st.nuevoOk = cod;
    $(errId).textContent = (msg || "El " + cod + " no está en la lista.") + " ¿Lo registro igual? Tocá de nuevo para confirmar.";
    const b = $(btnId); b.dataset.txt = b.dataset.txt || b.textContent; b.textContent = "Sí, registrar el " + cod;
    return false;
  }
  // v11.0: en Guardado, ¿el código salió de Contraído y le quedan cajas por guardar?
  function fueraDeContraido(a, cod) {
    if (a.codigo !== "GUARD" || !st.pendCont) return null;          // sin lista leída no se avisa
    const sin0 = (x) => String(x).toUpperCase().replace(/^0+(?=\d)/, "");
    return st.pendCont.some((x) => sin0(x.codigo) === sin0(cod)) ? null :
      "El " + cod + " no salió de Contraído o ya no le quedan cajas por guardar.";
  }
  function restaurarBtn(id) { const b = $(id); if (b.dataset.txt) { b.textContent = b.dataset.txt; delete b.dataset.txt; } }
  function empezar(a) {
    if (!a.pide_codigo) {
      registrar(a, null, 1); flush();
      toast("✓ Empezaste " + a.nombre); show("optionsScreen"); renderBotonera(); return;
    }
    st.codPara = a;
    $("codTitulo").textContent = "Empecé " + a.nombre;
    $("codLabel").textContent = verbo(a);
    prepararInput("codInput", "codHint", a); $("codError").textContent = ""; restaurarBtn("codBtn");
    $("codPend").classList.add("hidden"); $("codPend").innerHTML = "";
    if (a.codigo === "GUARD") pendientesContraido("codPend", () => st.codPara && st.codPara.codigo === "GUARD");
    show("codScreen"); $("codInput").focus();
  }
  // v8.0: lo que salió de Contraído y falta guardar, como botones (en «Empecé» o en «¿con qué seguís?»)
  async function pendientesContraido(destId, sigueVigente) {
    let p = [];
    st.pendCont = null;
    try { p = await rpc("gt_contraido_pendiente", {}); } catch { return; }   // sin red: se tipea el código (sin aviso)
    st.pendCont = p;
    if (!sigueVigente()) return;
    $(destId).innerHTML = p.length
      ? '<div class="cod-pend-t">Salió de Contraído y falta guardar:</div>' + p.map((x) =>
          '<button data-cod="' + esc(x.codigo) + '">' + esc(x.codigo) + " · " + num(x.cajas) + " cajas<small>" +
          esc(x.descripcion || "") + "</small></button>").join("")
      : '<div class="cod-pend-t">No hay nada de Contraído pendiente de guardar.</div>';
    $(destId).classList.remove("hidden");
  }
  function codigosDe(a) { return st.codigos.filter((c) => c.rubro === a.codigo); }
  // devuelve { guardo, cod } o { err }. El código se compara sin ceros adelante («21» = «021»)
  function validarCodigo(a, raw) {
    const v = String(raw || "").trim().toUpperCase();
    if (!v) return { err: "Poné el código" };
    const lista = codigosDe(a);
    const sin0 = (x) => String(x).toUpperCase().replace(/^0+(?=\d)/, "");
    const cod = lista.find((c) => sin0(c.codigo) === sin0(v));
    if (lista.length && !cod) return { guardo: v, nuevo: true };   // v10.0: se pregunta, no se rechaza
    return { guardo: cod ? cod.codigo : v, cod };    // se guarda como figura en la lista
  }
  function confirmarCod() {
    const a = st.codPara; if (!a) return;
    const r = validarCodigo(a, $("codInput").value);
    if (r.err) { $("codError").textContent = r.err; return; }
    const avisoC = r.nuevo ? null : fueraDeContraido(a, r.guardo);
    if ((r.nuevo || avisoC) && !confirmoNuevo(r.guardo, "codError", "codBtn", avisoC)) return;
    restaurarBtn("codBtn");
    registrar(a, { texto: r.guardo }, 1); flush();
    const c = r.cod;
    toast("✓ Empezaste " + a.nombre + " · " + r.guardo + (c && c.descripcion ? " " + c.descripcion + (c.medida ? " " + c.medida : "") : ""));
    st.codPara = null; show("optionsScreen"); renderBotonera();
  }
  function cancelarCod() { st.codPara = null; show("optionsScreen"); renderBotonera(); }

  function renderHist() {
    const evs = eventosHoy().filter((r) => r.opcion === "AREA");
    if (!evs.length) { $("hist").innerHTML = '<p style="text-align:center">Sin registros hoy.</p>'; return; }
    const pend = new Set(cola().map((x) => x.client_id));
    // un renglón por tramo: el cierre trae la duración y la cantidad; una apertura sin cierre es «en curso»
    const cerradas = new Set(evs.filter((r) => r.ts_inicio).map((r) => r.rubro + "|" + r.ts_inicio));
    const filas = evs.filter((r) => r.ts_inicio || !cerradas.has(r.rubro + "|" + r.ts_cliente));
    $("hist").innerHTML = "<table><tr><th>Área</th><th>Desde</th><th>Hasta</th><th>Dur.</th><th>Cant.</th></tr>" +
      filas.slice().reverse().map((r) => {
        const a = areaDe(r.rubro), p = pend.has(r.client_id) ? " ⏳" : "";
        const nom = esc(a ? a.nombre : r.rubro) + (r.texto ? " · " + esc(r.texto) : "");
        if (!r.ts_inicio) return "<tr><td>" + nom + "</td><td>" + hhmm(r.ts_cliente) + p + "</td><td colspan=3>en curso</td></tr>";
        return "<tr><td>" + nom + "</td><td>" + hhmm(r.ts_inicio) + "</td><td>" + hhmm(r.ts_cliente) + p + "</td><td>" +
          dur(new Date(r.ts_cliente) - new Date(r.ts_inicio)) + "</td><td>" + (r.cantidad == null ? "—" : num(r.cantidad)) + "</td></tr>";
      }).join("") + "</table>";
  }

  /* ---------- ingreso ---------- */
  // 1) código del monitor → lista de nombres
  async function validarClave() {
    const v = $("claveInput").value.replace(/\D/g, "");
    $("claveError").textContent = "";
    if (v.length !== 4) { $("claveError").textContent = "El código tiene 4 números"; return; }
    let r;
    try { r = await rpc("gt_clave_validar", { p_clave: v }); }
    catch { $("claveError").textContent = "Sin conexión. Probá de nuevo."; return; }
    if (!r.ok) { $("claveError").textContent = "Código incorrecto o vencido: mirá el monitor"; return; }
    const emps = r.empleados || [];
    $("nombreLista").innerHTML = emps.length ? emps.map((e) =>
      '<button data-id="' + e.id + '" data-nombre="' + esc(e.nombre) + '">' + esc(e.nombre) + "</button>").join("") :
      '<div class="error">No hay empleados cargados en GT.</div>';
    show("nombreScreen");
  }

  async function cargarAreas() {
    try { st.areas = await rpc("gt_botones", {}); lsSet(LS_AREAS, st.areas); }
    catch { st.areas = lsGet(LS_AREAS, []); }
    try { st.codigos = await rpc("gt_codigos_area", {}); lsSet(LS_CODS, st.codigos); }
    catch { st.codigos = lsGet(LS_CODS, []); }
  }
  async function cargarHoy() {
    try { st.server = (await rpc("gt_registros_hoy", { p_empleado: st.emp })).map((r) => Object.assign({ empleado_id: st.emp }, r)); }
    catch { /* sin red: se arma con la cola */ }
  }

  // 2) entra con el empleado elegido (o con la sesión del día, sin pedir código)
  async function entrar(id, nombre) {
    st.emp = Number(id); st.nombre = nombre;
    lsSet(LS_SESION, { id: st.emp, nombre, dia: hoyAR() });
    $("opName").textContent = nombre;
    show("optionsScreen");
    await Promise.all([cargarAreas(), cargarHoy()]);
    renderBotonera(); flush();
  }

  function salir() {
    if (abierta() && !confirm("Tenés un área sin terminar. ¿Cambiar de operario igual? (queda abierta)")) return;
    try { localStorage.removeItem(LS_SESION); } catch { /* nada */ }
    st.emp = null; st.server = []; $("claveInput").value = ""; $("hist").classList.add("hidden");
    show("claveScreen");
  }

  /* ---------- eventos ---------- */
  $("verBadge").textContent = "v" + CFG.APP_VERSION;
  $("claveBtn").onclick = validarClave;
  $("claveInput").addEventListener("keydown", (e) => { if (e.key === "Enter") validarClave(); });
  $("nombreLista").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) entrar(b.dataset.id, b.dataset.nombre); });
  $("nombreVolver").onclick = () => show("claveScreen");
  $("botonera").addEventListener("click", (e) => { const b = e.target.closest(".box"); if (b) tocar(b.dataset.cod); });
  $("salirBtn").onclick = salir;
  $("cantBtn").onclick = () => confirmarCant(true);
  $("cambioBtn").onclick = () => confirmarCant(false);
  $("cantInput").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (st.pend && st.pend.sigue.pide_codigo) $("sigueInput").focus(); else confirmarCant(true);
  });
  $("sigueInput").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmarCant(true); });
  $("siguePend").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { $("sigueInput").value = b.dataset.cod; confirmarCant(true); } });
  $("cantVolver").onclick = () => { st.pend = null; show("optionsScreen"); };
  $("codBtn").onclick = confirmarCod;
  $("codInput").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmarCod(); });
  $("codVolver").onclick = cancelarCod;
  ["codInput", "sigueInput"].forEach((id) => $(id).addEventListener("input", (e) => {
    mostrarHint(e.target); $(id === "codInput" ? "codError" : "sigueError").textContent = "";
    restaurarBtn(id === "codInput" ? "codBtn" : "cantBtn");
  }));
  $("codPend").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { $("codInput").value = b.dataset.cod; confirmarCod(); } });
  $("histBtn").onclick = () => { const h = $("hist"); h.classList.toggle("hidden"); if (!h.classList.contains("hidden")) renderHist(); };
  window.addEventListener("online", flush);
  setInterval(flush, 30000);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

  const ses = lsGet(LS_SESION, null);
  if (ses && ses.dia === hoyAR() && ses.id) entrar(ses.id, ses.nombre);
  else show("claveScreen");

  window.__gt = { st, abierta, eventosHoy, flush };   // para tests
})();

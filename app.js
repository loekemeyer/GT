/* Producción GT — app de operario.
 * Mismo molde que la de Virgilio / Cervantes: código del monitor + nombre → botonera → cada toque es un evento.
 * El código (4 dígitos) cambia cada minuto y sólo se pide al entrar; la sesión dura el día.
 *  · tarea  (abre y cierra): 1er toque = apertura (ts_inicio NULL); 2do toque = cierre
 *    (ts_inicio = hora de la apertura). Sólo UNA tarea abierta por operario a la vez.
 *  · evento (un toque): una sola fila.
 * La botonera NO está escrita acá: sale de gt.tareas (RPC gt_tareas). Agregar una tarea es
 * un insert en la base, no un deploy.
 * Los eventos van a una cola en localStorage y se mandan en lote; la base contesta fila por
 * fila qué entró y qué rechazó, así una fila mala no traba al resto.
 */
(function () {
  "use strict";
  const CFG = window.GT_CFG;
  const LS_SESION = "gt_sesion_v2";
  const LS_QUEUE = "gt_queue_v2";
  const LS_RECH = "gt_rechazados_v2";
  const LS_TAREAS = "gt_tareas_v2";
  const LS_DISP = "gt_dispositivo";
  const TIMEOUT_MS = 15000;

  const $ = (id) => document.getElementById(id);
  const st = { emp: null, nombre: null, tareas: [], server: [], pendTexto: null };

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
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.remove("hidden"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), 2500); }
  function show(id) { ["claveScreen", "nombreScreen", "optionsScreen", "textoScreen"].forEach((s) => $(s).classList.toggle("hidden", s !== id)); }

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
      // lo que entró pasa al historial del servidor; lo que se agregó mientras tanto queda
      const enviados = q.filter((x) => ok.has(x.client_id));
      st.server = st.server.concat(enviados.filter((x) => x.empleado_id === st.emp));
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
  function tareaDe(cod) { return st.tareas.find((t) => t.codigo === cod) || null; }
  // la tarea abierta se DEDUCE de los eventos (servidor + cola), no se guarda aparte
  function abierta() {
    let ab = null;
    eventosHoy().forEach((r) => {
      const t = tareaDe(r.opcion);
      if (!t || t.tipo !== "tarea") return;
      if (!r.ts_inicio) ab = r;
      else if (ab && ab.opcion === r.opcion) ab = null;
    });
    return ab;
  }

  function registrar(t, texto, tsInicio) {
    const fila = {
      client_id: uuid(), empleado_id: st.emp, opcion: t.codigo, descripcion: t.descripcion,
      texto: texto || "", ts_cliente: new Date().toISOString(), ts_inicio: tsInicio || null,
      dispositivo: dispositivo(),
    };
    const q = cola(); q.push(fila); lsSet(LS_QUEUE, q);
    syncBadge();
    flush();
    return fila;
  }

  /* ---------- pantallas ---------- */
  function renderBotonera() {
    const ab = abierta();
    $("abiertaBox").classList.toggle("hidden", !ab);
    if (ab) {
      const t = tareaDe(ab.opcion);
      $("abiertaBox").innerHTML = "En curso: <b>" + esc(ab.opcion) + "</b> " + esc(t ? t.descripcion : "") +
        (ab.texto ? " · " + esc(ab.texto) : "") + " · desde " + hhmm(ab.ts_cliente) + "<br><small>Tocala de nuevo para terminarla</small>";
    }
    const filas = {};
    st.tareas.forEach((t) => { (filas[t.fila] = filas[t.fila] || []).push(t); });
    const html = Object.keys(filas).sort((a, b) => a - b).map((f) => {
      const ts = filas[f];
      const cols = Math.min(ts.length, 4);
      return '<div class="row" style="grid-template-columns:repeat(' + cols + ',1fr)">' + ts.map((t) => {
        const esAb = ab && ab.opcion === t.codigo;
        const off = ab && !esAb && t.tipo === "tarea";
        return '<div class="box' + (esAb ? " abierta" : "") + (off ? " off" : "") + '" data-cod="' + esc(t.codigo) + '">' +
          '<div class="box-title">' + esc(t.codigo) + '</div><div class="box-desc">' +
          esc(esAb ? "Terminar · " + t.descripcion : t.descripcion) + "</div></div>";
      }).join("") + "</div>";
    }).join("");
    $("botonera").innerHTML = st.tareas.length ? html :
      '<div class="error">No hay tareas cargadas para GT. Hay que darlas de alta en gt.tareas.</div>';
    if (!$("hist").classList.contains("hidden")) renderHist();
  }

  function tocar(cod) {
    const t = tareaDe(cod); if (!t) return;
    const ab = abierta();
    if (t.tipo === "tarea" && ab && ab.opcion === cod) {   // cerrar
      registrar(t, ab.texto, ab.ts_cliente);
      toast("✓ " + cod + " terminada · " + dur(Date.now() - new Date(ab.ts_cliente).getTime()));
      renderBotonera(); return;
    }
    if (t.tipo === "tarea" && ab) { toast("Primero terminá " + ab.opcion); return; }
    if (t.pide_texto) { abrirTexto(t); return; }
    registrar(t, "", null);
    toast("✓ " + cod + (t.tipo === "tarea" ? " empezada" : " registrado"));
    renderBotonera();
  }

  function abrirTexto(t) {
    st.pendTexto = t;
    $("textoCodigo").textContent = t.codigo;
    $("textoDesc").textContent = t.descripcion;
    $("textoLabel").textContent = t.etiqueta_texto || "Ingresar dato";
    $("textoInput").value = ""; $("textoError").textContent = "";
    show("textoScreen"); $("textoInput").focus();
  }
  function enviarTexto() {
    const t = st.pendTexto, v = $("textoInput").value.trim();
    if (!v) { $("textoError").textContent = "Falta el dato"; return; }
    registrar(t, v, null);
    toast("✓ " + t.codigo + (t.tipo === "tarea" ? " empezada" : " registrado"));
    st.pendTexto = null; show("optionsScreen"); renderBotonera();
  }

  function renderHist() {
    const evs = eventosHoy();
    if (!evs.length) { $("hist").innerHTML = '<p style="text-align:center">Sin registros hoy.</p>'; return; }
    const pend = new Set(cola().map((x) => x.client_id));
    $("hist").innerHTML = "<table><tr><th>Hora</th><th>Tarea</th><th>Dato</th><th>Dur.</th></tr>" +
      evs.slice().reverse().map((r) => {
        const t = tareaDe(r.opcion);
        const d = r.ts_inicio ? dur(new Date(r.ts_cliente) - new Date(r.ts_inicio)) :
          (t && t.tipo === "tarea" ? "inicio" : "—");
        return "<tr><td>" + hhmm(r.ts_cliente) + (pend.has(r.client_id) ? " ⏳" : "") + "</td><td>" + esc(r.opcion) +
          "</td><td>" + esc(r.texto || "—") + "</td><td>" + d + "</td></tr>";
      }).join("") + "</table>";
  }

  /* ---------- carga ---------- */
  async function cargarTareas() {
    try { st.tareas = await rpc("gt_tareas", { p_empleado: st.emp }); lsSet(LS_TAREAS, st.tareas); }
    catch { st.tareas = lsGet(LS_TAREAS, []); }
  }
  async function cargarHoy() {
    try { st.server = (await rpc("gt_registros_hoy", { p_empleado: st.emp })).map((r) => Object.assign({ empleado_id: st.emp }, r)); }
    catch { /* sin red: se arma con la cola */ }
  }

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

  // 2) entra con el empleado elegido (o con la sesión del día, sin pedir código)
  async function entrar(id, nombre) {
    st.emp = Number(id); st.nombre = nombre;
    lsSet(LS_SESION, { id: st.emp, nombre, dia: hoyAR() });
    $("opName").textContent = nombre;
    show("optionsScreen");
    await Promise.all([cargarTareas(), cargarHoy()]);
    renderBotonera(); syncBadge(); flush();
  }

  function salir() {
    if (abierta() && !confirm("Tenés una tarea abierta. ¿Cambiar de operario igual? (queda abierta)")) return;
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
  $("textoBtn").onclick = enviarTexto;
  $("textoInput").addEventListener("keydown", (e) => { if (e.key === "Enter") enviarTexto(); });
  $("textoVolver").onclick = () => { st.pendTexto = null; show("optionsScreen"); };
  $("histBtn").onclick = () => { const h = $("hist"); h.classList.toggle("hidden"); if (!h.classList.contains("hidden")) renderHist(); };
  window.addEventListener("online", flush);
  setInterval(flush, 30000);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

  const ses = lsGet(LS_SESION, null);
  if (ses && ses.dia === hoyAR() && ses.id) entrar(ses.id, ses.nombre);
  else show("claveScreen");

  window.__gt = { st, abierta, eventosHoy, flush };   // para tests
})();

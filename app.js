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
  const st = { emp: null, nombre: null, areas: [], codigos: [], server: [], pend: null, codPara: null };

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
    // terminar la abierta (y, si tocó otra, empezar ésa)
    const cierra = areaDe(ab.rubro) || { codigo: ab.rubro, nombre: ab.rubro, unidad: "cantidad" };
    const sigue = ab.rubro === cod ? null : a;
    if (cierra.pide_cantidad === false) {               // v5.0: Pedidos cierra sin preguntar cantidad
      registrar(cierra, { ts_inicio: ab.ts_cliente, texto: ab.texto || "" }); flush();
      toast("✓ Terminaste " + cierra.nombre);
      if (sigue) { empezar(sigue); return; }
      renderBotonera(); return;
    }
    st.pend = { ab, cierra, sigue };
    $("cantTitulo").textContent = "Terminé " + st.pend.cierra.nombre;
    $("cantSub").textContent = st.pend.sigue ? "y empiezo " + st.pend.sigue.nombre : "desde " + hhmm(ab.ts_cliente);
    $("cantLabel").textContent = "¿Cuántas " + st.pend.cierra.unidad + (ab.texto ? " del " + ab.texto : "") + "?";
    $("cantInput").value = ""; $("cantError").textContent = "";
    show("cantScreen"); $("cantInput").focus();
  }

  function confirmarCant() {
    const p = st.pend; if (!p) return;
    const v = $("cantInput").value.trim().replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(v)) { $("cantError").textContent = "Poné un número (0 si no hiciste ninguna)"; return; }
    registrar(p.cierra, { ts_inicio: p.ab.ts_cliente, cantidad: Number(v), texto: p.ab.texto || "" });
    flush();
    toast("✓ Terminaste " + p.cierra.nombre + " · " + num(v) + " " + p.cierra.unidad);
    st.pend = null;
    if (p.sigue) { empezar(p.sigue); return; }
    show("optionsScreen"); renderBotonera();
  }

  // empezar un área: si pide código, primero «¿Qué vas a grampear?»
  function verbo(a) {
    const n = String(a.nombre || "").toLowerCase();
    return /ado$/.test(n) ? "¿Qué vas a " + n.replace(/ado$/, "ar") + "?" : "¿Qué código vas a hacer en " + a.nombre + "?";
  }
  function empezar(a) {
    if (!a.pide_codigo) {
      registrar(a, null, 1); flush();
      toast("✓ Empezaste " + a.nombre); show("optionsScreen"); renderBotonera(); return;
    }
    st.codPara = a;
    $("codTitulo").textContent = "Empecé " + a.nombre;
    $("codLabel").textContent = verbo(a);
    $("codInput").value = ""; $("codError").textContent = "";
    $("codLista").innerHTML = codigosDe(a).map((c) => '<option value="' + esc(c.codigo) + '">' +
      esc([c.descripcion, c.medida].filter(Boolean).join(" · ")) + "</option>").join("");
    show("codScreen"); $("codInput").focus();
  }
  function codigosDe(a) { return st.codigos.filter((c) => c.rubro === a.codigo); }
  function confirmarCod() {
    const a = st.codPara; if (!a) return;
    const v = $("codInput").value.trim().toUpperCase();
    if (!v) { $("codError").textContent = "Poné el código"; return; }
    const lista = codigosDe(a);
    const sin0 = (x) => String(x).toUpperCase().replace(/^0+(?=\d)/, "");   // «21» = «021»
    const cod = lista.find((c) => sin0(c.codigo) === sin0(v));
    if (lista.length && !cod) {
      $("codError").textContent = "El código " + v + " no está en la lista de " + a.nombre; return;
    }
    const guardo = cod ? cod.codigo : v;                // se guarda como figura en la lista
    registrar(a, { texto: guardo }, 1); flush();
    toast("✓ Empezaste " + a.nombre + " · " + guardo + (cod && cod.descripcion ? " " + cod.descripcion + (cod.medida ? " " + cod.medida : "") : ""));
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
  $("cantBtn").onclick = confirmarCant;
  $("cantInput").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmarCant(); });
  $("cantVolver").onclick = () => { st.pend = null; show("optionsScreen"); };
  $("codBtn").onclick = confirmarCod;
  $("codInput").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmarCod(); });
  $("codVolver").onclick = cancelarCod;
  $("histBtn").onclick = () => { const h = $("hist"); h.classList.toggle("hidden"); if (!h.classList.contains("hidden")) renderHist(); };
  window.addEventListener("online", flush);
  setInterval(flush, 30000);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

  const ses = lsGet(LS_SESION, null);
  if (ses && ses.dia === hoyAR() && ses.id) entrar(ses.id, ses.nombre);
  else show("claveScreen");

  window.__gt = { st, abierta, eventosHoy, flush };   // para tests
})();

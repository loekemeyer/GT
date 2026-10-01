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
 * 1.22: PLANTAS (Thomas). Quien trabaja en más de una planta (gt.empleado_planta: Darío Méndez y Luis Luna) elige
 *       al entrar «¿En qué planta trabajás hoy?» (Pellegrini o Esnaola). La botonera muestra sólo las áreas de esa planta
 *       (un área sin planta es de la principal) y cada evento lleva la planta. El resto entra como siempre.
 * v1.3: 🍽️ Almuerzo (al volver propone el área anterior) y 🏁 Terminar día (evento FIN). Los avisos de
 *       almuerzo (13:10) y salida (17:45) los manda la base: gt.alerta_jornada.
 * v1.2: se actualiza sola cuando hay versión nueva (version.json cada 2 min).
 * v1.1 (numeración nueva): rediseño para celular — tarjetas con ícono, área en curso con el tiempo que lleva,
 *        resumen del día en tarjetas, acciones fijas abajo.
 * v12.0: un área con 6 opciones o menos (Recibir mercadería: Insumo / Moldura) las muestra como botones
 *        grandes en vez del campo de código; la opción elegida se graba como el código.
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
  const st = { emp: null, nombre: null, areas: [], codigos: [], server: [], pend: null, codPara: null, pendCont: null,
              planta: null, plantas: [], principal: null };

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
    return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" });
  }
  function dur(ms) { const m = Math.max(0, Math.round(ms / 60000)); return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"); }
  function num(n) { return Number(n).toLocaleString("es-AR"); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.remove("hidden"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), 2500); }
  function show(id) { ["claveScreen", "nombreScreen", "plantaScreen", "optionsScreen", "cantScreen", "codScreen", "medScreen"].forEach((s) => $(s).classList.toggle("hidden", s !== id)); }

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
      dispositivo: dispositivo(), planta: st.planta,
    }, extra || {});
    const q = cola(); q.push(fila); lsSet(LS_QUEUE, q);
    return fila;
  }

  /* ---------- botonera de áreas ---------- */
  // v1.1: ícono por área (se ve en la tarjeta); un área nueva sin ícono usa 🏷️
  const ICONO = { CORTE: "✂️", GRAMP: "📌", ENCOL: "🧴", MONT: "🛠️", GANCHO: "🪝", EMBL: "📦", CONTR: "🎞️",
                  PED: "🧾", DECO: "🎨", GUARD: "🗄️", RECIB: "🚚", ALMU: "🍽️", MOLDU: "🪚", LIJA: "🧽", PINT: "🖌️" };
  // 1.22: un área es de la planta elegida; un área sin planta es de la principal
  function deLaPlanta(a) { return (a.planta || st.principal || null) === (st.planta || st.principal || null); }
  function transcurrido(iso) {
    const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    return m < 60 ? m + " min" : Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0");
  }
  function renderBotonera() {
    const ab = abierta();
    const hoy = eventosHoy(), ult = hoy[hoy.length - 1];
    const finDia = !ab && ult && ult.opcion === "FIN";
    $("abiertaBox").classList.toggle("hidden", !ab && !finDia);
    $("abiertaBox").classList.toggle("fin", !!finDia);
    if (finDia) $("abiertaBox").innerHTML = '<div class="ab-txt"><div class="ab-area">🏁 Día terminado a las ' + hhmm(ult.ts_cliente) +
      '</div><div class="ab-det">¡Hasta mañana! Si seguís trabajando, tocá un área.</div></div>';
    if (ab) {
      const a = areaDe(ab.rubro);
      $("abiertaBox").innerHTML = '<span class="ab-punto"></span><div class="ab-txt"><div class="ab-area">' +
        (ICONO[ab.rubro] || "🏷️") + " " + esc(a ? a.nombre : ab.rubro) + (ab.texto ? " · " + esc(ab.texto) : "") + (ab.medida ? " (" + esc(ab.medida) + ")" : "") +
        '</div><div class="ab-det">Desde las ' + hhmm(ab.ts_cliente) + (ab.rubro === "ALMU" ? " · tocá «Volví de almorzar»" : "") + "</div></div>" +
        '<div class="ab-tiempo" data-desde="' + esc(ab.ts_cliente) + '">' + transcurrido(ab.ts_cliente) + "</div>";
    }
    // v1.8 (Thomas): con un sector abierto NO se ofrecen los otros: sólo «Terminé», que pide cuánto hizo
    // (y ahí mismo «¿con qué seguís?»). Con el almuerzo abierto, sólo «Volví de almorzar».
    if (ab) {
      $("botonera").innerHTML = ab.rubro === "ALMU" ? "" :
        '<button class="termine-btn" data-cod="' + esc(ab.rubro) + '">✅ Terminé</button>';
    } else $("botonera").innerHTML = st.areas.some((a) => a.codigo !== "ALMU" && deLaPlanta(a)) ?
      '<div class="row">' + st.areas.filter((a) => a.codigo !== "ALMU" && deLaPlanta(a)).map((a) => {
        const esAb = ab && ab.rubro === a.codigo;
        return '<div class="box' + (esAb ? " abierta" : "") + '" data-cod="' + esc(a.codigo) + '" role="button">' +
          '<div class="box-ico">' + (ICONO[a.codigo] || "🏷️") + '</div><div><div class="box-title">' + esc(a.nombre) +
          '</div><div class="box-desc">' + (esAb ? "● Terminar" : "Empezar") + "</div></div></div>";
      }).join("") + "</div>" :
      '<div class="error">No hay áreas cargadas para GT (gt.rubros).</div>';
    // v1.11 (D31): con un sector abierto no hay Almuerzo ni Terminar día: se sale por «Terminé»
    // (esa pantalla tiene «Me voy a almorzar» y «Terminé el día»). Con el almuerzo abierto, sólo «Volví».
    const conSector = !!(ab && ab.rubro !== "ALMU");
    $("almuBtn").classList.toggle("hidden", !areaDe("ALMU") || conSector);
    $("finBtn").classList.toggle("hidden", !!ab);
    $("plantaBtn").classList.toggle("hidden", !!ab || st.plantas.length < 2);
    $("almuBtn").textContent = ab && ab.rubro === "ALMU" ? "🍽️ Volví de almorzar" : "🍽️ Almuerzo";
    $("almuBtn").classList.toggle("activo", !!(ab && ab.rubro === "ALMU"));
    syncBadge();
    if (!$("histPop").classList.contains("hidden")) renderHist();
  }
  setInterval(() => { const t = document.querySelector(".ab-tiempo"); if (t) t.textContent = transcurrido(t.dataset.desde); }, 30000);

  function tocar(cod) {
    const a = areaDe(cod); if (!a) return;
    const ab = abierta();
    if (!ab) { empezar(a); return; }
    // v9.0: terminar la abierta y, EN LA MISMA PANTALLA, «¿con qué seguís?». Por defecto se sigue en
    // la misma área (lo normal en el día); si tocó otra, se propone ésa.
    const cierra = areaDe(ab.rubro) || { codigo: ab.rubro, nombre: ab.rubro, unidad: "cantidad" };
    let sigue = ab.rubro === cod ? cierra : a;
    // v1.3: al volver de almorzar se propone el área en la que estaba antes
    if (ab.rubro === "ALMU" && cod === "ALMU") sigue = areaAntesDelAlmuerzo(ab);
    abrirTermine(ab, cierra, sigue, "normal");
  }

  // v1.3: «🏁 Terminar día». Si hay algo abierto, lo cierra (con su cantidad) y marca el fin del día.
  function terminarDia() {
    const ab = abierta();
    if (!ab) {
      if (!confirm("¿Terminar el día?")) return;
      registrarFin(); flush(); toast("🏁 Terminaste el día. ¡Hasta mañana!"); finDelDia(); return;
    }
    abrirTermine(ab, areaDe(ab.rubro) || { codigo: ab.rubro, nombre: ab.rubro, unidad: "cantidad" }, null, "fin");
  }
  function areaAntesDelAlmuerzo(ab) {
    const prev = eventosHoy().filter((r) => r.opcion === "AREA" && r.rubro !== "ALMU" && r.ts_inicio && r.ts_cliente <= ab.ts_cliente);
    return prev.length ? areaDe(prev[prev.length - 1].rubro) : null;
  }
  function registrarFin() {
    const q = cola();
    q.push({ client_id: uuid(), empleado_id: st.emp, opcion: "FIN", rubro: null, descripcion: "Terminé el día", texto: "",
             cantidad: null, ts_cliente: new Date(Date.now() + 2).toISOString(), ts_inicio: null, dispositivo: dispositivo(), planta: st.planta });
    lsSet(LS_QUEUE, q);
  }

  function abrirTermine(ab, cierra, sigue, modo) {
    st.pend = { ab, cierra, sigue, modo };
    const pideCant = cierra.pide_cantidad !== false;
    const almorzar = sigue && sigue.codigo === "ALMU";
    // v1.11 (D29): Recibir mercadería pregunta qué se recibe al EMPEZAR, pero al terminar no pregunta con qué sigue
    const conSigue = modo !== "fin" && sigue && !almorzar && !(sigue.codigo === "RECIB" && cierra.codigo === "RECIB");
    $("cantTitulo").textContent = (cierra.codigo === "ALMU" ? "Volví de almorzar" : "Terminé " + cierra.nombre) + (ab.texto ? " · " + ab.texto : "") + (ab.medida ? " (" + ab.medida + ")" : "");
    $("cantSub").textContent = "desde " + hhmm(ab.ts_cliente);
    $("cantBox").classList.toggle("hidden", !pideCant);
    $("cantLabel").textContent = "¿Cuántas " + cierra.unidad + (ab.texto ? " del " + ab.texto : "") + "?";
    $("cantInput").value = ""; $("cantError").textContent = "";
    if (!conSigue && !almorzar) st.pend.sigue = null;   // «Listo» cierra y no abre nada
    $("sigueBox").classList.toggle("hidden", !conSigue);
    $("siguePend").classList.add("hidden"); $("siguePend").innerHTML = "";
    if (conSigue) {
      $("sigueLabel").textContent = !sigue.pide_codigo ? "¿Seguís en " + sigue.nombre + "?" :
        esOpciones(sigue) ? "¿Seguís en " + sigue.nombre + "? ¿" + codigosDe(sigue).map((c) => c.descripcion || c.codigo).join(" o ") + "?" :
        "¿Con qué código seguís en " + sigue.nombre + "?";
      prepararInput("sigueInput", "sigueHint", sigue); $("sigueError").textContent = "";
      if (!sigue.pide_codigo) { $("sigueInput").classList.add("hidden"); $("sigueOpts").classList.add("hidden"); }
      if (sigue.codigo === "GUARD" && sigue.pide_codigo) pendientesContraido("siguePend", () => st.pend && st.pend.sigue && st.pend.sigue.codigo === "GUARD");
    }
    restaurarBtn("cantBtn");
    $("cantBtn").textContent = modo === "fin" ? "🏁 Terminar el día" : almorzar ? "🍽️ Terminar e ir a almorzar" :
      conSigue ? (cierra.codigo === "ALMU" ? "Volver y seguir en " : "Terminar y seguir en ") + sigue.nombre : "Listo";
    $("cambioBtn").classList.toggle("hidden", !conSigue);
    $("cambioBtn").textContent = cierra.codigo === "ALMU" ? "Volví · elegir otra área" : "Cambiar de área / no sigo";
    $("salidaBox").classList.toggle("hidden", modo === "fin" || almorzar || cierra.codigo === "ALMU");
    $("cantAlmuBtn").classList.toggle("hidden", !areaDe("ALMU"));
    show("cantScreen");
    if (pideCant) $("cantInput").focus(); else if (conSigue && sigue.pide_codigo) $("sigueInput").focus();
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
    const sigue = seguir && p.modo !== "fin" ? p.sigue : null;
    let nuevo = null;
    if (sigue && sigue.pide_codigo) {
      nuevo = validarCodigo(sigue, $("sigueInput").value);
      if (nuevo.err) { $("sigueError").textContent = nuevo.err; $("sigueInput").focus(); return; }
      const avisoS = nuevo.nuevo ? null : fueraDeContraido(sigue, nuevo.guardo);
      if ((nuevo.nuevo || avisoS) && !confirmoNuevo(nuevo.guardo, "sigueError", "cantBtn", avisoS)) return;
    }
    registrar(p.cierra, { ts_inicio: p.ab.ts_cliente, cantidad: cant, texto: p.ab.texto || "", medida: p.ab.medida || "" });
    // 1.17: si sigue con un set de 3 en Montaje / Gancho, primero cierra y después pregunta la medida
    if (sigue && nuevo && piezasSet(sigue, nuevo.cod)) {
      flush(); const s2 = sigue, n2 = nuevo; st.pend = null; restaurarBtn("cantBtn");
      pedirMedida(s2, n2.guardo, piezasSet(s2, n2.cod)); return;
    }
    if (sigue) registrar(sigue, nuevo ? { texto: nuevo.guardo } : null, 1);
    if (p.modo === "fin") registrarFin();
    flush();
    toast(p.modo === "fin" ? "🏁 Terminaste el día. ¡Hasta mañana!" :
          (p.cierra.codigo === "ALMU" ? "✓ Volviste de almorzar" : "✓ Terminaste " + p.cierra.nombre) +
          (cant != null ? " · " + num(cant) + " " + p.cierra.unidad : "") +
          (sigue ? (sigue.codigo === "ALMU" ? " · buen provecho 🍽️" : " · seguís en " + sigue.nombre + (nuevo ? " · " + nuevo.guardo : "")) : ""));
    st.pend = null; restaurarBtn("cantBtn");
    if (p.modo === "fin") { finDelDia(); return; }
    show("optionsScreen"); renderBotonera();
  }

  // empezar un área: si pide código, primero «¿Qué vas a grampear?»
  function verbo(a) {
    const n = String(a.nombre || "").toLowerCase();
    return /ado$/.test(n) ? "¿Qué vas a " + n.replace(/ado$/, "ar") + "?" : "¿Qué código vas a hacer en " + a.nombre + "?";
  }
  // input de código: teclado numérico si todos los códigos del área son números; abajo, qué es lo tipeado
  const OPCIONES_MAX = 6;
  // opciones = pocas y con nombre (INSUMO, MOLDURA); una lista de números siempre se tipea
  function esOpciones(a) { const l = codigosDe(a); return l.length > 0 && l.length <= OPCIONES_MAX && l.every((c) => /^[A-ZÁÉÍÓÚÑ ]+$/i.test(c.codigo)); }
  function prepararInput(inputId, hintId, a) {
    const lista = codigosDe(a);
    const el = $(inputId);
    const opts = $(inputId === "codInput" ? "codOpts" : "sigueOpts");
    const conOpc = esOpciones(a);
    el.classList.toggle("hidden", conOpc);
    opts.classList.toggle("hidden", !conOpc);
    opts.innerHTML = conOpc ? lista.map((c) => '<button data-cod="' + esc(c.codigo) + '">' + esc(c.descripcion || c.codigo) + "</button>").join("") : "";
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
    $("codLabel").textContent = esOpciones(a) ? "¿" + codigosDe(a).map((c) => c.descripcion || c.codigo).join(" o ") + "?" : verbo(a);
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
    const piezas = piezasSet(a, r.cod);
    if (piezas) { st.codPara = null; pedirMedida(a, r.guardo, piezas); return; }
    registrar(a, { texto: r.guardo }, 1); flush();
    const c = r.cod;
    toast("✓ Empezaste " + a.nombre + " · " + r.guardo + (c && c.descripcion ? " " + c.descripcion + (c.medida ? " " + c.medida : "") : ""));
    st.codPara = null; show("optionsScreen"); renderBotonera();
  }
  // 1.17 (Thomas): un SET DE 3 en Montaje o Gancho se trabaja por medida: se pregunta cuál va a hacer.
  const AREAS_POR_MEDIDA = ["MONT", "GANCHO"];
  function piezasSet(a, cod) {
    if (!a || !cod || AREAS_POR_MEDIDA.indexOf(a.codigo) < 0) return null;
    if (!/\bset\s*x\s*3\b/i.test(cod.descripcion || "") || !cod.medida) return null;
    const p = String(cod.medida).split("+").map((x) => x.trim()).filter(Boolean);
    return p.length === 3 ? p : null;
  }
  function pedirMedida(a, codigo, piezas) {
    st.medPara = { a, codigo };
    $("medTitulo").textContent = "Empecé " + a.nombre + " · " + codigo;
    $("medLabel").textContent = a.codigo === "GANCHO" ? "¿A qué medida le vas a poner gancho?" : "¿Qué medida vas a montar?";
    $("medOpts").innerHTML = piezas.map((m) => '<button data-med="' + esc(m) + '">' + esc(m) + "</button>").join("");
    show("medScreen");
  }
  function elegirMedida(m) {
    const p = st.medPara; if (!p) return;
    registrar(p.a, { texto: p.codigo, medida: m }, 1); flush();
    toast("✓ Empezaste " + p.a.nombre + " · " + p.codigo + " (" + m + ")");
    st.medPara = null; show("optionsScreen"); renderBotonera();
  }
  function cancelarCod() { st.codPara = null; show("optionsScreen"); renderBotonera(); }

  function renderHist() {
    const evs = eventosHoy().filter((r) => r.opcion === "AREA" || r.opcion === "FIN");
    if (!evs.length) { $("hist").innerHTML = '<div class="hist-vacio">Sin registros hoy.</div>'; return; }
    const pend = new Set(cola().map((x) => x.client_id));
    // un renglón por tramo: el cierre trae la duración y la cantidad; una apertura sin cierre es «en curso»
    const cerradas = new Set(evs.filter((r) => r.ts_inicio).map((r) => r.rubro + "|" + r.ts_inicio));
    const filas = evs.filter((r) => r.opcion === "FIN" || r.ts_inicio || !cerradas.has(r.rubro + "|" + r.ts_cliente));
    $("hist").innerHTML = filas.slice().reverse().map((r) => {
      if (r.opcion === "FIN") return '<div class="hist-row fin"><div class="hist-main"><div class="hist-area">🏁 Terminó el día</div></div>' +
        '<div class="hist-cant">' + hhmm(r.ts_cliente) + "</div></div>";
      const a = areaDe(r.rubro), p = pend.has(r.client_id) ? " ⏳" : "";
      const nom = (ICONO[r.rubro] || "🏷️") + " " + esc(a ? a.nombre : r.rubro) + (r.texto ? " · " + esc(r.texto) : "") + (r.medida ? " (" + esc(r.medida) + ")" : "");
      if (!r.ts_inicio) return '<div class="hist-row curso"><div class="hist-main"><div class="hist-area">' + nom +
        '</div><div class="hist-det">Desde ' + hhmm(r.ts_cliente) + p + '</div></div><div class="hist-cant">en curso</div></div>';
      return '<div class="hist-row"><div class="hist-main"><div class="hist-area">' + nom + '</div><div class="hist-det">' +
        hhmm(r.ts_inicio) + " – " + hhmm(r.ts_cliente) + p + " · " + dur(new Date(r.ts_cliente) - new Date(r.ts_inicio)) +
        '</div></div><div class="hist-cant">' + (r.cantidad == null ? "—" : num(r.cantidad)) + "</div></div>";
    }).join("");
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
    st.principal = r.principal || null;
    st.empsPlantas = {}; emps.forEach((e) => { st.empsPlantas[e.id] = e.plantas || []; });
    $("nombreLista").innerHTML = emps.length ? emps.map((e) =>
      '<button data-id="' + e.id + '" data-nombre="' + esc(e.nombre) + '" data-ini="' +
        esc(e.nombre.split(/\s+/).map((x) => x[0] || "").join("").slice(0, 2).toUpperCase()) + '">' + esc(e.nombre) + "</button>").join("") :
      '<div class="error">No hay empleados cargados en GT.</div>';
    show("nombreScreen");
  }

  async function cargarAreas() {
    // 1.22: gt_botones2 trae la planta de cada área; si no está, gt_botones (todas de la principal)
    try { st.areas = await rpc("gt_botones2", {}); lsSet(LS_AREAS, st.areas); }
    catch {
      try { st.areas = await rpc("gt_botones", {}); lsSet(LS_AREAS, st.areas); }
      catch { st.areas = lsGet(LS_AREAS, []); }
    }
    try { st.codigos = await rpc("gt_codigos_area", {}); lsSet(LS_CODS, st.codigos); }
    catch { st.codigos = lsGet(LS_CODS, []); }
  }
  async function cargarHoy() {
    try { st.server = (await rpc("gt_registros_hoy2", { p_empleado: st.emp })).map((r) => Object.assign({ empleado_id: st.emp }, r)); }
    catch { /* sin red: se arma con la cola */ }
  }

  // 2) entra con el empleado elegido (o con la sesión del día, sin pedir código)
  // 1.22: después del nombre, si trabaja en más de una planta, «¿En qué planta trabajás hoy?»
  function elegirEmpleado(id, nombre) {
    const pl = (st.empsPlantas && st.empsPlantas[id]) || [];
    if (pl.length < 2) { entrar(id, nombre, pl[0] ? pl[0].codigo : null, pl, st.principal); return; }
    st.elige = { id, nombre, plantas: pl, cambio: false };
    mostrarPlantas();
  }
  function mostrarPlantas() {
    const e = st.elige;
    $("plantaTitulo").textContent = e.nombre;
    $("plantaOpts").innerHTML = e.plantas.map((p) => '<button data-planta="' + esc(p.codigo) + '">' + esc(p.nombre) + "</button>").join("");
    show("plantaScreen");
  }
  function cambiarPlanta() {
    if (abierta() || st.plantas.length < 2) return;
    st.elige = { id: st.emp, nombre: st.nombre, plantas: st.plantas, cambio: true };
    mostrarPlantas();
  }
  function elegirPlanta(cod) {
    const e = st.elige; if (!e) return;
    st.elige = null;
    if (e.cambio) {
      st.planta = cod; guardarSesion(); ponerNombre(); show("optionsScreen"); renderBotonera();
      toast("🏭 Ahora en " + nombrePlanta(cod)); return;
    }
    entrar(e.id, e.nombre, cod, e.plantas, st.principal);
  }
  function nombrePlanta(cod) { const p = st.plantas.find((x) => x.codigo === cod); return p ? p.nombre : cod || ""; }
  function ponerNombre() { $("opName").textContent = st.nombre + (st.plantas.length > 1 && st.planta ? " · " + nombrePlanta(st.planta) : ""); }
  function guardarSesion() {
    lsSet(LS_SESION, { id: st.emp, nombre: st.nombre, dia: hoyAR(), planta: st.planta, plantas: st.plantas, principal: st.principal });
  }
  async function entrar(id, nombre, planta, plantas, principal) {
    st.emp = Number(id); st.nombre = nombre;
    st.planta = planta || null; st.plantas = plantas || []; st.principal = principal || null;
    guardarSesion();
    ponerNombre();
    show("optionsScreen");
    await Promise.all([cargarAreas(), cargarHoy()]);
    renderBotonera(); flush();
    // 1.21 (D44): si ya había terminado el día, puede seguir, pero la base avisa por Telegram (una vez por «Terminar día»)
    const hoy = eventosHoy(), ult = hoy[hoy.length - 1];
    if (ult && ult.opcion === "FIN") rpc("gt_reingreso", { p_empleado: st.emp }).catch(() => { /* sin red: avisa el primer registro */ });
  }

  // 1.20 (Thomas): al terminar el día vuelve a la pantalla del código de la TV (cierra la sesión).
  // La cola sigue mandando lo pendiente: cada fila ya lleva su empleado_id.
  function finDelDia() {
    try { localStorage.removeItem(LS_SESION); } catch { /* nada */ }
    st.emp = null; st.server = []; $("claveInput").value = ""; $("histPop").classList.add("hidden");
    show("claveScreen");
  }
  function salir() {
    if (abierta() && !confirm("Tenés un área sin terminar. ¿Cambiar de operario igual? (queda abierta)")) return;
    try { localStorage.removeItem(LS_SESION); } catch { /* nada */ }
    st.emp = null; st.server = []; $("claveInput").value = ""; $("histPop").classList.add("hidden");
    show("claveScreen");
  }

  /* ---------- eventos ---------- */
  $("verBadge").textContent = "v" + CFG.APP_VERSION;
  $("claveBtn").onclick = validarClave;
  $("claveInput").addEventListener("keydown", (e) => { if (e.key === "Enter") validarClave(); });
  $("nombreLista").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) elegirEmpleado(b.dataset.id, b.dataset.nombre); });
  $("plantaOpts").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) elegirPlanta(b.dataset.planta); });
  $("plantaVolver").onclick = () => { const c = st.elige && st.elige.cambio; st.elige = null; show(c ? "optionsScreen" : "nombreScreen"); };
  $("plantaBtn").onclick = cambiarPlanta;
  $("nombreVolver").onclick = () => show("claveScreen");
  $("botonera").addEventListener("click", (e) => { const b = e.target.closest(".box, .termine-btn"); if (b) tocar(b.dataset.cod); });
  $("salirBtn").onclick = salir;
  $("almuBtn").onclick = () => tocar("ALMU");
  $("finBtn").onclick = terminarDia;
  $("cantBtn").onclick = () => confirmarCant(true);
  $("cambioBtn").onclick = () => confirmarCant(false);
  $("cantAlmuBtn").onclick = () => { if (!st.pend) return; st.pend.sigue = areaDe("ALMU"); st.pend.modo = "normal"; confirmarCant(true); };
  $("cantFinBtn").onclick = () => { if (!st.pend) return; st.pend.modo = "fin"; confirmarCant(false); };
  $("cantInput").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (st.pend && st.pend.sigue.pide_codigo) $("sigueInput").focus(); else confirmarCant(true);
  });
  $("sigueInput").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmarCant(true); });
  $("siguePend").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { $("sigueInput").value = b.dataset.cod; confirmarCant(true); } });
  $("cantVolver").onclick = () => { st.pend = null; show("optionsScreen"); };
  $("codBtn").onclick = confirmarCod;
  $("medOpts").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) elegirMedida(b.dataset.med); });
  $("medVolver").onclick = () => { st.medPara = null; show("optionsScreen"); renderBotonera(); };
  $("codInput").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmarCod(); });
  $("codVolver").onclick = cancelarCod;
  $("codOpts").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { $("codInput").value = b.dataset.cod; confirmarCod(); } });
  $("sigueOpts").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { $("sigueInput").value = b.dataset.cod; confirmarCant(true); } });
  ["codInput", "sigueInput"].forEach((id) => $(id).addEventListener("input", (e) => {
    mostrarHint(e.target); $(id === "codInput" ? "codError" : "sigueError").textContent = "";
    restaurarBtn(id === "codInput" ? "codBtn" : "cantBtn");
  }));
  $("codPend").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { $("codInput").value = b.dataset.cod; confirmarCod(); } });
  $("histBtn").onclick = () => { renderHist(); $("histPop").classList.remove("hidden"); document.body.classList.add("sin-scroll"); };
  const cerrarHist = () => { $("histPop").classList.add("hidden"); document.body.classList.remove("sin-scroll"); };
  $("histCerrar").onclick = cerrarHist;
  $("histPop").addEventListener("click", (e) => { if (e.target === $("histPop")) cerrarHist(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarHist(); });
  window.addEventListener("online", flush);
  setInterval(flush, 30000);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

  const ses = lsGet(LS_SESION, null);
  if (ses && ses.dia === hoyAR() && ses.id) entrar(ses.id, ses.nombre, ses.planta, ses.plantas, ses.principal);
  else show("claveScreen");

  // v1.2: la app se actualiza sola. GitHub Pages deja la página en caché hasta 10 min y nadie avisaba:
  // cada 2 min se lee version.json (sin caché); si hay una más nueva y el operario no está en medio de
  // una carga (pantalla de áreas o de ingreso, sin tipear), se recarga con ?v=<nueva> para saltear la caché.
  function verNum(v) { const [a, b] = String(v).split(".").map(Number); return (a || 0) * 1000 + (b || 0); }  // 1.10 > 1.9
  async function chequearVersion() {
    try {
      const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
      const v = (await r.json()).version;
      if (verNum(v) <= verNum(CFG.APP_VERSION)) return;
      const enCarga = !$("cantScreen").classList.contains("hidden") || !$("codScreen").classList.contains("hidden") ||
                      (document.activeElement && document.activeElement.tagName === "INPUT");
      if (enCarga) return;                                   // se reintenta en la próxima vuelta
      if (new URLSearchParams(location.search).get("v") === v) return;   // ya recargó con ésa: no entra en bucle
      location.replace(location.pathname + "?v=" + encodeURIComponent(v));
    } catch { /* sin red: no pasa nada */ }
  }
  setInterval(chequearVersion, 120000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) chequearVersion(); });
  chequearVersion();

  window.__gt = { st, abierta, eventosHoy, flush, verNum };   // para tests
})();

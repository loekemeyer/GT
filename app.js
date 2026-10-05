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
 * 1.25: Pintado cuenta PAQUETES al terminar (Thomas, D8): «¿Cuántos paquetes de moldura 03?».
 * 1.24: PREGUNTAS POR ÁREA (Thomas, Esnaola). Moldurado: «¿Qué moldura?» al empezar y metros al terminar. Lijado: moldura,
 *       «¿Le ponés anilina?» y, si es Sí, el color; metros al terminar. Pintado: color y moldura. Las preguntas salen de
 *       gt.rubro_pasos (gt_pasos): botones, condición (si_campo = si_valor) y momento (empezar / terminar). La moldura
 *       va en `texto`; lo demás en `detalle` (jsonb). El cierre lleva el detalle de la apertura.
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
  const LS_PASOS = "gt_pasos_v1";
  const LS_DISP = "gt_dispositivo";
  const LS_LLAVE = "gt_llave_v1";   // 1.53: la clave personal del encargado en SU celular { llave, nombre, da }
  const TIMEOUT_MS = 15000;

  const $ = (id) => document.getElementById(id);
  const st = { emp: null, nombre: null, areas: [], codigos: [], server: [], pend: null, codPara: null, pendCont: null,
              planta: null, plantas: [], principal: null, pasos: [], paso: null,
              vista: false, vistaClave: false, sim: [] };

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
  function show(id) {
    ["claveScreen", "nombreScreen", "plantaScreen", "optionsScreen", "cantScreen", "codScreen", "medScreen", "pasoScreen"].forEach((s) => $(s).classList.toggle("hidden", s !== id));
    acomodar();
  }
  function acomodar() { acomodarNombres(); acomodarAreas(); }   // cada una sale sola si su pantalla no está a la vista

  // 1.29 / 1.30: cuántas columnas y qué alto de fila para que `lugares` celdas entren enteras en W × H, en cualquier pantalla.
  // Prueba de 1 a 6 columnas: primero lo que entra sin scroll (fila ≥ o.minH, columna ≥ o.minW); entre lo que entra, la
  // celda más pareja (alto topeado en o.maxH contra o.k × ancho); a igualdad, menos columnas. Si nada entra, la menos mala
  // con la fila en o.minH (y scroll).
  function elegirGrilla(W, H, gap, lugares, o) {
    let mejor = null;
    for (let c = 1; c <= 6; c++) {
      const w = (W - gap * (c - 1)) / c;
      if (c > 1 && w < o.minW) break;
      const f = Math.ceil(lugares / c), h = (H - gap * (f - 1)) / f;
      const op = { c, w, h: Math.min(h, o.maxH), entra: h >= o.minH };
      op.nota = Math.min(op.h, w * o.k);
      if (!mejor || (op.entra && !mejor.entra) || (op.entra === mejor.entra && op.nota > mejor.nota + 0.5)) mejor = op;
    }
    return { c: mejor.c, w: mejor.w, alto: Math.max(o.minH, Math.floor(mejor.h)) };
  }

  // 1.29 (pedido 02/10: «que puedan aparecer 16 operarios en la pantalla… de cualquier dispositivo»): «¿Quién sos?» se arma
  // para NOMBRES_LUGARES operarios aunque haya menos, así el botón no cambia de tamaño al dar de alta a alguien. Botón de
  // 48 a 96 px de alto y 88 px de ancho o más. Con más operarios que lugares se arma para todos, y si no entran queda scroll
  // dentro de la lista.
  const NOMBRES_LUGARES = 16;
  function acomodarNombres() {
    const L = $("nombreLista"), n = L.querySelectorAll("button").length;
    if (!n || $("nombreScreen").classList.contains("hidden")) return;
    const cs = getComputedStyle(L), gap = parseFloat(cs.rowGap) || 8;
    const W = L.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const H = L.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const g = elegirGrilla(W, H, gap, Math.max(n, NOMBRES_LUGARES), { minH: 48, maxH: 96, minW: 88, k: 0.4 }), alto = g.alto;
    L.style.setProperty("--cols", g.c);
    L.style.setProperty("--alto", alto + "px");
    L.style.setProperty("--ini", Math.round(Math.min(40, alto * 0.62)) + "px");
    // la letra más grande con la que cada palabra entra entera y el nombre no pasa del botón; si no entra, sin el círculo de
    // iniciales (el nombre centrado); y si ni con 13 px entra, se parte la palabra
    const spans = [...L.querySelectorAll("button span")];
    const entra = () => spans.every((x) => x.scrollWidth <= x.clientWidth + 1 && x.offsetHeight <= alto - 6);
    const tope = Math.round(Math.max(14, Math.min(20, alto * 0.32)));
    L.classList.remove("parte");
    for (const ini of g.w >= 130 ? [true, false] : [false]) {
      L.classList.toggle("sin-ini", !ini);
      for (let letra = tope; letra >= (ini ? 15 : 13); letra--) {
        L.style.setProperty("--letra", letra + "px");
        if (entra()) return;
      }
    }
    L.classList.add("parte");
  }

  // 1.30 (Elías, 02/10: «ahora aplicá lo mismo a esta botonera, y centrá el texto y la imagen al botón»): las áreas entran
  // enteras en el lugar que dejan el encabezado y los botones de abajo (Almuerzo, Terminar día, Resumen), con el ícono y el
  // nombre centrados. Tarjeta de 48 a 120 px de alto y 88 px de ancho o más; en pantallas bajas los botones de abajo van en
  // una sola fila y el encabezado se achica (styles.css) para dejarle el alto a las áreas.
  function acomodarAreas() {
    const B = $("botonera"), R = B.querySelector(".row");
    if (!R || $("optionsScreen").classList.contains("hidden")) return;
    B.classList.add("midiendo");                      // mientras mide, la botonera ocupa todo el lugar libre
    const cs = getComputedStyle(R), gap = parseFloat(cs.rowGap) || 10;
    const W = R.clientWidth, H = B.clientHeight - parseFloat(cs.marginTop);
    B.classList.remove("midiendo");
    const g = elegirGrilla(W, H, gap, R.children.length, { minH: 48, maxH: 120, minW: 88, k: 0.7 });
    R.style.setProperty("--cols", g.c);
    R.style.setProperty("--alto", g.alto + "px");
    R.style.setProperty("--ico", Math.round(Math.max(20, Math.min(40, g.alto * 0.3))) + "px");
    // la letra más grande con la que el nombre entra en la tarjeta sin partir palabras. Si no entra: sin el «Empezar» (todas
    // lo dicen); después, con la tarjeta baja (celular acostado), el ícono al costado del nombre, los dos centrados; y si ni
    // con 12 px entra, se parte la palabra
    const cajas = [...R.children];
    const entra = () => cajas.every((b) => b.scrollWidth <= b.clientWidth + 1 && b.scrollHeight <= b.clientHeight + 1);
    const tope = Math.round(Math.max(14, Math.min(19, g.alto * 0.2, g.w * 0.13)));
    R.classList.remove("parte");
    for (const forma of (g.alto >= 84 ? ["desc"] : []).concat(["", "fila"])) {
      R.classList.toggle("sin-desc", forma !== "desc");
      R.classList.toggle("fila", forma === "fila");
      for (let letra = tope; letra >= 12; letra--) {
        R.style.setProperty("--letra", letra + "px");
        if (entra()) return;
      }
    }
    R.classList.add("parte");
  }

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
  // 1.52 (Thomas: «con la clave 1411… ver exactamente la misma visual que los operarios, pero sin registrarle fichadas»):
  // en MODO VISTA la cola es st.sim, sólo en memoria: lo que se toque se ve igual que en el celular del operario, pero no
  // sale a la base (ni el INGRESO) y se pierde al salir o recargar
  function cola() { return st.vista ? st.sim : lsGet(LS_QUEUE, []); }
  function guardarCola(q) { if (st.vista) st.sim = q; else lsSet(LS_QUEUE, q); }
  function syncBadge() {
    const n = cola().length, b = $("syncBadge");
    b.textContent = st.vista ? "👁 Vista · no graba" : n ? "⏳ " + n + " sin enviar" : "✓ al día";
    b.classList.toggle("pend", n > 0 && !st.vista);
    b.classList.toggle("vista", st.vista);
  }
  let flushing = false;
  async function flush() {
    if (flushing) return;
    if (st.vista) { syncBadge(); return; }   // 1.52: en modo vista no se manda nada
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
  // 1.24: el detalle en una línea (≡ gt.detalle_txt): «anilina Cedro», «sin anilina», «Blanco total»
  function detalleTxt(d) {
    if (!d || typeof d !== "object" || !Object.keys(d).length) return "";
    if (d.anilina === "No") return "sin anilina";
    if (d.anilina === "Sí") return "anilina " + (d.color || "?");
    return Object.keys(d).filter((k) => k[0] !== "_").map((k) => d[k]).join(" · ");   // 1.39: «_invitado» es interno
  }
  // lo que se está haciendo, en una línea: «012 · anilina Cedro», «136 (30*40)»
  function etq(r) {
    let s = r.texto || "";
    if (r.medida) s += " (" + r.medida + ")";
    const d = detalleTxt(r.detalle);
    if (d) s += (s ? " · " : "") + d;
    return s;
  }
  // el área abierta se DEDUCE de los eventos (servidor + cola), no se guarda aparte.
  // 1.33 (Elías): Baño y Movimiento tocados con un área abierta son una PAUSA dentro de esa área, no la cierran: la pila
  // del día tiene abajo el área y arriba la pausa. Abrir otra cosa reemplaza todo (como siempre); un cierre saca su área
  // y lo que tenga encima.
  const PAUSA_DENTRO = ["BANO", "MOVIM", "LIMP"];   // 1.54: Limpieza, igual que Movimientos
  function pilaAbierta() {
    let p = [];
    eventosHoy().forEach((r) => {
      if (r.opcion !== "AREA") return;
      if (!r.ts_inicio) {
        // 1.36 (Elías: «dentro de movimiento también puede ir al baño»): Baño va encima de un área o de un Movimiento;
        // Movimiento, sólo encima de un área
        const top = p[p.length - 1];
        const encima = top && top.rubro !== "ALMU" && PAUSA_DENTRO.includes(r.rubro) &&
          (r.rubro === "BANO" ? top.rubro !== "BANO" : !PAUSA_DENTRO.includes(top.rubro));
        if (encima) p.push(r); else p = [r];
        return;
      }
      const j = p.map((x) => x.rubro).lastIndexOf(r.rubro);
      if (j >= 0) p = p.slice(0, j);
    });
    return p;
  }
  function abierta() { const p = pilaAbierta(); return p.length ? p[p.length - 1] : null; }
  function enPausa() { const p = pilaAbierta(); return p.length > 1 ? p[p.length - 2] : null; }   // lo que quedó en pausa justo debajo

  function registrar(area, extra, offsetMs) {
    const fila = Object.assign({
      client_id: uuid(), empleado_id: st.emp, opcion: "AREA", rubro: area.codigo,
      descripcion: area.nombre, texto: "", cantidad: null,
      ts_cliente: new Date(Date.now() + (offsetMs || 0)).toISOString(), ts_inicio: null,
      dispositivo: dispositivo(), planta: st.planta,
    }, extra || {});
    const q = cola(); q.push(fila); guardarCola(q);
    return fila;
  }

  /* ---------- botonera de áreas ---------- */
  // v1.1: ícono por área (se ve en la tarjeta); un área nueva sin ícono usa 🏷️
  const ICONO = { CORTE: "✂️", GRAMP: "📌", ENCOL: "🧴", MONT: "🛠️", GANCHO: "🪝", EMBL: "📦", CONTR: "🎞️",
                  PED: "🧾", DECO: "🎨", PAPENC: "🔧", ISIS: "💻", OP: "📝", FACT: "💵", GUARD: "🗄️", RECIB: "🚚", MOVIM: "🔄", LIMP: "🧹", BANO: "🚻", ALMU: "🍽️", MOLDU: "🪚", LIJA: "🧽", PINT: "🖌️" };
  // 1.50 (05/10/2026: «dentro de encolado, apenas entrar, un botón que sea puesta a punto encoladora»): un área que vive
  // DENTRO de otra no va en la botonera: es un botón en la pantalla del código de su área. Sin pide_codigo ni cantidad
  // (gt.rubros). Al terminarla se propone seguir en el área madre
  const DENTRO_DE = { PAPENC: "ENCOL" };
  function hijasDe(a) { return st.areas.filter((x) => DENTRO_DE[x.codigo] === a.codigo && deLaPlanta(x) && delEmp(x)); }
  // 1.52 (gt_v162): un área con «solo» (gt.empleado_rubro) es sólo de esos empleados (Javier: ISIS, OP, Facturación)
  function delEmp(a) { return !Array.isArray(a.solo) || a.solo.includes(Number(st.emp)); }
  // 1.22: un área es de la planta elegida; un área sin planta es de la principal
  function deLaPlanta(a) { return (a.planta || st.principal || null) === (st.planta || st.principal || null); }
  function transcurrido(iso, pausaMs) {
    const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime() - (pausaMs || 0)) / 60000));
    return m < 60 ? m + " min" : Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0");
  }
  // 1.34 (Elías: «tenía 2 min encolando, fui al baño 6-7 y al regresar aparecieron 9 min de encolando»): el tiempo de un
  // área no cuenta las pausas (Baño, Movimiento) que hubo adentro, igual que el ritmo y la Producción del admin (gt_v147).
  // Suma las pausas ya cerradas que empezaron después de abrir el área y terminaron antes de «hasta» (o de ahora).
  // 1.36: un Movimiento descuenta el baño que tuvo adentro, y un baño dentro de un movimiento se descuenta una sola vez
  // del área de abajo (se suma la unión de los tramos de pausa, no cada uno)
  function pausasDentro(rubro, desde, hasta) {
    if (rubro === "BANO") return 0;
    const d = new Date(desde).getTime(), h = hasta ? new Date(hasta).getTime() : Date.now();
    const iv = eventosHoy().filter((r) => r.opcion === "AREA" && PAUSA_DENTRO.includes(r.rubro) && r.rubro !== rubro && r.ts_inicio &&
        new Date(r.ts_inicio).getTime() >= d && new Date(r.ts_cliente).getTime() <= h)
      .map((r) => [new Date(r.ts_inicio).getTime(), new Date(r.ts_cliente).getTime()]).sort((a, b) => a[0] - b[0]);
    let tot = 0, cur = null;
    iv.forEach(([a, b]) => { if (!cur || a > cur[1]) { if (cur) tot += cur[1] - cur[0]; cur = [a, b]; } else cur[1] = Math.max(cur[1], b); });
    return cur ? tot + cur[1] - cur[0] : tot;
  }
  function renderBotonera() {
    const ab = abierta(), base = enPausa();
    const hoy = eventosHoy().filter((r) => r.opcion !== "INGRESO"), ult = hoy[hoy.length - 1];
    const finDia = !ab && ult && ult.opcion === "FIN";
    $("abiertaBox").classList.toggle("hidden", !ab && !finDia);
    $("abiertaBox").classList.toggle("fin", !!finDia);
    if (finDia) $("abiertaBox").innerHTML = '<div class="ab-txt"><div class="ab-area">🏁 Día terminado a las ' + hhmm(ult.ts_cliente) +
      '</div><div class="ab-det">¡Hasta mañana! Si seguís trabajando, tocá un área.</div></div>';
    if (ab) {
      const a = areaDe(ab.rubro);
      $("abiertaBox").innerHTML = '<span class="ab-punto"></span><div class="ab-txt"><div class="ab-area">' +
        (ICONO[ab.rubro] || "🏷️") + " " + esc(a ? a.nombre : ab.rubro) + (etq(ab) ? " · " + esc(etq(ab)) : "") +
        '</div><div class="ab-det">Desde las ' + hhmm(ab.ts_cliente) + (ab.rubro === "ALMU" ? " · tocá «Volví de almorzar»" : "") +
        (base ? " · " + (ICONO[base.rubro] || "") + " " + esc((areaDe(base.rubro) || { nombre: base.rubro }).nombre) + " en pausa" : "") +
        (!base && quienCarga(ab) ? " · 📝 " + esc(quienCarga(ab)) : "") + "</div></div>" +
        '<div class="ab-tiempo" data-desde="' + esc(ab.ts_cliente) + '" data-pausa="' + pausasDentro(ab.rubro, ab.ts_cliente, null) + '">' +
        transcurrido(ab.ts_cliente, pausasDentro(ab.rubro, ab.ts_cliente, null)) + "</div>";
    }
    // v1.8 (Thomas): con un sector abierto NO se ofrecen los otros: sólo «Terminé», que pide cuánto hizo
    // (y ahí mismo «¿con qué seguís?»). Con el almuerzo abierto, sólo «Volví de almorzar».
    // 1.33 (Elías): con un área abierta, además de «Terminé», Baño y Movimiento (pausas dentro del área); con la pausa
    // abierta, sólo volver de ella
    if (ab) {
      // con un área: Baño y Movimiento · con un Movimiento: sólo Baño (1.36) · con el Baño o el almuerzo: nada
      const pausas = (ab.rubro === "ALMU" || ab.rubro === "BANO" ? [] : PAUSA_DENTRO.includes(ab.rubro) ? ["BANO"] : PAUSA_DENTRO)
        .map((c) => st.areas.find((x) => x.codigo === c && deLaPlanta(x))).filter(Boolean);
      $("botonera").innerHTML = ab.rubro === "ALMU" ? "" :
        // 1.47 (Elías: «el que acompaña al que empezó no tiene botón de Terminé, tiene botón de Me fui»)
        '<button class="termine-btn' + (!base && esInvitado(ab) ? " mefui" : "") + '" data-cod="' + esc(ab.rubro) + '">' +
        (base ? (ab.rubro === "BANO" ? "✅ Volví del baño" : ab.rubro === "LIMP" ? "✅ Terminé la limpieza" : "✅ Terminé el movimiento") : esInvitado(ab) ? "🚪 Me fui" : "✅ Terminé") + "</button>" +
        (pausas.length ? '<div class="pausas">' + pausas.map((x) => '<button class="sec-btn pausa-btn" data-pausa="' + esc(x.codigo) + '">' +
          (ICONO[x.codigo] || "🏷️") + " " + esc(x.nombre) + "</button>").join("") + "</div>" : "");
    } else $("botonera").innerHTML = st.areas.some((a) => a.codigo !== "ALMU" && !DENTRO_DE[a.codigo] && deLaPlanta(a) && delEmp(a)) ?
      '<div class="row">' + st.areas.filter((a) => a.codigo !== "ALMU" && !DENTRO_DE[a.codigo] && deLaPlanta(a) && delEmp(a)).map((a) => {
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
    $("almuBtn").textContent = ab && ab.rubro === "ALMU" ? "🍽️ Volví de almorzar" : "🍽️ Almuerzo";
    $("almuBtn").classList.toggle("activo", !!(ab && ab.rubro === "ALMU"));
    acomodarAreas();
    syncBadge();
    pintarMuerto();
    if (!$("histPop").classList.contains("hidden")) renderHist();
  }
  // 1.43 (Elías: «agregale un contador de tiempo muerto abajo del nombre. Se reinicia a 0 cuando empiezan una tarea y vuelve
  // a contar cuando le dan a Cambiar de área / no sigo, y también si desde el panel hace Baño o Movimiento (cuando termina
  // regresan al panel)»): corre mientras no hay nada abierto, desde el último cierre o, al empezar el día, desde el ingreso
  // con el código. Con algo abierto (un área, una pausa, el almuerzo) queda en 0
  function desdeMuerto() {
    if (pilaAbierta().length) return null;
    const ev = eventosHoy().filter((r) => r.opcion === "INGRESO" || (r.opcion === "AREA" && r.ts_inicio));
    return ev.length ? ev[ev.length - 1].ts_cliente : null;
  }
  function pintarMuerto() {
    const el = $("muerto"); if (!el || !st.emp || $("optionsScreen").classList.contains("hidden")) return;
    const d = desdeMuerto(), s = d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000)) : 0;
    const m = Math.floor(s / 60), p2 = (n) => String(n).padStart(2, "0");
    // en pantallas angostas el rótulo va abreviado («T. muerto»): con más de una hora no entraba en 320 px
    el.innerHTML = '⏱ <span class="m-l">Tiempo muerto</span><span class="m-c">T. muerto</span> ' +
      (m >= 60 ? Math.floor(m / 60) + ":" + p2(m % 60) + ":" + p2(s % 60) : m + ":" + p2(s % 60));
    el.classList.toggle("corre", !!d);
  }
  setInterval(() => { const t = document.querySelector(".ab-tiempo"); if (t) t.textContent = transcurrido(t.dataset.desde, Number(t.dataset.pausa) || 0); }, 30000);

  function tocar(cod) {
    const a = areaDe(cod); if (!a) return;
    const ab = abierta();
    if (!ab) { empezar(a); return; }
    if (ab.rubro === cod && PAUSA_DENTRO.includes(cod)) { terminarPausa(ab); return; }
    if (ab.rubro === cod && esInvitado(ab)) { meFui(ab); return; }   // 1.47: el que se sumó no termina, se va
    // v9.0: terminar la abierta y, EN LA MISMA PANTALLA, «¿con qué seguís?». Por defecto se sigue en
    // la misma área (lo normal en el día); si tocó otra, se propone ésa.
    const cierra = areaDe(ab.rubro) || { codigo: ab.rubro, nombre: ab.rubro, unidad: "cantidad" };
    let sigue = ab.rubro === cod ? cierra : a;
    // v1.3: al volver de almorzar se propone el área en la que estaba antes. 1.28 (D31): lo mismo al terminar Movimientos
    if (ab.rubro === cod && PAUSAS.includes(cod)) sigue = areaAntesDelAlmuerzo(ab);
    if (ab.rubro === cod && DENTRO_DE[cod]) sigue = areaDe(DENTRO_DE[cod]) || cierra;   // 1.50: de la puesta a punto, a encolar
    abrirTermine(ab, cierra, sigue, "normal");
  }

  // 1.33 (Elías): Baño / Movimiento tocados con un área abierta: el área queda en pausa (no se cierra ni pide cantidad)
  function pausar(cod) {
    const a = st.areas.find((x) => x.codigo === cod && deLaPlanta(x)) || areaDe(cod); if (!a) return;
    const ab = abierta(); if (!ab) { empezar(a); return; }
    const b = areaDe(ab.rubro) || { nombre: ab.rubro };
    const listo = (x) => {
      registrar(a, x, 1); flush();
      toast((ICONO[a.codigo] || "") + " " + a.nombre + " · " + b.nombre + " queda en pausa");
      show("optionsScreen"); renderBotonera();
    };
    if (pasosDe(a, "empezar").length) iniciarPasos(a, "empezar", a.nombre + " · " + b.nombre + " en pausa", (resp) => listo(extraDe(resp)),
      () => { show("optionsScreen"); renderBotonera(); });
    else listo(null);
  }
  // 1.33 (Elías): al terminar una pausa. Desde la botonera (sin área debajo): se cierra y vuelve la botonera. Del baño: se
  // sigue en el área. Del movimiento: «¿Seguís con …?»; si no, las cantidades de lo que hizo.
  function terminarPausa(ab) {
    const p = areaDe(ab.rubro) || { codigo: ab.rubro, nombre: ab.rubro };
    const base = enPausa();
    registrar(p, { ts_inicio: ab.ts_cliente, texto: ab.texto || "", detalle: ab.detalle || null });
    flush();
    if (!base) { toast("✓ Terminaste " + p.nombre); show("optionsScreen"); renderBotonera(); return; }
    const b = areaDe(base.rubro) || { codigo: base.rubro, nombre: base.rubro, unidad: "cantidad" };
    // del baño se vuelve a lo de abajo, sea un área o un movimiento (1.36)
    if (ab.rubro === "BANO") { toast("✓ Volviste del baño · seguís en " + b.nombre); show("optionsScreen"); renderBotonera(); return; }
    const inv = esInvitado(base);
    const si = "Sí, sigo en " + b.nombre, no = inv ? "No, me fui de " + b.nombre : "No, terminé " + b.nombre;
    preguntar(ab.rubro === "LIMP" ? "Terminé la limpieza" : "Terminé el movimiento", "¿Seguís con " + b.nombre + (etq(base) ? " · " + etq(base) : "") + "?", [si, no], (v) => {
      if (v === no && inv) { irse(base); return; }   // 1.47: el que se sumó no carga nada: se va sin la pantalla de Terminé
      if (v === no) { abrirTermine(base, b, null, "normal"); return; }
      toast("✓ Seguís en " + b.nombre); show("optionsScreen"); renderBotonera();
    });
  }
  // una pregunta suelta con botones, en la pantalla de preguntas (‹ = la primera opción no elegida: queda como estaba)
  function preguntar(titulo, pregunta, opciones, onElegir, onCancel) {
    st.paso = { a: null, pasos: [{ campo: "_r", pregunta, opciones }], i: -1, resp: {}, vistos: [], titulo,
                onFin: (resp) => onElegir(resp._r), onCancel: onCancel || (() => { show("optionsScreen"); renderBotonera(); }) };
    sigPaso();
  }

  /* ---------- de a dos: Encolado y Contraído (1.39, D45 · desde 1.45 el compañero se suma) ---------- */
  // 1.45 (Elías: «uno inicia la tarea y al otro, al entrar en Encolado, ya le aparece la que inició el compañero y se une.
  // Las unidades las pone el que empezó la tarea y se le notifica que él tiene que poner las unidades»). Reemplaza el
  // «¿Con quién?» y el Sí / No de la 1.39:
  //  · El que empieza: pone el código y arranca, sin preguntar con quién.
  //  · El otro: al tocar Encolado (o Contraído), arriba del código le aparece lo que están haciendo sus compañeros de la
  //    planta (gt_pareja_abiertos): «🤝 Ximena Ortiz · 173». Al tocarlo se le abre ese mismo código con detalle.pareja =
  //    «con Ximena» y _une = la apertura de ella. La base deja la pareja (gt_pareja_une), le pone _invitado (lo que lee el
  //    Rendimiento, repartido por tiempo: gt_v153) y a la apertura de ella «con Walter». Uno solo por tramo.
  //  · Al que empezó, el celular le avisa (gt_pareja_avisos, cada 5 s) en una ventana (1.47): «Walter se sumó a tu
  //    Encolado · 173 … Al terminar, las cajas encoladas las cargás vos: las de los dos», y su área pasa a decir «con Walter».
  //  · El que se sumó no tiene «Terminé» sino «🚪 Me fui» (1.47): cierra sin cajas (las carga Ximena) y vuelve la botonera.
  const DE_A_DOS = ["ENCOL", "CONTR"];
  const LS_AVISOS = "gt_parejas_avisos_v1";   // avisos de «se sumó» ya mostrados en este celular (del día)
  const LS_SOCIO = "gt_pareja_socio_v1";      // 1.48: con quién terminó su último tramo de a dos (para no repetir la ventana)
  function esInvitado(r) { return !!(r && r.detalle && (r.detalle._invitado || r.detalle._une)); }
  function companero(r) { return String((r && r.detalle && r.detalle.pareja) || "").replace(/^con\s+/, ""); }
  // «las cajas encoladas», «los metros»: la unidad del área con su artículo
  function lasUnidades(a) { return a && a.pide_cantidad !== false ? (cuantas(a.unidad) === "¿Cuántos " ? "los " : "las ") + (a.unidad || "cantidades") : ""; }
  // 1.47: en la botonera, quién carga las cantidades de un tramo de a dos
  // 1.48 (D58): si los que se sumaron ya se fueron todos, «todas las del tramo» y quién se fue a qué hora
  function quienCarga(ab) {
    if (!ab || !companero(ab)) return "";
    const u = lasUnidades(areaDe(ab.rubro));
    if (esInvitado(ab)) return (u ? u + " las carga " : "lo que haya que cargar lo carga ") + companero(ab);
    const idos = seFueron(ab);
    if (idos) return idos + " · " + (u ? u + " las cargás vos: todas las del tramo" : "lo que haya que cargar lo cargás vos");
    return u ? u + " las cargás vos: las de " + (companero(ab).includes(" y ") ? "todos" : "los dos") : "lo que haya que cargar lo cargás vos";
  }
  // «Walter Saucedo se fue 10:35» si ninguno de los que se sumaron sigue adentro (st.parejas, de gt_pareja_avisos2)
  function seFueron(ab) {
    const l = (st.parejas || {})[ab.client_id] || [];
    if (!l.length || l.some((x) => !x.se_fue)) return "";
    const x = l[l.length - 1];
    return x.quien + " se fue " + hhmm(x.se_fue);
  }
  // «entre vos y Walter Saucedo», «entre vos, Walter Saucedo y Luis Luna»
  function entreVos(ab) {
    const n = companero(ab).split(" y ");
    return "entre vos" + (n.length > 1 ? ", " + n.slice(0, -1).join(", ") : "") + " y " + n[n.length - 1];
  }
  // «Cuadro Mold 03 Grafic Work · 10*30» de un código del área
  function descCod(rubro, texto) {
    const sin0 = (x) => String(x || "").toUpperCase().replace(/^0+(?=\d)/, "");
    const c = texto ? st.codigos.find((x) => x.rubro === rubro && sin0(x.codigo) === sin0(texto)) : null;
    return c ? [c.descripcion, c.medida].filter(Boolean).join(" · ") : "";
  }
  // 1.47 (Elías: «mejorá los mensajes de se unió y de las unidades las carga»): los avisos de la pareja van en una ventana
  // y no en un toast de 2,5 s (el del que se sumaba no se alcanzaba a leer) ni en la pantalla de preguntas: quién, qué
  // código y, resaltado, quién carga las cantidades. o = { ico, tit, txt, nota, botones: [{ t, sec, fn }], fuera }:
  // tocar afuera, ✕ o Esc = el botón «fuera» (por defecto, el último)
  function aviso(o) {
    st.aviso = o; o.desde = Date.now();
    $("avisoIco").textContent = o.ico || "🤝";
    $("avisoTit").textContent = o.tit;
    $("avisoTxt").innerHTML = o.txt || ""; $("avisoTxt").classList.toggle("hidden", !o.txt);
    $("avisoNota").innerHTML = o.nota || ""; $("avisoNota").classList.toggle("hidden", !o.nota);
    $("avisoBtns").innerHTML = o.botones.map((b, i) => '<button data-i="' + i + '" class="' + (b.sec ? "sec-btn" : "primary-btn") + '">' + esc(b.t) + "</button>").join("");
    $("avisoPop").classList.remove("hidden"); document.body.classList.add("sin-scroll");
  }
  function cerrarAviso(i) {
    const o = st.aviso; if (!o) return;
    st.aviso = null; $("avisoPop").classList.add("hidden"); document.body.classList.remove("sin-scroll");
    const b = o.botones[i == null ? (o.fuera == null ? o.botones.length - 1 : o.fuera) : i];
    if (b && b.fn) b.fn();
  }
  // en la pantalla del código: lo que están haciendo los compañeros, para sumarse
  async function paraUnirse(a) {
    const box = $("codJunta");
    box.classList.add("hidden"); box.innerHTML = ""; st.unirse = [];
    if (!DE_A_DOS.includes(a.codigo)) return;
    let l = [];
    try { l = await rpc("gt_pareja_abiertos", { p_empleado: st.emp, p_rubro: a.codigo }); } catch { return; }   // sin red: arranca solo
    if (!st.codPara || st.codPara.codigo !== a.codigo) return;   // ya salió de la pantalla
    const pl = st.planta || st.principal;
    l = (Array.isArray(l) ? l : []).filter((x) => !pl || !x.planta || x.planta === pl);
    if (!l.length) return;
    st.unirse = l;
    box.innerHTML = '<div class="cod-pend-t">Tocá para sumarte a un compañero</div>' + l.map((x, i) =>
      '<button data-i="' + i + '">🤝 ' + esc(x.de) + (x.texto ? " · " + esc(x.texto) : "") + "<small>" +
      esc([x.descripcion, x.medida || x.medida_cod].filter(Boolean).join(" · ")) + "</small></button>").join("");
    box.classList.remove("hidden");
  }
  function unirse(a, x) {
    if (!a || !x) return;
    st.codPara = null;
    registrar(a, { texto: x.texto || "", medida: x.medida || "", detalle: { pareja: "con " + x.de, _une: x.client_id } }, 1); flush();
    show("optionsScreen"); renderBotonera();
    const u = lasUnidades(a), d = [x.descripcion, x.medida || x.medida_cod].filter(Boolean).join(" · ");
    aviso({ ico: "🤝", tit: "Te sumaste a " + x.de,
      txt: "<b>" + esc(a.nombre + (x.texto ? " · " + x.texto : "")) + "</b>" + (d ? "<br>" + esc(d) : ""),
      nota: "📝 <b>" + esc(u ? cap(u) + " las carga " + x.de : "Lo que haya que cargar lo carga " + x.de) + "</b>: vos no cargás nada." +
        "<br>Cuando te vayas, tocá «🚪 Me fui».",
      botones: [{ t: "Entendido" }] });
  }
  function cap(t) { return t ? t[0].toUpperCase() + t.slice(1) : t; }
  // 1.47: «🚪 Me fui» del que se sumó: cierra su tramo sin cantidad (las carga el que empezó) y vuelve a la botonera.
  // 1.48 (D58): sin confirmar. Ya no hace falta: si se fue sin querer, se vuelve a sumar (el tramo se vuelve a ofrecer) y
  // al que empezó se le avisa que se fue
  function meFui(ab) { irse(ab); }
  function irse(ab, hasta) {
    const a = areaDe(ab.rubro) || { codigo: ab.rubro, nombre: ab.rubro };
    registrar(a, Object.assign({ ts_inicio: ab.ts_cliente, texto: ab.texto || "", medida: ab.medida || "", detalle: ab.detalle || null },
      hasta ? { ts_cliente: hasta } : {})); flush();
    if (!hasta) toast("🚪 Te fuiste del " + a.nombre + (ab.texto ? " · " + ab.texto : "") + " · " + quienCarga(ab));
    show("optionsScreen"); renderBotonera();
  }
  // al que empezó: quién se le sumó (y su área pasa a decir «con …»)
  function avisados() { const r = lsGet(LS_AVISOS, null); return r && r.dia === hoyAR() ? r.ids : []; }
  let revisando = false;
  // 1.48 (D58, Elías: «sí»): gt_pareja_avisos2 trae las dos puntas en una llamada. «sumados»: al que empezó, quién se le sumó
  // y si ya se fue. «terminados»: al que se sumó, que el que empezó ya terminó. Sin la función nueva, gt_pareja_avisos (1.47)
  async function revisarParejas() {
    if (!st.emp || revisando || document.hidden) return;
    revisando = true;
    let r = null;
    try { r = await rpc("gt_pareja_avisos2", { p_empleado: st.emp }); }
    catch { try { r = { sumados: await rpc("gt_pareja_avisos", { p_empleado: st.emp }), terminados: [] }; } catch { r = null; } }
    finally { revisando = false; }
    if (!r || typeof r !== "object") return;
    const l = Array.isArray(r.sumados) ? r.sumados : [], t = Array.isArray(r.terminados) ? r.terminados : [];
    // su tramo dice «con Walter Saucedo» (o «con Walter Saucedo y Luis Luna» si pasaron dos, como la base)
    const por = {};
    l.forEach((x) => (por[x.client_id] = por[x.client_id] || []).push(x));
    st.parejas = por;
    let cambio = false;
    Object.keys(por).forEach((cid) => st.server.filter((r) => r.client_id === cid).forEach((r) => {
      const p = "con " + por[cid].map((x) => x.quien).filter((q, i, a) => a.indexOf(q) === i).join(" y ");
      if (!r.detalle || r.detalle.pareja !== p) { r.detalle = Object.assign({}, r.detalle || {}, { pareja: p }); cambio = true; }
    }));
    const firma = JSON.stringify(l.map((x) => [x.id, x.se_fue]));
    if ((cambio || firma !== st.parejasFirma) && !$("optionsScreen").classList.contains("hidden") && !st.aviso) renderBotonera();
    st.parejasFirma = firma;
    // se avisa en la botonera, y no en el medio de una pausa (Baño, Movimiento, Almuerzo): espera a que vuelva
    if ($("optionsScreen").classList.contains("hidden") || st.paso || st.aviso || (abierta() && PAUSAS.includes(abierta().rubro))) return;
    const ya = avisados(), marcar = (...k) => lsSet(LS_AVISOS, { dia: hoyAR(), ids: ya.concat(k).slice(-100) });
    // al que se sumó: el que empezó terminó → su parte se cierra a esa hora y se le ofrece seguir con él si arrancó otro
    const ab = abierta();
    const fin = ab && esInvitado(ab) && t.find((x) => !ya.includes("t" + x.id) && (x.mio === ab.client_id || x.une === ab.detalle._une));
    if (fin) {
      marcar("t" + fin.id);
      const hasta = new Date(Math.max(Date.parse(fin.fin), Date.parse(ab.ts_cliente) + 1)).toISOString();
      irse(ab, hasta);
      const a = st.areas.find((x) => x.codigo === fin.rubro && deLaPlanta(x)) || areaDe(fin.rubro), u = lasUnidades({ unidad: fin.unidad, pide_cantidad: fin.pide_cantidad });
      const s = fin.sigue, d = descCod(fin.rubro, fin.texto);
      aviso({ ico: "🏁", tit: fin.de + " terminó el " + fin.area + (fin.texto ? " · " + fin.texto : ""),
        txt: (d ? esc(d) + "<br>" : "") + "a las " + hhmm(fin.fin) +
          (u && fin.cantidad != null ? " · cargó <b>" + num(fin.cantidad) + " " + esc(fin.unidad) + "</b>" : ""),
        nota: "📝 Tu parte quedó cerrada a las " + hhmm(hasta) + ": vos no cargás nada." +
          (s ? "<br>Sigue con el <b>" + esc(s.texto || "") + "</b>" + (s.descripcion ? " · " + esc(s.descripcion) : "") + "." : ""),
        botones: s && a ? [{ t: "🤝 Seguir con " + fin.de + " en el " + (s.texto || a.nombre), fn: () => unirse(a, s) }, { t: "Volver a las áreas", sec: true }]
          : [{ t: "Entendido" }] });
      return;
    }
    // al que empezó: se fue el que se había sumado (si se fue antes de que viera «se sumó», sale sólo «se fue»)
    const ido = l.find((x) => x.se_fue && !ya.includes("f" + x.id));
    if (ido) {
      marcar("f" + ido.id, ido.id);
      const u = lasUnidades({ unidad: ido.unidad, pide_cantidad: ido.pide_cantidad }), d = descCod(ido.rubro, ido.texto);
      aviso({ ico: "🚪", tit: ido.quien + " se fue de tu " + ido.area,
        txt: (ido.texto ? "<b>" + esc(ido.texto) + "</b>" + (d ? " · " + esc(d) : "") + "<br>" : "") +
          "Estuvo " + (ido.desde ? "de " + hhmm(ido.desde) + " " : "") + "a " + hhmm(ido.se_fue),
        nota: "📝 <b>Al terminar, " + esc(u ? u + " las cargás vos: todas las del tramo" : "lo que haya que cargar lo cargás vos") + "</b>, " +
          "también las que hicieron juntos.<br>Si viene otro compañero, se puede sumar.",
        botones: [{ t: "Entendido", fn: () => renderBotonera() }] });
      return;
    }
    const nuevo = l.find((x) => !ya.includes(x.id));
    if (!nuevo) return;
    marcar(nuevo.id);
    // el mismo compañero que estaba en su tramo anterior (siguen juntos con otro código): un aviso corto, sin ventana
    const so = lsGet(LS_SOCIO, null);
    if (so && so.dia === hoyAR() && (so.nombres || []).includes(nuevo.quien) && Date.now() - so.ts < 15 * 60000) {
      toast("🤝 " + nuevo.quien + " sigue con vos" + (nuevo.texto ? " en el " + nuevo.texto : "")); return;
    }
    const u = lasUnidades({ unidad: nuevo.unidad, pide_cantidad: nuevo.pide_cantidad }), d = descCod(nuevo.rubro, nuevo.texto);
    aviso({ ico: "🤝", tit: nuevo.quien + " se sumó a tu " + nuevo.area,
      txt: nuevo.texto ? "<b>" + esc(nuevo.texto) + "</b>" + (d ? " · " + esc(d) : "") : "",
      nota: "📝 <b>Al terminar, " + esc(u ? u + " las cargás vos: las de los dos" : "lo que haya que cargar lo cargás vos") + "</b>." +
        "<br>" + esc(nuevo.quien) + " no carga nada.",
      botones: [{ t: "Entendido", fn: () => renderBotonera() }] });
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
  // 1.28 (D31): Almuerzo y Movimientos son pausas del trabajo; al volver se propone el área productiva anterior (Recibir tampoco cuenta).
  // 1.33: Baño y Movimiento ya no pasan por acá (terminarPausa); queda para el almuerzo, y para no proponer una pausa
  const PAUSAS = ["ALMU", "MOVIM", "BANO", "LIMP"];   // 1.31 (Elías): Baño, igual que Movimientos · 1.54: Limpieza
  function areaAntesDelAlmuerzo(ab) {
    const prev = eventosHoy().filter((r) => r.opcion === "AREA" && !PAUSAS.includes(r.rubro) && r.rubro !== "RECIB" && r.ts_inicio && r.ts_cliente <= ab.ts_cliente);
    const r = prev.length ? prev[prev.length - 1].rubro : null;
    return r ? areaDe(DENTRO_DE[r] || r) : null;
  }
  function registrarFin() {
    const q = cola();
    q.push({ client_id: uuid(), empleado_id: st.emp, opcion: "FIN", rubro: null, descripcion: "Terminé el día", texto: "",
             cantidad: null, ts_cliente: new Date(Date.now() + 2).toISOString(), ts_inicio: null, dispositivo: dispositivo(), planta: st.planta });
    guardarCola(q);
  }

  // 1.24: si el área tiene preguntas para el momento de terminar, van antes de la cantidad
  function abrirTermine(ab, cierra, sigue, modo) {
    if (!pasosDe(cierra, "terminar").length) { pintarTermine(ab, cierra, sigue, modo, null); return; }
    iniciarPasos(cierra, "terminar", "Terminé " + cierra.nombre + (etq(ab) ? " · " + etq(ab) : ""),
      (resp) => pintarTermine(ab, cierra, sigue, modo, resp), () => { show("optionsScreen"); renderBotonera(); });
  }
  function pintarTermine(ab, cierra, sigue, modo, fin) {
    // 1.39 (D45): el compañero invitado no carga cajas (las carga quien lo invitó) y al terminar vuelve la botonera
    const invitado = esInvitado(ab);
    if (invitado && modo === "normal") sigue = null;
    const pideCant = cierra.pide_cantidad !== false && !invitado;
    st.pend = { ab, cierra, sigue, modo, fin, pideCant };
    const almorzar = sigue && sigue.codigo === "ALMU";
    // v1.11 (D29): Recibir mercadería pregunta qué se recibe al EMPEZAR, pero al terminar no pregunta con qué sigue
    const conSigue = modo !== "fin" && sigue && !almorzar && !(sigue.codigo === "RECIB" && cierra.codigo === "RECIB");
    $("cantTitulo").textContent = (cierra.codigo === "ALMU" ? "Volví de almorzar" : "Terminé " + cierra.nombre) + (etq(ab) ? " · " + etq(ab) : "");
    // 1.47: de a dos, el que empezó pone las de los dos y se le dice con el nombre del compañero
    const dos = !invitado && pideCant && companero(ab), idos = dos && seFueron(ab);
    $("cantSub").textContent = "desde " + hhmm(ab.ts_cliente) + (invitado ? " · " + quienCarga(ab) + ": vos no cargás nada" : "") +
      (idos ? " · 🤝 todas las del tramo (" + idos + ")" : dos ? " · 🤝 las de " + (companero(ab).includes(" y ") ? "todos" : "los dos") + ", no sólo las tuyas" : "");
    $("cantBox").classList.toggle("hidden", !pideCant);
    $("cantLabel").textContent = cuantas(cierra.unidad) + cierra.unidad + (ab.texto ? (esMoldura(cierra) ? " de moldura " : " del ") + ab.texto : "") +
      (dos ? " hicieron " + entreVos(ab) : "") + "?";
    $("cantInput").value = ""; $("cantError").textContent = "";
    if (!conSigue && !almorzar) st.pend.sigue = null;   // «Listo» cierra y no abre nada
    $("sigueBox").classList.toggle("hidden", !conSigue);
    $("siguePend").classList.add("hidden"); $("siguePend").innerHTML = "";
    if (conSigue) {
      $("sigueLabel").textContent = !sigue.pide_codigo ? "¿Seguís en " + sigue.nombre + "?" :
        esOpciones(sigue) ? "¿Seguís en " + sigue.nombre + "? ¿" + codigosDe(sigue).map((c) => c.descripcion || c.codigo).join(" o ") + "?" :
        "¿Con qué código seguís en " + sigue.nombre + "?";
      prepararInput("sigueInput", "sigueHint", sigue); $("sigueError").textContent = "";
      if (!sigue.pide_codigo) { $("sigueInput").classList.add("hidden"); $("sigueOpts").classList.add("hidden"); $("sigueSuf").classList.add("hidden"); }
      if (sigue.codigo === "GUARD" && sigue.pide_codigo) pendientesContraido("siguePend", () => st.pend && st.pend.sigue && st.pend.sigue.codigo === "GUARD");
    }
    restaurarBtn("cantBtn");
    $("cantBtn").textContent = modo === "fin" ? "🏁 Terminar el día" : almorzar ? "🍽️ Terminar e ir a almorzar" :
      conSigue ? (cierra.codigo === "ALMU" ? "Volver y seguir en " : "Terminar y seguir en ") + sigue.nombre : "Listo";
    $("cambioBtn").classList.toggle("hidden", !conSigue);
    // 1.51 (D72, Thomas: «sí»): terminando Encolado, «🔧 Puesta a punto encoladora» cierra con la cantidad y la abre (no al
    // terminar la propia puesta a punto)
    const hijas = conSigue && !DENTRO_DE[cierra.codigo] ? hijasDe(sigue) : [];
    $("sigueHijas").innerHTML = hijas.map((x) => '<button class="sec-btn" data-cod="' + esc(x.codigo) + '">' + (ICONO[x.codigo] || "🏷️") + '<span class="h-l"> Terminar e ir a</span> ' + esc(x.nombre) + "</button>").join("");
    $("sigueHijas").classList.toggle("hidden", !hijas.length);
    $("cambioBtn").textContent = cierra.codigo === "ALMU" ? "Volví · elegir otra área" : "Cambiar de área / no sigo";
    $("salidaBox").classList.toggle("hidden", modo === "fin" || almorzar || cierra.codigo === "ALMU");
    $("cantAlmuBtn").classList.toggle("hidden", !areaDe("ALMU"));
    show("cantScreen");
    if (pideCant) $("cantInput").focus(); else if (conSigue && sigue.pide_codigo) $("sigueInput").focus();
  }

  // seguir = true → cierra y empieza el área propuesta (con su código); false → cierra y vuelve a la botonera
  function confirmarCant(seguir) {
    const p = st.pend; if (!p) return;
    const pideCant = p.pideCant;
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
      if ((nuevo.nuevo || avisoS) && !confirmoNuevo(nuevo.guardo, "sigueError", "cantBtn", avisoS || (nuevo.nuevo && avisoLetra(sigue, nuevo.guardo)))) return;
    }
    const finX = extraDe(p.fin || {});
    const det = Object.assign({}, p.ab.detalle || {}, finX.detalle || {});
    if (companero(p.ab) && !esInvitado(p.ab)) lsSet(LS_SOCIO, { dia: hoyAR(), nombres: companero(p.ab).split(" y "), ts: Date.now() });
    registrar(p.cierra, { ts_inicio: p.ab.ts_cliente, cantidad: cant, texto: p.ab.texto || finX.texto || "", medida: p.ab.medida || "",
                          detalle: Object.keys(det).length ? det : null });
    // 1.24: si sigue en un área con preguntas (Esnaola), primero cierra y después pregunta moldura / anilina / color
    if (sigue && p.modo !== "fin" && pasosDe(sigue, "empezar").length) {
      flush(); st.pend = null; restaurarBtn("cantBtn");
      toast((p.cierra.codigo === "ALMU" ? "✓ Volviste de almorzar" : "✓ Terminaste " + p.cierra.nombre) +
            (cant != null ? " · " + num(cant) + " " + p.cierra.unidad : ""));
      empezarConPasos(sigue, "Seguís en " + sigue.nombre); return;
    }
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
  const SIN_LETRA = ["ENCOL"];   // 1.44: áreas sin el botón de la E
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
    // 1.42 (Elías: «que todos los inputs para poner código sean numéricos y con un botón al lado para agregar a ese código o
    // sacarle (en caso de doble tap) una E»): teclado numérico siempre (inputmode en index.html) y, al lado, la E. Si la
    // lista del área tiene códigos que terminan en otra letra (514G a 519G, 535W), también esa: con teclado numérico no
    // se podrían tipear
    // 1.44 (Elías: «en el módulo de encolado no va la posibilidad de que pongan la E»): en Encolado el 781 y el 781E son lo
    // mismo (la caja exhibidora va después), así que ahí no hay letras
    const suf = $(inputId === "codInput" ? "codSuf" : "sigueSuf"), sinLetra = conOpc || SIN_LETRA.includes(a.codigo);
    const otras = [...new Set(lista.map((c) => (String(c.codigo).toUpperCase().match(/^\d+([A-Z])$/) || [])[1]).filter(Boolean))]
      .filter((l) => l !== "E").sort();
    suf.innerHTML = sinLetra ? "" : ["E"].concat(otras).map((l) => '<button type="button" class="suf-btn" data-l="' + l +
      '" aria-label="Agregar o sacar la ' + l + '">' + l + "</button>").join("");
    suf.classList.toggle("hidden", sinLetra);
    $(hintId).textContent = ""; $(hintId).classList.remove("nuevo");
    st.nuevoOk = null;
  }
  function mostrarHint(el) {
    const a = areaDe(el.dataset.area), h = $(el.dataset.hint);
    if (!a || !h) return;
    st.nuevoOk = null;
    const v = el.value.trim();
    const suf = $(el.id === "codInput" ? "codSuf" : "sigueSuf");
    suf.querySelectorAll(".suf-btn").forEach((b) => b.classList.remove("sugerida"));
    if (!v) { h.textContent = ""; h.classList.remove("nuevo"); return; }
    const r = validarCodigo(a, v);
    const c = r.cod, s = r.nuevo ? conLetra(a, v) : null;
    h.classList.toggle("nuevo", !!r.nuevo);
    h.textContent = c ? [c.descripcion, c.medida].filter(Boolean).join(" · ") || "✓" :
      s ? "Sin la " + s.codigo.slice(-1).toUpperCase() + " no está. " + s.codigo + ": " + [s.descripcion, s.medida].filter(Boolean).join(" · ") :
      r.nuevo ? "No está en la lista de " + a.nombre : "";
    if (s) { const b = suf.querySelector('.suf-btn[data-l="' + s.codigo.slice(-1).toUpperCase() + '"]'); if (b) b.classList.add("sugerida"); }
  }
  // 1.42 (Elías: «también tiene que buscar en la lista si se le agrega la E»): un número que no está en la lista pero sí con
  // una letra al final (781 → 781E) lo dice abajo del campo y marca esa letra
  function conLetra(a, raw) {
    const v = String(raw || "").trim().toUpperCase(), sin0 = (x) => String(x).toUpperCase().replace(/^0+(?=\d)/, "");
    if (!/^\d+$/.test(v) || SIN_LETRA.includes(a.codigo)) return null;
    return codigosDe(a).find((c) => /^\d+[A-Z]$/i.test(c.codigo) && sin0(c.codigo).slice(0, -1) === sin0(v)) || null;
  }
  function avisoLetra(a, raw) {
    const s = conLetra(a, raw);
    return s ? "El " + String(raw).trim() + " no está en la lista, el " + s.codigo + " sí: tocá la " + s.codigo.slice(-1).toUpperCase() + "." : null;
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
  // 1.42: la letra al final del código: un toque la pone (en lugar de otra letra), otro toque la saca
  function ponerLetra(inputId, l) {
    const el = $(inputId), v = el.value.trim().toUpperCase(), base = v.replace(/[A-Z]+$/, "");
    el.value = v.endsWith(l) ? base : base + l;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function marcarLetra(inputId) {
    const v = $(inputId).value.trim().toUpperCase();
    $(inputId === "codInput" ? "codSuf" : "sigueSuf").querySelectorAll(".suf-btn").forEach((b) => b.classList.toggle("activo", v.endsWith(b.dataset.l)));
  }
  function restaurarBtn(id) { const b = $(id); if (b.dataset.txt) { b.textContent = b.dataset.txt; delete b.dataset.txt; } }
  function empezar(a) {
    if (pasosDe(a, "empezar").length) { empezarConPasos(a, "Empecé " + a.nombre); return; }
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
    const hijas = hijasDe(a);   // 1.50: Puesta a punto encoladora
    $("codHijas").innerHTML = hijas.map((x) => '<button class="sec-btn" data-cod="' + esc(x.codigo) + '">' + (ICONO[x.codigo] || "🏷️") + " " + esc(x.nombre) + "</button>").join("");
    $("codHijas").classList.toggle("hidden", !hijas.length);
    paraUnirse(a);   // 1.45: Encolado / Contraído, lo que están haciendo los compañeros
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
    if ((r.nuevo || avisoC) && !confirmoNuevo(r.guardo, "codError", "codBtn", avisoC || (r.nuevo && avisoLetra(a, r.guardo)))) return;
    restaurarBtn("codBtn");
    const piezas = piezasSet(a, r.cod);
    if (piezas) { st.codPara = null; pedirMedida(a, r.guardo, piezas); return; }
    st.codPara = null;
    registrar(a, { texto: r.guardo }, 1); flush();
    const c = r.cod;
    toast("✓ Empezaste " + a.nombre + " · " + r.guardo + (c && c.descripcion ? " " + c.descripcion + (c.medida ? " " + c.medida : "") : ""));
    show("optionsScreen"); renderBotonera();
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

  /* ---------- 1.24: preguntas del área (gt.rubro_pasos) ---------- */
  function pasosDe(a, momento) { return a ? st.pasos.filter((p) => p.rubro === a.codigo && (p.momento || "empezar") === momento) : []; }
  function esMoldura(a) { return st.pasos.some((p) => p.rubro === a.codigo && p.campo === "texto" && p.fuente === "molduras"); }
  function cuantas(unidad) { return /^(metros?|kilos?|kg|litros?|pedidos?|paquetes?|aros?|rollos?)\b/i.test(unidad || "") ? "¿Cuántos " : "¿Cuántas "; }
  // las respuestas: `texto` va en texto (la moldura); el resto, en detalle
  function extraDe(resp) {
    const d = {}; let texto = "";
    Object.keys(resp || {}).forEach((k) => { if (k === "texto") texto = resp[k]; else d[k] = resp[k]; });
    return { texto, detalle: Object.keys(d).length ? d : null };
  }
  function empezarConPasos(a, titulo) {
    iniciarPasos(a, "empezar", titulo, (resp) => {
      const x = extraDe(resp);
      registrar(a, x, 1); flush();
      toast("✓ Empezaste " + a.nombre + (etq(x) ? " · " + etq(x) : ""));
      show("optionsScreen"); renderBotonera();
    }, () => { show("optionsScreen"); renderBotonera(); });
  }
  function iniciarPasos(a, momento, titulo, onFin, onCancel) {
    const pasos = pasosDe(a, momento);
    if (!pasos.length) { onFin({}); return; }
    st.paso = { a, pasos, i: -1, resp: {}, vistos: [], titulo, onFin, onCancel };
    sigPaso();
  }
  function aplica(p, resp) { return !p.si_campo || resp[p.si_campo] === p.si_valor; }
  function sigPaso() {
    const s = st.paso; if (!s) return;
    let i = s.i + 1;
    while (i < s.pasos.length && !aplica(s.pasos[i], s.resp)) i++;
    if (i >= s.pasos.length) { st.paso = null; s.onFin(s.resp); return; }
    s.i = i; s.vistos.push(i);
    pintarPaso();
  }
  function respTxt(p, v) {
    if (v == null || v === "") return "";
    if (p.campo === "texto") return (p.fuente === "molduras" ? "Moldura " : "") + v;
    if (p.campo === "anilina") return v === "Sí" ? "con anilina" : "sin anilina";
    return v;
  }
  function pintarPaso() {
    const s = st.paso, p = s.pasos[s.i];
    $("pasoTitulo").textContent = s.titulo;
    const ya = s.vistos.slice(0, -1).map((j) => respTxt(s.pasos[j], s.resp[s.pasos[j].campo])).filter(Boolean);
    $("pasoResp").textContent = ya.join(" · ");
    $("pasoResp").classList.toggle("hidden", !ya.length);
    $("pasoLabel").textContent = p.pregunta;
    const ops = p.opciones || [];
    // 1.33: una pregunta sin opciones se contesta escribiendo (Movimientos: «¿Qué estás haciendo?»)
    const libre = !ops.length;
    $("pasoOpts").innerHTML = ops.map((o) => '<button data-val="' + esc(o) + '">' + esc(o) + "</button>").join("");
    $("pasoOpts").classList.toggle("muchas", ops.length > 6);   // 1.39: «¿Con quién?» con todos los compañeros
    $("pasoTexto").classList.toggle("hidden", !libre); $("pasoAcc").classList.toggle("hidden", !libre); $("pasoError").textContent = "";
    if (libre) $("pasoTexto").value = s.resp[p.campo] || "";
    show("pasoScreen");
    if (libre) $("pasoTexto").focus();
  }
  function textoPaso() {
    const v = $("pasoTexto").value.trim();
    if (v.length < 2) { $("pasoError").textContent = "Escribí la respuesta"; $("pasoTexto").focus(); return; }
    elegirPaso(v);
  }
  function elegirPaso(v) { const s = st.paso; if (!s) return; s.resp[s.pasos[s.i].campo] = v; sigPaso(); }
  // ‹ vuelve a la pregunta anterior; desde la primera, cancela
  function volverPaso() {
    const s = st.paso; if (!s) return;
    s.vistos.pop();
    if (!s.vistos.length) { st.paso = null; s.onCancel(); return; }
    s.i = s.vistos[s.vistos.length - 1];
    s.pasos.forEach((p, j) => { if (j >= s.i) delete s.resp[p.campo]; });
    pintarPaso();
  }

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
      const nom = (ICONO[r.rubro] || "🏷️") + " " + esc(a ? a.nombre : r.rubro) + (etq(r) ? " · " + esc(etq(r)) : "");
      if (!r.ts_inicio) return '<div class="hist-row curso"><div class="hist-main"><div class="hist-area">' + nom +
        '</div><div class="hist-det">Desde ' + hhmm(r.ts_cliente) + p + '</div></div><div class="hist-cant">en curso</div></div>';
      const pz = pausasDentro(r.rubro, r.ts_inicio, r.ts_cliente);   // 1.34: sin las pausas de adentro
      return '<div class="hist-row"><div class="hist-main"><div class="hist-area">' + nom + '</div><div class="hist-det">' +
        hhmm(r.ts_inicio) + " – " + hhmm(r.ts_cliente) + p + " · " + dur(new Date(r.ts_cliente) - new Date(r.ts_inicio) - pz) +
        (pz >= 60000 ? " (sin " + dur(pz) + " de pausa)" : "") +
        '</div></div><div class="hist-cant">' + (r.cantidad == null ? "—" : num(r.cantidad)) + "</div></div>";
    }).join("");
  }

  /* ---------- ingreso ---------- */
  // 1) código del monitor → lista de nombres
  async function validarClave() {
    const v = $("claveInput").value.replace(/\D/g, "");
    $("claveError").textContent = "";
    if (v.length !== 4 && v.length !== 6) { $("claveError").textContent = "El código tiene 4 números"; return; }
    let r;
    try { r = await rpc("gt_clave_validar", { p_clave: v }); }
    catch { $("claveError").textContent = "Sin conexión. Probá de nuevo."; return; }
    if (!r.ok) {
      if (v.length === 6) { const k = lsGet(LS_LLAVE, null); if (k && k.llave === v) { try { localStorage.removeItem(LS_LLAVE); } catch { /* nada */ } pintarLlave(); } }
      $("claveError").textContent = v.length === 6 ? "Clave personal incorrecta" : "Código incorrecto o vencido: mirá el monitor"; return;
    }
    // 1.53 (Thomas: «Darío es el encargado… que pueda fichar sin la necesidad de un código y que cuando fiche le diga el
    // código para el compañero»): con la clave personal entra directo como él, sin lista ni «¿Sos …?», y este celular la
    // recuerda (los días siguientes es un toque en «👷 Entrar como …»). Con el código de una planta (el que muestra el
    // encargado) no se pregunta la planta: entra en ésa
    st.plantaFija = r.planta || null;
    if (r.personal && (r.empleados || []).length === 1) {
      const e = r.empleados[0];
      lsSet(LS_LLAVE, { llave: v, nombre: e.nombre, da: r.da_codigo || null });
      st.principal = r.principal || null; st.vistaClave = false;
      st.empsPlantas = {}; st.empsPlantas[e.id] = e.plantas || [];
      $("claveInput").value = ""; pintarLlave();
      elegirEmpleado(e.id, e.nombre); return;
    }
    st.vistaClave = !!r.vista;   // 1.52: la clave del administrador (gt.config.clave_vista): elegir a quién ver, sin grabar
    $("nombreLista").classList.toggle("vista", st.vistaClave);
    const emps = r.empleados || [];
    st.principal = r.principal || null;
    st.empsPlantas = {}; emps.forEach((e) => { st.empsPlantas[e.id] = e.plantas || []; });
    $("nombreLista").innerHTML = emps.length ? emps.map((e) =>
      '<button data-id="' + e.id + '" data-nombre="' + esc(e.nombre) + '" data-ini="' +
        esc(e.nombre.split(/\s+/).map((x) => x[0] || "").join("").slice(0, 2).toUpperCase()) + '"><span>' + esc(e.nombre) + "</span></button>").join("") :
      '<div class="error">No hay empleados cargados en GT.</div>';
    show("nombreScreen");
  }

  async function cargarAreas() {
    // 1.22: gt_botones2 trae la planta de cada área; si no está, gt_botones (todas de la principal)
    // 1.52: gt_botones3 trae además de quién es cada área («solo»)
    try { st.areas = await rpc("gt_botones3", {}); if (!Array.isArray(st.areas) || !st.areas.length) throw new Error("sin lista"); lsSet(LS_AREAS, st.areas); }
    catch { try { st.areas = await rpc("gt_botones2", {}); lsSet(LS_AREAS, st.areas); }
    catch {
      try { st.areas = await rpc("gt_botones", {}); lsSet(LS_AREAS, st.areas); }
      catch { st.areas = lsGet(LS_AREAS, []); }
    } }
    // 1.35 (Elías: «estoy en guardado y no me aparece nada al poner 224»): la API corta en 1.000 filas y la lista tiene
    // 2.273 (ordenada por área): a Gancho, Grampeado, Guardado, Montaje, Recibir y parte de Encolado no les llegaba nada.
    // gt_codigos_area2 manda la lista entera en una sola fila; si no está, la de antes.
    try { st.codigos = await rpc("gt_codigos_area2", {}); if (!Array.isArray(st.codigos)) throw new Error("sin lista"); lsSet(LS_CODS, st.codigos); }
    catch {
      try { st.codigos = await rpc("gt_codigos_area", {}); lsSet(LS_CODS, st.codigos); }
      catch { st.codigos = lsGet(LS_CODS, []); }
    }
    try { st.pasos = await rpc("gt_pasos", {}); lsSet(LS_PASOS, st.pasos); }
    catch { st.pasos = lsGet(LS_PASOS, []); }
  }
  async function cargarHoy() {
    // 1.24: gt_registros_hoy3 trae el detalle (anilina, color); si no está, gt_registros_hoy2
    let r = null;
    try { r = await rpc("gt_registros_hoy3", { p_empleado: st.emp }); }
    catch { try { r = await rpc("gt_registros_hoy2", { p_empleado: st.emp }); } catch { /* sin red: se arma con la cola */ } }
    if (r) st.server = r.map((x) => Object.assign({ empleado_id: st.emp }, x));
  }

  // 1.49 (02/10: «tocó el nombre de Walter y le puso el nombre de Luis… quiero que confirmen que la persona es tal persona»):
  // tocar un nombre no entra: pregunta «¿Sos Walter Saucedo?». Sí → entra (o «¿En qué planta?»); No, tocar afuera o Esc →
  // sigue la lista. Un segundo toque en menos de NOMBRE_ESPERA ms no cuenta (el doble toque no confirma solo).
  const NOMBRE_ESPERA = 400;
  function confirmarNombre(id, nombre) {
    aviso({ ico: "🙋", tit: "¿Sos " + nombre + "?", txt: "Lo que cargues queda a nombre de <b>" + esc(nombre) + "</b>.", espera: NOMBRE_ESPERA,
      botones: [{ t: "✅ Sí, soy " + nombre, fn: () => elegirEmpleado(id, nombre) }, { t: "No, elegir otro nombre", sec: true }] });
  }
  // 2) entra con el empleado elegido (o con la sesión del día, sin pedir código)
  // 1.22: después del nombre, si trabaja en más de una planta, «¿En qué planta trabajás hoy?»
  // 1.31 (Elías): sin «Cambiar de planta» en la botonera: para cambiar, ‹ y volver a entrar con el código del monitor
  function elegirEmpleado(id, nombre) {
    const pl = (st.empsPlantas && st.empsPlantas[id]) || [];
    if (st.plantaFija) { entrar(id, nombre, st.plantaFija, pl, st.principal, true, st.vistaClave); return; }   // 1.53
    if (pl.length < 2) { entrar(id, nombre, pl[0] ? pl[0].codigo : null, pl, st.principal, true, st.vistaClave); return; }
    st.elige = { id, nombre, plantas: pl };
    mostrarPlantas();
  }
  function mostrarPlantas() {
    const e = st.elige;
    $("plantaTitulo").textContent = e.nombre;
    $("plantaOpts").innerHTML = e.plantas.map((p) => '<button data-planta="' + esc(p.codigo) + '">' + esc(p.nombre) + "</button>").join("");
    show("plantaScreen");
  }
  function elegirPlanta(cod) {
    const e = st.elige; if (!e) return;
    st.elige = null;
    entrar(e.id, e.nombre, cod, e.plantas, st.principal, true, st.vistaClave);
  }
  function nombrePlanta(cod) { const p = st.plantas.find((x) => x.codigo === cod); return p ? p.nombre : cod || ""; }
  function ponerNombre() { $("opName").textContent = (st.vista ? "👁 " : "") + st.nombre + (st.plantas.length > 1 && st.planta ? " · " + nombrePlanta(st.planta) : ""); }
  function guardarSesion() {
    lsSet(LS_SESION, { id: st.emp, nombre: st.nombre, dia: hoyAR(), planta: st.planta, plantas: st.plantas, principal: st.principal, vista: st.vista });
  }
  // ingreso = true cuando viene de poner el código y elegir el nombre (no al recargar con la sesión del día)
  async function entrar(id, nombre, planta, plantas, principal, ingreso, vista) {
    st.emp = Number(id); st.nombre = nombre;
    st.vista = !!vista; st.sim = [];
    st.planta = planta || null; st.plantas = plantas || []; st.principal = principal || null;
    guardarSesion();
    // 1.33 (Elías): el INGRESO (la hora del código) va aparte del primer trabajo productivo (el primer «Empecé»)
    if (ingreso && !st.vista) {
      const q = cola();
      q.push({ client_id: uuid(), empleado_id: st.emp, opcion: "INGRESO", rubro: null, descripcion: "Ingresó con el código", texto: "",
               cantidad: null, ts_cliente: new Date().toISOString(), ts_inicio: null, dispositivo: dispositivo(), planta: st.planta });
      guardarCola(q);
    }
    ponerNombre(); pintarLlave();
    show("optionsScreen");
    await Promise.all([cargarAreas(), cargarHoy()]);
    renderBotonera(); flush();
    // 1.21 (D44): si ya había terminado el día, puede seguir, pero la base avisa por Telegram (una vez por «Terminar día»)
    const hoy = eventosHoy().filter((r) => r.opcion !== "INGRESO"), ult = hoy[hoy.length - 1];
    if (ult && ult.opcion === "FIN" && !st.vista) rpc("gt_reingreso", { p_empleado: st.emp }).catch(() => { /* sin red: avisa el primer registro */ });
  }

  // 1.53: el botón «👷 Entrar como Dario Mendez» (pantalla del código) y la 🔑 de arriba (el código de su planta para el
  // compañero: sólo en el celular del encargado, entrando en esa planta y no en modo vista)
  function pintarLlave() {
    const k = lsGet(LS_LLAVE, null);
    $("llaveBtn").classList.toggle("hidden", !k);
    if (k) $("llaveBtn").textContent = "👷 Entrar como " + k.nombre;
    $("codPlantaBtn").classList.toggle("hidden", !(k && k.da && st.emp && !st.vista && st.planta === k.da));
  }
  function entrarConLlave() {
    const k = lsGet(LS_LLAVE, null); if (!k) return;
    $("claveInput").value = k.llave; validarClave(); $("claveInput").value = "";
  }
  let codTimer = null;
  async function mostrarCodigoPlanta() {
    const k = lsGet(LS_LLAVE, null); if (!k) return;
    let r = null;
    try { r = await rpc("gt_codigo_planta", { p_llave: k.llave }); } catch { toast("Sin conexión: probá de nuevo"); return; }
    if (!r || !r.ok) { toast("No hay código para mostrar"); return; }
    let resta = Number(r.cambia_en_s) || 60;
    const pinta = () => { const n = document.getElementById("codPlantaNum"), s = document.getElementById("codPlantaSeg"); if (n) n.textContent = r.clave; if (s) s.textContent = "cambia en " + resta + " s"; };
    aviso({ ico: "🔑", tit: "Código de " + (r.planta_nombre || r.planta),
      txt: '<span id="codPlantaNum" class="cod-planta"></span><br><span id="codPlantaSeg" class="mut"></span>',
      nota: "Que tu compañero lo ponga en su celular, en «Código de ingreso». Entra directo en " + esc(r.planta_nombre || r.planta) + ".",
      botones: [{ t: "Listo", fn: () => { clearInterval(codTimer); codTimer = null; } }] });
    pinta();
    clearInterval(codTimer);
    codTimer = setInterval(async () => {
      if (!st.aviso) { clearInterval(codTimer); codTimer = null; return; }
      resta--;
      if (resta <= 0) { try { const x = await rpc("gt_codigo_planta", { p_llave: k.llave }); if (x && x.ok) { r = x; resta = Number(x.cambia_en_s) || 60; } } catch { resta = 5; } }
      pinta();
    }, 1000);
  }

  // 1.20 (Thomas): al terminar el día vuelve a la pantalla del código de la TV (cierra la sesión).
  // La cola sigue mandando lo pendiente: cada fila ya lleva su empleado_id.
  function finDelDia() {
    try { localStorage.removeItem(LS_SESION); } catch { /* nada */ }
    st.emp = null; st.server = []; st.vista = false; st.vistaClave = false; st.sim = []; st.plantaFija = null; $("claveInput").value = ""; $("histPop").classList.add("hidden"); st.aviso = null; $("avisoPop").classList.add("hidden"); document.body.classList.remove("sin-scroll");
    show("claveScreen");
  }
  function salir() {
    if (abierta() && !st.vista && !confirm("Tenés un área sin terminar. ¿Cambiar de operario igual? (queda abierta)")) return;
    try { localStorage.removeItem(LS_SESION); } catch { /* nada */ }
    st.emp = null; st.server = []; st.vista = false; st.vistaClave = false; st.sim = []; st.plantaFija = null; $("claveInput").value = ""; $("histPop").classList.add("hidden"); st.aviso = null; $("avisoPop").classList.add("hidden"); document.body.classList.remove("sin-scroll");
    show("claveScreen");
  }

  /* ---------- eventos ---------- */
  $("verBadge").textContent = "v" + CFG.APP_VERSION;
  $("claveBtn").onclick = validarClave;
  $("llaveBtn").onclick = entrarConLlave;
  $("codPlantaBtn").onclick = mostrarCodigoPlanta;
  $("claveInput").addEventListener("keydown", (e) => { if (e.key === "Enter") validarClave(); });
  // 1.52: en modo vista no se pregunta «¿Sos …?»: no se graba nada a nombre de nadie
  $("nombreLista").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; if (st.vistaClave) elegirEmpleado(b.dataset.id, b.dataset.nombre); else confirmarNombre(b.dataset.id, b.dataset.nombre); });
  $("plantaOpts").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) elegirPlanta(b.dataset.planta); });
  $("plantaVolver").onclick = () => { st.elige = null; show("nombreScreen"); };
  $("nombreVolver").onclick = () => show("claveScreen");
  $("botonera").addEventListener("click", (e) => {
    const pz = e.target.closest(".pausa-btn"); if (pz) { pausar(pz.dataset.pausa); return; }
    const b = e.target.closest(".box, .termine-btn"); if (b) tocar(b.dataset.cod);
  });
  $("salirBtn").onclick = salir;
  $("almuBtn").onclick = () => tocar("ALMU");
  $("finBtn").onclick = terminarDia;
  $("cantBtn").onclick = () => confirmarCant(true);
  $("cambioBtn").onclick = () => confirmarCant(false);
  $("sigueHijas").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b || !st.pend) return; st.pend.sigue = areaDe(b.dataset.cod); confirmarCant(true); });
  $("cantAlmuBtn").onclick = () => { if (!st.pend) return; st.pend.sigue = areaDe("ALMU"); st.pend.modo = "normal"; confirmarCant(true); };
  $("cantFinBtn").onclick = () => { if (!st.pend) return; st.pend.modo = "fin"; confirmarCant(false); };
  $("cantInput").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (st.pend && st.pend.sigue && st.pend.sigue.pide_codigo) $("sigueInput").focus(); else confirmarCant(true);
  });
  $("sigueInput").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmarCant(true); });
  $("siguePend").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { $("sigueInput").value = b.dataset.cod; confirmarCant(true); } });
  $("cantVolver").onclick = () => { st.pend = null; show("optionsScreen"); };
  $("codBtn").onclick = confirmarCod;
  $("medOpts").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) elegirMedida(b.dataset.med); });
  $("medVolver").onclick = () => { st.medPara = null; show("optionsScreen"); renderBotonera(); };
  $("pasoOpts").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) elegirPaso(b.dataset.val); });
  $("pasoVolver").onclick = volverPaso;
  $("pasoBtn").onclick = textoPaso;
  $("pasoTexto").addEventListener("keydown", (e) => { if (e.key === "Enter") textoPaso(); });
  $("pasoTexto").addEventListener("input", () => { $("pasoError").textContent = ""; });
  $("codInput").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmarCod(); });
  $("codVolver").onclick = cancelarCod;
  $("codOpts").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { $("codInput").value = b.dataset.cod; confirmarCod(); } });
  $("sigueOpts").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { $("sigueInput").value = b.dataset.cod; confirmarCant(true); } });
  ["codInput", "sigueInput"].forEach((id) => $(id).addEventListener("input", (e) => {
    mostrarHint(e.target); marcarLetra(id); $(id === "codInput" ? "codError" : "sigueError").textContent = "";
    restaurarBtn(id === "codInput" ? "codBtn" : "cantBtn");
  }));
  [["codSuf", "codInput"], ["sigueSuf", "sigueInput"]].forEach(([sid, iid]) => {
    $(sid).addEventListener("mousedown", (e) => { if (e.target.closest(".suf-btn")) e.preventDefault(); });   // no le saca el foco al campo
    $(sid).addEventListener("click", (e) => { const b = e.target.closest(".suf-btn"); if (b) ponerLetra(iid, b.dataset.l); });
  });
  $("codHijas").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { st.codPara = null; empezar(areaDe(b.dataset.cod)); } });
  $("codJunta").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b && st.codPara) unirse(st.codPara, (st.unirse || [])[Number(b.dataset.i)]); });
  $("codPend").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { $("codInput").value = b.dataset.cod; confirmarCod(); } });
  $("histBtn").onclick = () => { renderHist(); $("histPop").classList.remove("hidden"); document.body.classList.add("sin-scroll"); };
  const cerrarHist = () => { $("histPop").classList.add("hidden"); document.body.classList.remove("sin-scroll"); };
  $("histCerrar").onclick = cerrarHist;
  $("histPop").addEventListener("click", (e) => { if (e.target === $("histPop")) cerrarHist(); });
  // 1.47: la ventana de avisos de la pareja (tocar afuera o Esc = el botón de salida)
  $("avisoPop").addEventListener("click", (e) => {
    if (st.aviso && st.aviso.espera && Date.now() - st.aviso.desde < st.aviso.espera) return;   // 1.49: el doble toque no confirma
    if (e.target === $("avisoPop")) { cerrarAviso(); return; }
    const b = e.target.closest("#avisoBtns button"); if (b) cerrarAviso(Number(b.dataset.i));
  });
  document.addEventListener("keydown", (e) => { if (e.key !== "Escape") return; if (st.aviso) cerrarAviso(); else cerrarHist(); });
  window.addEventListener("online", flush);
  window.addEventListener("resize", acomodar);
  setInterval(flush, 30000);
  setInterval(revisarParejas, 5000);    // 1.43 (Elías: «cada 5 segundos») · 1.45: el aviso «se sumó» al que empezó
  setInterval(pintarMuerto, 1000);      // 1.43

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

  const ses = lsGet(LS_SESION, null);
  pintarLlave();
  if (ses && ses.dia === hoyAR() && ses.id) entrar(ses.id, ses.nombre, ses.planta, ses.plantas, ses.principal, false, ses.vista);
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
      const enCarga = ["cantScreen", "codScreen", "medScreen", "pasoScreen"].some((id) => !$(id).classList.contains("hidden")) ||
                      (document.activeElement && document.activeElement.tagName === "INPUT") || !!st.aviso;   // 1.47: ni con un aviso abierto
      if (enCarga) return;                                   // se reintenta en la próxima vuelta
      if (new URLSearchParams(location.search).get("v") === v) return;   // ya recargó con ésa: no entra en bucle
      location.replace(location.pathname + "?v=" + encodeURIComponent(v));
    } catch { /* sin red: no pasa nada */ }
  }
  setInterval(chequearVersion, 120000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) chequearVersion(); });
  chequearVersion();

  window.__gt = { st, abierta, eventosHoy, flush, verNum, detalleTxt, revisarParejas };   // para tests
})();

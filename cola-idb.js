/* Producción GT — espejo de la cola en IndexedDB (1.57, D90: Elías, 06/10/2026). Lo usan la página (app.js) y el service worker
 * (sw.js, con importScripts). La cola de verdad sigue en localStorage (gt_queue_v3): esto es una COPIA para que el service
 * worker pueda mandarla con la app cerrada (Background Sync: Android / Chrome, en iPhone no existe) y para recuperarla si el
 * localStorage se pierde. A prueba de fallas: sin IndexedDB (modo privado, bloqueado) no pasa nada, todo sigue andando como antes.
 *
 * Almacenes:
 *   queue  {client_id}  la cola sin enviar (el espejo)
 *   meta   cfg          { url, key } para que el service worker sepa a dónde mandar (la clave es la PUBLISHABLE, pública a propósito)
 *   acked  {client_id}  lo que el service worker mandó y la base confirmó con la app cerrada (la página lo saca de su cola)
 */
(function (g) {
  "use strict";
  const NOMBRE = "gt-cola", VERSION = 1, ACK_MS = 2 * 24 * 3600e3;

  function abrir() {
    return new Promise((res, rej) => {
      if (typeof indexedDB === "undefined") { rej(new Error("sin IndexedDB")); return; }
      const r = indexedDB.open(NOMBRE, VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains("queue")) d.createObjectStore("queue", { keyPath: "client_id" });
        if (!d.objectStoreNames.contains("acked")) d.createObjectStore("acked", { keyPath: "client_id" });
        if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta");
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error("IndexedDB bloqueada"));
    });
  }
  // corre fn(tx) en una transacción; si devuelve una función, su resultado es lo que se entrega al terminar
  function correr(almacenes, modo, fn) {
    return abrir().then((db) => new Promise((res, rej) => {
      let tx, leer;
      try { tx = db.transaction(almacenes, modo); leer = fn(tx); } catch (e) { db.close(); rej(e); return; }
      tx.oncomplete = () => { db.close(); res(typeof leer === "function" ? leer() : undefined); };
      tx.onerror = tx.onabort = () => { db.close(); rej(tx.error || new Error("transacción cancelada")); };
    }));
  }

  g.GT_COLA = {
    // la copia pasa a ser exactamente `filas` (lo que hay en localStorage) y guarda adónde mandar
    espejar(filas, cfg) {
      return correr(["queue", "meta"], "readwrite", (tx) => {
        const q = tx.objectStore("queue"); q.clear();
        (filas || []).forEach((f) => { if (f && f.client_id) q.put(f); });
        if (cfg && cfg.url && cfg.key) tx.objectStore("meta").put({ url: cfg.url, key: cfg.key }, "cfg");
      });
    },
    leer() {
      return correr(["queue", "meta", "acked"], "readonly", (tx) => {
        const q = tx.objectStore("queue").getAll(), c = tx.objectStore("meta").get("cfg"), a = tx.objectStore("acked").getAll();
        return () => ({ queue: q.result || [], cfg: c.result || null, acked: a.result || [] });
      });
    },
    // lo que el service worker mandó y la base CONFIRMÓ: sale de la cola y queda en `acked` (se poda a los 2 días). Lo que la base no toma
    // se queda en la cola (1.58: nada se descarta, se reintenta con su hora original)
    resultado(confirmadas) {
      return correr(["queue", "acked"], "readwrite", (tx) => {
        const q = tx.objectStore("queue"), a = tx.objectStore("acked"), ahora = Date.now();
        (confirmadas || []).forEach((f) => { q.delete(f.client_id); a.put(Object.assign({}, f, { _sw: ahora })); });
        a.openCursor().onsuccess = (e) => {
          const c = e.target.result; if (!c) return;
          if (ahora - (c.value._sw || 0) > ACK_MS) c.delete();
          c.continue();
        };
      });
    },
  };
})(typeof self !== "undefined" ? self : this);

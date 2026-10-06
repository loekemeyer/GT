// Producción GT — Service Worker que NO cachea (mismo patrón que Virgilio): existe para que la PWA sea instalable y todo va a la red.
// 1.57 (D90, Elías 06/10/2026): además manda la cola de eventos sin enviar con la app CERRADA (Background Sync, tag «flush-queue»).
// Pasa en Android / Chrome: en iPhone (Safari) no existe Background Sync y el celular sigue mandando sólo con la app abierta.
// La cola se lee del espejo en IndexedDB (cola-idb.js: la página lo escribe cada vez que cambia la cola). Es seguro mandar dos veces:
// la base descarta lo repetido por client_id (gt_registrar: on conflict do nothing).
const SW_VERSION = "1.58-gt";
importScripts("cola-idb.js");

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

async function enviarCola() {
  const d = await self.GT_COLA.leer();
  if (!d.cfg || !d.queue.length) return;
  const r = await fetch(d.cfg.url + "/rest/v1/rpc/gt_registrar", {
    method: "POST",
    headers: { apikey: d.cfg.key, Authorization: "Bearer " + d.cfg.key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_filas: d.queue }),
  });
  if (!r.ok) throw new Error("HTTP " + r.status);     // el navegador reintenta el sync solo, más tarde
  const res = await r.json();
  // sale de la copia sólo lo que la base CONFIRMÓ (1.58): lo rechazado o con error se queda y se reintenta, con su hora original
  const ok = new Set(res.ok || []);
  await self.GT_COLA.resultado(d.queue.filter((f) => ok.has(f.client_id)));
  // si la app está abierta, que ponga al día su cola y su pantalla
  const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  ventanas.forEach((c) => c.postMessage({ tipo: "gt-cola" }));
  // si algo no fue confirmado, el sync «falla» a propósito: Chrome lo vuelve a intentar más tarde (hasta 3 veces) y, si no, queda para la próxima apertura
  if (d.queue.some((f) => !ok.has(f.client_id))) throw new Error("quedaron filas sin confirmar");
}

self.addEventListener("sync", (e) => { if (e.tag === "flush-queue") e.waitUntil(enviarCola()); });
// la página también puede pedirlo (y las pruebas)
self.addEventListener("message", (e) => { if (e.data && e.data.tipo === "gt-enviar") e.waitUntil(enviarCola().catch(() => {})); });

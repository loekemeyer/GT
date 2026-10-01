// Producción GT — Service Worker que NO cachea (mismo patrón que Virgilio):
// existe para que la PWA sea instalable; todo va a la red.
const SW_VERSION = "12.0-gt";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

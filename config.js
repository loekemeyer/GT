// Producción GT — configuración. La clave es la PUBLISHABLE del proyecto (pública a propósito):
// el celular sólo puede llamar a las RPC public.gt_*, no leer ni escribir el schema gt.
window.GT_CFG = {
  SUPABASE_URL: "https://hrxfctzncixxqmpfhskv.supabase.co",
  SUPABASE_KEY: "sb_publishable_BqpAgZH6ty-9wft10_YMhw_0rcIPuWT",
  APP_VERSION: "1.71",
  // Cargar pedido (Tomás G, 05/11/2026): mismo patrón que GV («Cargar pedido» = iframe al admin, no copia de código).
  // GT admin embebe el admin del mayorista de TN en modo solo-carga (gt_cp=1#carga-pedidos). La carga vive en el mayorista
  // (proyecto zjvpzqhbekxnwxdczpof): lo que cambie ahí se ve acá solo. Sólo lo usa admin.html; el celular del operario lo ignora.
  // Producción real: tierranativasa.com (IIS, 200 estable, embebible). El Pages github.io NO sirve para navegadores
  // ("There isn't a GitHub Pages site here": el Pages de ese repo no está publicado, típico de repo privado), así que
  // no se usa. Pendiente: deployar gt-solo-carga.js a IIS para que recorte a sólo los 3 módulos; hasta entonces el iframe
  // cae en #carga-pedidos (Cargar Cotizadores) mostrando el admin completo.
  MAYORISTA_ADMIN_URL: "https://tierranativasa.com/admin.html",
};

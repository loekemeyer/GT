// Producción GT — configuración. La clave es la PUBLISHABLE del proyecto (pública a propósito):
// el celular sólo puede llamar a las RPC public.gt_*, no leer ni escribir el schema gt.
window.GT_CFG = {
  SUPABASE_URL: "https://hrxfctzncixxqmpfhskv.supabase.co",
  SUPABASE_KEY: "sb_publishable_BqpAgZH6ty-9wft10_YMhw_0rcIPuWT",
  APP_VERSION: "1.70",
  // Cargar pedido (Tomás G, 05/11/2026): mismo patrón que GV («Cargar pedido» = iframe al admin, no copia de código).
  // GT embebe el admin del mayorista de TN en modo solo-carga (gt_cp=1#carga-pedidos). La carga vive en el mayorista
  // (proyecto zjvpzqhbekxnwxdczpof): lo que cambie ahí se ve acá solo. Cambiar la base acá si el dominio pasa a tierravintage.com.ar.
  MAYORISTA_ADMIN_URL: "https://loekemeyer.github.io/Elias/admin.html",
};

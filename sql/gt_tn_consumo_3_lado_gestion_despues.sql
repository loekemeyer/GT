-- GT — consumo de Tierra Nativa, PASO 3 (lado Gestión): se corre cuando el paso 1 ya corrió en Tierra Nativa.
--   1) la vista de TN entra al schema gt_tn por el FDW · 2) primera corrida · 3) cron diario 06:35 ART.
-- Rollback: select cron.unschedule('gt-sync-consumo-tn');
import foreign schema public limit to (gt_proyeccion) from server tn_db into gt_tn;
select * from gt.sync_consumo_tn();
select cron.schedule('gt-sync-consumo-tn', '35 9 * * *', $$select gt.sync_consumo_tn()$$);
-- Chequeos:
--   select * from gt.consumo_tn order by proy_cajas_mes desc limit 20;
--   select codigo, maximo_cajas, maximo_consumo_cajas, maximo_rige, consumo_cajas_mes, a_fabricar_cajas from gt.demanda_producto order by consumo_cajas_mes desc nulls last limit 20;

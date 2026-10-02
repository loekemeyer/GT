-- Borra las pruebas de la app de GT (todo lo anterior al lunes 05/10/2026 00:00 ART). D62, 02/10/2026.
-- Se corre en el SQL Editor de Supabase (proyecto hrxfctzncixxqmpfhskv): el conector de Claude corta los DELETE a los 60 s.
-- Alcanza con correrlo UNA vez: desde gt_v158 lo que llegue con hora anterior al lunes (pruebas del fin de semana o de un
-- celular sin red) no entra a gt.registros. No toca empleados, áreas, códigos, recetas, horarios, consumo ni pedidos.
--
-- Respaldo (ya hecho el 02/10, con RLS): gt.bkp_registros_pruebas_20261002 (183), gt.bkp_parejas_pruebas_20261002 (5),
-- gt.bkp_monitor_ingresos_pruebas_20261002 (7). Para volver atrás: insert into gt.registros select * from gt.bkp_registros_pruebas_20261002;
-- (ojo: el insert vuelve a disparar los avisos de Telegram de los triggers de gt.registros)

delete from gt.parejas          where creada     < '2026-10-05 00:00-03';
delete from gt.registros        where ts_cliente < '2026-10-05 00:00-03';
delete from gt.monitor_ingresos where ts         < '2026-10-05 00:00-03';

-- verificación: las tres en 0 (antes del lunes)
select (select count(*) from gt.registros) registros, (select count(*) from gt.parejas) parejas, (select count(*) from gt.monitor_ingresos) monitor;

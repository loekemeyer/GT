-- GT 1.4 (01/10/2026, Thomas) — APLICADO (migración gt_v14_horario_por_dia).
-- Horario por DÍA DE LA SEMANA: gt.horario_dia (isodow 1 = lunes). Manda sobre gt.horario_empleado y gt.config.
-- sin_almuerzo = ese día trabaja de corrido (los avisos no le piden almuerzo).
-- Lautaro Durante: lun/mié/jue/vie 08:00 · almuerzo 12:40–13:00 · salida 17:30; martes 08:00 a 13:30 de corrido.
-- Ver un día: select * from gt.jornada_estado(date '2026-10-06');
insert into gt.horario_dia (empleado_id, dow, entrada, almuerzo_desde, almuerzo_hasta, salida, sin_almuerzo, nota)
select e.id, v.dow, '08:00', v.ad::time, v.ah::time, v.sa::time, v.sin, 'Thomas, 01/10/2026'
  from gt.empleados e,
       (values (1,'12:40','13:00','17:30',false), (2,null,null,'13:30',true), (3,'12:40','13:00','17:30',false),
               (4,'12:40','13:00','17:30',false), (5,'12:40','13:00','17:30',false)) v(dow, ad, ah, sa, sin)
 where e.nombre = 'Lautaro Durante'
on conflict (empleado_id, dow) do update set almuerzo_desde = excluded.almuerzo_desde, almuerzo_hasta = excluded.almuerzo_hasta,
  salida = excluded.salida, sin_almuerzo = excluded.sin_almuerzo;
update gt.horario_empleado set almuerzo_flexible = false where empleado_id = (select id from gt.empleados where nombre = 'Lautaro Durante');

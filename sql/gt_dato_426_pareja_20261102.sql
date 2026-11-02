-- 02/11/2026 (Angely, D7/D21): corrección de DATOS, ya aplicada en la base. NO es una migración: no se vuelve a correr.
-- Contraído 426 del 05/10: Walter (empleado 8) y Javier (empleado 1) abrieron el mismo código con 1,5 s de diferencia SIN sumarse
-- (ninguna fila con marca de pareja) y cerraron con 0,3 s de diferencia, cada uno con 25 cajas. Emblistado hizo 25 cajas (400 u) ese día:
-- Contraído contó 50 (800 u). Se deja la carga en Walter (abrió primero) y Javier queda como el que se sumó, sin cajas
-- (la misma forma que deja gt.trg_pareja_une cuando alguien toca «Tocá para sumarte»).
-- Efecto medido después: Contraído 426 +560 -> +160 u · FILM -21.600 -> -21.200 · Emblistado 426 y caja 40*15 sin cambio (conteo del 29/10).
-- Resultado de la sentencia: pareja_id 150, 2 filas de Javier, 2 de Walter.
-- Para deshacer: Javier -> detalle null y cantidad 25 en el cierre e0b5d4e2-...; Walter -> detalle null en sus dos filas;
-- la fila 150 de gt.parejas se borra a mano (el conector pide confirmar los DELETE).
with p as (
  insert into gt.parejas (client_id, de_id, para_id, rubro, texto, medida, planta, ts, estado, respondida, creada)
  select r.client_id, r.empleado_id, 1, 'CONTR', '426', r.medida, 'PELL', r.ts_cliente, 'aceptada',
         '2026-10-05 13:35:14.286-03', '2026-10-05 13:35:14.286-03'
    from gt.registros r where r.id = '1b222bed-6bca-4c1c-a3b3-159b3b52e63e'
  returning id
), javier as (
  update gt.registros
     set detalle  = coalesce(detalle, '{}'::jsonb) || jsonb_build_object(
                      '_une', 'a428a50e-3c16-4bc0-84a6-2483abf8b9d3', 'pareja', 'con Walter Saucedo', '_invitado', (select id from p)),
         cantidad = case when ts_inicio is not null then null else cantidad end
   where id in ('89c30ebd-747e-471a-abc6-fd7273a6540e', 'e0b5d4e2-0c90-4825-860d-6a7b85b83d22')
  returning id
), walter as (
  update gt.registros
     set detalle = coalesce(detalle, '{}'::jsonb) || jsonb_build_object('pareja', 'con Javier Burgos')
   where id in ('1b222bed-6bca-4c1c-a3b3-159b3b52e63e', 'a64ab397-2498-4281-aa82-f411d6a94731')
  returning id
)
select (select id from p) as pareja_id, (select count(*) from javier) as filas_javier, (select count(*) from walter) as filas_walter;

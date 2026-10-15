-- 1.63 (Thomas, 15/10/2026): Darío entra con Google; la base mira el mail del JWT y devuelve su clave personal.
-- Aplicada como migración gt_v164_login_google.
alter table gt.clave_personal add column if not exists email text;
update gt.clave_personal set email = 'dariomendez1541@gmail.com' where empleado_id = 6;
-- función: ver public.gt_google_llave() (sólo authenticated; devuelve {ok, llave})

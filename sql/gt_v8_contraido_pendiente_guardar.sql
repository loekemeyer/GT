-- GT v8.0 (01/10/2026, Thomas, D10: «se nutre de lo que salió de Contraído») — APLICADO.
-- Lo que salió de Contraído y todavía no se guardó en góndola, por código: cierres de CONTR menos cierres de GUARD.
-- La app lo muestra como botones al empezar Guardado a góndola.
-- Rollback: drop function public.gt_contraido_pendiente();
create or replace function public.gt_contraido_pendiente()
returns table (codigo text, descripcion text, cajas numeric)
language sql stable security definer set search_path = '' as $$
  with mov as (
    select upper(btrim(r.texto)) cod,
           sum(case when r.rubro = 'CONTR' then r.cantidad else -r.cantidad end) saldo
      from gt.registros r
     where r.opcion = 'AREA' and r.ts_inicio is not null and r.cantidad is not null
       and r.rubro in ('CONTR', 'GUARD') and coalesce(btrim(r.texto), '') <> ''
     group by 1)
  select m.cod, c.descripcion, m.saldo
    from mov m left join gt.codigos c on upper(c.codigo) = m.cod
   where m.saldo > 0
   order by m.saldo desc, m.cod;
$$;
revoke all on function public.gt_contraido_pendiente() from public;
grant execute on function public.gt_contraido_pendiente() to anon, authenticated;

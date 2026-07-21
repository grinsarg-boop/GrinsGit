-- 044 — "A liquidar de ML": la plata de las ventas de ML queda retenida en el MP de Santi
-- (MP Santi = MP DERMATECH, misma cuenta) hasta la fecha de liberación (~28 días desde la
-- aprobación). mp_release_date/mp_net salen del MISMO fetch del pago en MP que ya hace
-- enrichMlTaxes (043); neto = plata real que libera (ya sin comisión, flete ni retenciones).
-- Liberado vs pendiente se deriva por fecha (release <= hoy), no se re-consulta el estado.

alter table ml_orders add column if not exists mp_release_date date;
alter table ml_orders add column if not exists mp_net numeric;

-- Neto pendiente de liberar, por semana (lunes) de la fecha de liberación.
create or replace function ml_a_liquidar()
returns table (semana date, pagos int, neto numeric)
language sql stable as $$
  select date_trunc('week', mp_release_date)::date,
         count(*)::int,
         coalesce(sum(mp_net), 0)
  from ml_orders
  where status = 'paid'
    and mp_release_date >= (now() at time zone 'America/Argentina/Buenos_Aires')::date
  group by 1
  order by 1
$$;

revoke execute on function ml_a_liquidar() from anon;
grant execute on function ml_a_liquidar() to authenticated, service_role;

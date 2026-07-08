-- 007 — Agregación del dashboard server-side (deploy hardening, FASE 1a).
-- El resumen agregaba daily_pnl en JS sobre una lectura paginable. Aunque hoy es ≤300 filas
-- (30 días × 2 couriers × 5 productos, imposible pasar el límite de 1000 de PostgREST), la regla es
-- que TODA agregación viva en SQL. Esta RPC read-only devuelve el resumen por día ya sumado (across
-- producto, y across courier si p_courier es null). No toca ninguna función/dato validado.

create or replace function dashboard_days(p_from date, p_courier text default null)
returns table (
  dispatch_date date, despachadas int, entregadas int, resueltas int,
  revenue_confirmado numeric, profit_confirmado numeric, ads numeric
) language sql stable as $$
  select s.dispatch_date,
         sum(s.despachadas)::int,
         sum(s.entregadas)::int,
         sum(s.entregadas + s.rehusadas + s.en_devolucion + s.devueltas + s.siniestros)::int,
         sum(s.revenue_confirmado),
         sum(s.profit_confirmado),
         sum(s.ads)
  from daily_pnl s
  where s.dispatch_date >= p_from
    and (p_courier is null or s.courier = p_courier)
  group by s.dispatch_date
  order by s.dispatch_date desc
$$;

-- Read-only: la puede ejecutar el dashboard (service role) y un usuario autenticado.
grant execute on function dashboard_days(date, text) to authenticated, service_role;

-- F1-13 · Tasa de entrega semanal por courier, para los small multiples de /ventas.
--
-- Por día de VENTA (sales_rows), igual que todo /ventas y /tendencias: por día de despacho un domingo
-- con 2 guías da 0% o 100% de puro n chico y arrastra la serie (auditoría 20/07).
--
-- Va como RPC y no como select directo porque la agregación por semana × courier sobre 90 días son
-- ~500 filas de daily_pnl antes de agrupar, y PostgREST trunca en 1000 sin avisar. Acá vuelven ~50.
--
-- La primera semana que devuelve suele estar cortada (p_desde cae en cualquier día): el panel la
-- descarta. `despachadas` viaja para poder marcar las semanas de muestra chica.
create or replace function entrega_semanal(p_desde date)
returns table (semana date, courier text, despachadas int, entregadas int)
language sql stable as $$
  select date_trunc('week', r.d)::date, r.c, sum(r.despachadas)::int, sum(r.entregadas)::int
  from sales_rows(p_desde) r
  group by 1, 2
  having sum(r.despachadas) > 0
  order by 1, 2
$$;

revoke execute on function entrega_semanal(date) from anon;
grant execute on function entrega_semanal(date) to authenticated, service_role;

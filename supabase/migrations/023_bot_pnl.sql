-- 023 — bot_pnl: resumen del P&L para el asistente de WhatsApp (App-Gastos).
-- El bot llama esta RPC con la ANON key + un secreto dedicado (settings.bot_read_secret,
-- se siembra por service role, NO va en git). SECURITY DEFINER: bypassa RLS pero expone
-- SOLO este agregado; sin el secreto devuelve null. La anon key sola sigue sin leer nada.

create or replace function bot_pnl(p_secret text)
returns jsonb
language sql stable security definer set search_path = public as $$
select case
  when p_secret is null
    or p_secret is distinct from (select value #>> '{}' from settings where key = 'bot_read_secret')
  then null
  else jsonb_build_object(
    'generado', current_date,
    'nota', 'montos en ARS; profit = margen de contribución (sin costos fijos); conf = cohortes resueltas, est = proyección por madurez',
    'total_7d', (
      select jsonb_build_object(
        'despachadas', coalesce(sum(despachadas), 0),
        'revenue_conf', coalesce(sum(revenue_confirmado), 0)::bigint,
        'profit_conf', coalesce(sum(profit_confirmado), 0)::bigint,
        'profit_est', coalesce(sum(profit_estimado), 0)::bigint,
        'ads', coalesce(sum(ads), 0)::bigint)
      from daily_pnl where dispatch_date >= current_date - 7),
    'total_30d', (
      select jsonb_build_object(
        'despachadas', coalesce(sum(despachadas), 0),
        'revenue_conf', coalesce(sum(revenue_confirmado), 0)::bigint,
        'profit_conf', coalesce(sum(profit_confirmado), 0)::bigint,
        'profit_est', coalesce(sum(profit_estimado), 0)::bigint,
        'ads', coalesce(sum(ads), 0)::bigint)
      from daily_pnl where dispatch_date >= current_date - 30),
    'por_canal_30d', (
      select coalesce(jsonb_object_agg(courier, o), '{}'::jsonb) from (
        select courier, jsonb_build_object(
          'despachadas', sum(despachadas),
          'entregadas', sum(entregadas),
          'profit_conf', sum(profit_confirmado)::bigint,
          'profit_est', sum(profit_estimado)::bigint) as o
        from daily_pnl where dispatch_date >= current_date - 30
        group by courier) t),
    'por_producto_7d', (
      select coalesce(jsonb_object_agg(name, o), '{}'::jsonb) from (
        select p.name, jsonb_build_object(
          'despachadas', sum(d.despachadas),
          'profit_est', sum(d.profit_estimado)::bigint) as o
        from daily_pnl d join products p on p.id = d.product_id
        where d.dispatch_date >= current_date - 7
        group by p.name) t),
    'ultimos_dias', (
      select coalesce(jsonb_agg(o order by fecha desc), '[]'::jsonb) from (
        select dispatch_date as fecha, jsonb_build_object(
          'fecha', dispatch_date,
          'despachadas', sum(despachadas),
          'profit_conf', sum(profit_confirmado)::bigint,
          'profit_est', sum(profit_estimado)::bigint,
          'pct_resuelto', round(avg(pct_resuelto))) as o
        from daily_pnl where dispatch_date >= current_date - 10
        group by dispatch_date) t)
  )
end
$$;

revoke all on function bot_pnl(text) from public;
grant execute on function bot_pnl(text) to anon, authenticated, service_role;

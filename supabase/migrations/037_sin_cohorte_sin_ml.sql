-- 037 — El ads_sin_cohorte de sales_days se contaminaba con los Product Ads de ML (bug desde la 028).
--
-- sin = spend META del día − ads asignada, pero la asignada sumaba también las filas ML, cuyos ads
-- salen de ml_ad_spend (no de Meta). Resultado: sin ≈ −ML ads (verificado en prod: 18/07 sin=−200.828
-- y ml_ad_spend=200.828, idénticos). Como /ventas y /tendencias hacen profit − sin, restar ese negativo
-- le DEVOLVÍA al profit los ads de ML que la fila ML ya había descontado (~$2,2M de más en julio).
--
-- Fix: excluir las filas ML de la resta. Misma firma → create or replace, sin drop.

create or replace function sales_days(p_from date, p_courier text default null)
returns table (
  sale_date date, generadas int, despachadas int, entregadas int, resueltas int, trabadas int,
  revenue_confirmado numeric, revenue_estimado numeric,
  profit_confirmado numeric, profit_estimado numeric,
  flete numeric, comisiones numeric, ads numeric, ads_sin_cohorte numeric
) language sql stable as $$
  with r as (select * from sales_rows(p_from)),
  -- sin cohorte: spend de META del día que no ancló a ninguna venta. Se calcula sobre todas las filas
  -- del día ANTES de filtrar por courier (es whole-business), pero EXCLUYENDO ml: sus Product Ads no
  -- salen de ad_spend y restar plata que Meta no gastó daba sin negativo (037).
  sc as (
    select ad.dd, ad.total - coalesce((select sum(x.ads) from r x where x.d = ad.dd and x.c <> 'ml'), 0) as sin
    from (select date as dd, sum(spend) as total from ad_spend where date >= p_from group by 1) ad
  )
  select r.d, sum(r.generadas)::int, sum(r.despachadas)::int, sum(r.entregadas)::int, sum(r.resueltas)::int,
         sum(r.trabadas)::int,
         sum(r.revenue_conf), sum(r.revenue_est), sum(r.profit_conf), sum(r.profit_est),
         sum(r.flete), sum(r.comisiones), sum(r.ads),
         case when p_courier is null then coalesce((select sc.sin from sc where sc.dd = r.d), 0) else 0 end
  from r
  where p_courier is null or r.c = p_courier
  group by r.d
  order by r.d desc
$$;

revoke execute on function sales_days(date, text) from anon;
grant execute on function sales_days(date, text) to authenticated, service_role;

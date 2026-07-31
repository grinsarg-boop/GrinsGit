-- F1-11 · Ads por FUENTE: Meta y ML en columnas paralelas.
--
-- El total ya estaba bien: `dashboard_days` y `sales_days` suman daily_pnl sobre todos los couriers,
-- y la rama 'ml' trae los Product Ads desde la 062, así que la premisa del backlog ("la columna Ads
-- subestima 22% porque no suma ML") quedó vieja — verificado contra prod el 30/07: últimos 30 días,
-- $15.759.537 de Meta + $5.648.386 de ML = $21.407.923, exactamente lo que devuelve dashboard_days.
--
-- Lo que SÍ falta es el desglose: un cuarto de la pauta es ML y el panel no lo dice en ningún lado.
-- Son dos plataformas con economías distintas (ML se puja por publicación y su ACOS anda en 4,55%;
-- Meta se puja por conjunto y su CPA es otro orden) y hoy se leen como un solo número, que no es
-- accionable — no se puede saber cuál de las dos movió el ROAS del día.
--
-- Una sola columna nueva, `ads_ml`, al final de cada RPC: Meta = ads − ads_ml, sin repetir el dato.
-- Se agrega al final para no correr las que ya están (PostgREST devuelve objetos por nombre, pero
-- los tests de SQL leen por posición).

drop function if exists dashboard_days(date, text);
create or replace function dashboard_days(p_from date, p_courier text default null)
returns table (
  dispatch_date date, despachadas int, entregadas int, resueltas int, en_transito int,
  proyectadas numeric, revenue_confirmado numeric, revenue_estimado numeric,
  profit_confirmado numeric, profit_estimado numeric,
  flete numeric, comisiones numeric, ads numeric, ads_sin_cohorte numeric, percepciones numeric,
  ads_ml numeric
) language sql stable as $$
  select s.dispatch_date,
         sum(s.despachadas)::int,
         sum(s.entregadas)::int,
         sum(s.entregadas + s.rehusadas + s.en_devolucion + s.devueltas + s.siniestros)::int,
         sum(s.en_transito)::int,
         sum(coalesce(s.tasa_proyectada, 0) * s.despachadas),   -- entregas proyectadas del día (§4.7)
         sum(s.revenue_confirmado),
         sum(s.revenue_estimado),
         sum(s.profit_confirmado),
         sum(s.profit_estimado),
         sum(s.flete),
         sum(s.comisiones),
         sum(s.ads),
         -- #11: pauta del día NO atribuida a ninguna cohorte — costo real que las cards 7d/30d deben
         -- restar. Solo en la vista "Todos" (p_courier null); es un costo whole-business, no de un courier.
         case when p_courier is null
              then coalesce((select sum(v.spend) from v_ads_sin_cohorte v where v.date = s.dispatch_date), 0)
              else 0 end,
         sum(s.percepciones),
         -- Product Ads de MercadoLibre: la parte de `ads` que NO es Meta. El resto (ads − ads_ml) es
         -- pauta de Meta repartida por cohorte.
         sum(s.ads) filter (where s.courier = 'ml')
  from daily_pnl s
  where s.dispatch_date >= p_from
    and (p_courier is null or s.courier = p_courier)
  group by s.dispatch_date
  order by s.dispatch_date desc
$$;

revoke execute on function dashboard_days(date, text) from anon;
grant execute on function dashboard_days(date, text) to authenticated, service_role;

drop function if exists sales_days(date, text);
create or replace function sales_days(p_from date, p_courier text default null)
returns table (
  sale_date date, generadas int, despachadas int, entregadas int, resueltas int, trabadas int,
  revenue_confirmado numeric, revenue_estimado numeric,
  profit_confirmado numeric, profit_estimado numeric,
  flete numeric, comisiones numeric, ads numeric, ads_sin_cohorte numeric, percepciones numeric,
  ads_ml numeric
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
         case when p_courier is null then coalesce((select sc.sin from sc where sc.dd = r.d), 0) else 0 end,
         sum(r.percepciones),
         sum(r.ads) filter (where r.c = 'ml')
  from r
  where p_courier is null or r.c = p_courier
  group by r.d
  order by r.d desc
$$;

revoke execute on function sales_days(date, text) from anon;
grant execute on function sales_days(date, text) to authenticated, service_role;

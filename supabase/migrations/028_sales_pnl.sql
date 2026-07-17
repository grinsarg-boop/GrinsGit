-- 028 — Panel "Ventas": P&L por día de VENTA (espejo read-only del panel por día de despacho).
--
-- El dashboard (dashboard_days) cohortea el COD por s.dispatched_at (día que la guía salió). Esta RPC
-- cohortea por el día en que se GENERÓ la venta = orders.created_at en día Argentina, y agrega el conteo
-- de "ventas generadas" de cada día (todas las órdenes creadas, se hayan despachado o no).
--
-- Reparto por canal:
--   · Correo y ML ya cohortean por created_at en daily_pnl (su dispatch_date ES el día de venta) → se leen
--     tal cual, sin recomputar.
--   · COD (urbano/fixy) se recomputa on-demand desde orders+shipments con eje created_at. La MATEMÁTICA de
--     plata es idéntica a la de recompute_daily_pnl (018/022): mismo prior P(entrega), mismo no_despachado,
--     mismas fórmulas §4.2–4.7. Solo cambia el eje temporal y que se parte de `orders` (no de shipments) para
--     contar también las generadas que aún no se despacharon. Se DUPLICA a propósito para no tocar la función
--     validada al peso; sales_check.sql ancla la paridad monto-a-monto contra recompute_daily_pnl.
--
-- Modelo del estimado (conservador, coincide con la preferencia del dueño): una venta COD generada aporta
-- profit_confirmado si se despachó y entregó, y profit_estimado proyectando SOLO lo ya despachado-en-tránsito
-- con el prior. Las generadas que todavía no se despacharon cuentan en `generadas` pero aportan profit 0
-- (no se inventa un P(despacho)) → los días de venta muy recientes maduran a medida que se despachan; la
-- página lo marca con la barra de "madurez de despacho" (despachadas/generadas).
--
-- Ads: el gasto de Meta del día natural (ad_spend.date) se reparte por VENTAS GENERADAS ponderadas de ese
-- día entre urbano/fixy/correo (Fixy ×fixy_cpa_multiplier; correo por generados) → el CPA de adquisición real
-- del día. ML no entra en este reparto: su ads son Product Ads de ML (columna ads de daily_pnl, ya por venta),
-- pasa directo. Correo trae su ads de Meta de daily_pnl y se le re-reparte por venta (se le devuelve el ads
-- ya restado y se le vuelve a restar la porción por-venta) → sin doble conteo.

create or replace function sales_days(p_from date, p_courier text default null)
returns table (
  sale_date date, generadas int, despachadas int, entregadas int, resueltas int,
  revenue_confirmado numeric, revenue_estimado numeric,
  profit_confirmado numeric, profit_estimado numeric, ads numeric, ads_sin_cohorte numeric
) language plpgsql stable as $fn$
#variable_conflict use_column   -- los nombres del RETURNS TABLE (generadas, despachadas, …) coinciden con
                                -- columnas de las CTE; ante ambigüedad gana la columna (nunca leo los OUT).
declare
  v_comm jsonb   := (select value from settings where key = 'commission_pct');
  v_mp   numeric := (select (value::text)::numeric from settings where key = 'mp_fee_pct');
  v_fw   numeric := (select (value::text)::numeric from settings where key = 'fixy_cpa_multiplier');
begin
return query
with
  -- Universo COD por venta: órdenes Shopify no-cuotas, no canceladas, con producto. El courier de la venta
  -- es el ruteo de Shopify (o el del 1er envío si Shopify no lo trae). Se usa para agrupar Y para la comisión.
  cod_orders as (
    select o.id,
           (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date as d,
           order_primary_product(o.id) as p,
           coalesce(o.courier,
             (select s2.courier from shipments s2 where s2.order_id = o.id
               order by s2.dispatched_at, s2.id limit 1)) as c,
           o.cod_amount as cod, o.deposit_amount as dep, o.province as prov
    from orders o
    where o.cancelled_at is null
      and (o.tags is null or lower(o.tags) not like '%cuotas_3%')
      and order_primary_product(o.id) is not null
      and (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date >= p_from
  ),
  -- Ventas generadas por (día, canal, producto) — universo completo, incluye las no despachadas todavía.
  -- Sin filtrar por canal: una orden recién creada que Shopify no ruteó aún (courier null) y sin despachar
  -- igual es una venta generada; cae con c = null → cuenta en "Todos", no en un courier puntual (no se inventa).
  cod_gen as (
    select d, c, p, count(*)::int as generadas from cod_orders group by 1,2,3
  ),
  -- Guías de esas órdenes: misma matemática por-envío que recompute_daily_pnl (018/022), eje = día de venta.
  -- La PLATA (no_despachado, flete, prior, comisión) usa s.courier (el courier REAL de la guía), igual que el
  -- recompute — no el de la orden: una orden ruteada a un courier y despachada por otro cobra la comisión/
  -- prior del courier que efectivamente la llevó. dispatched_at not null replica el `between p_from and p_to`
  -- del recompute (una guía sin fecha de despacho no cuenta como despachada).
  cod_ship as (
    select co.d, s.courier as c, co.p,
           case when ((s.courier = 'urbano' and s.status_raw = 'PI')
                   or (s.courier = 'fixy' and (s.status_raw = '41'
                        or lower(coalesce(s.status_raw, '')) like '%pendiente de retiro%')))
                     and current_date - s.dispatched_at > 7
                  then 'no_despachado' else s.status_canonical end as st,
           case when ((s.courier = 'urbano' and s.status_raw = 'PI')
                   or (s.courier = 'fixy' and (s.status_raw = '41'
                        or lower(coalesce(s.status_raw, '')) like '%pendiente de retiro%')))
                     and current_date - s.dispatched_at > 7
                  then 0
                when s.courier = 'urbano' and s.freight_tarifa is null and s.freight_cost is null
                  then estimate_urbano_freight(s.province)          -- flete estimado inline (recompute lo hace por UPDATE)
                else coalesce(s.freight_cost, 0) end as fc,
           co.cod as cod,
           -- la seña es del PEDIDO → contarla una vez, en la 1a guía despachada del order_id
           case when row_number() over (partition by co.id order by s.dispatched_at, s.id) = 1
                then co.dep else 0 end as dep,
           coalesce((select sum(oi.qty * coalesce(pc.unit_cost, 0))
                       from order_items oi
                       left join product_costs pc
                              on pc.product_id = oi.product_id and pc.pack = oi.pack
                      where oi.order_id = co.id), 0) as ucost,
           coalesce(
             (select dp.p_delivery from delivery_priors dp
                where dp.courier = s.courier and dp.province = coalesce(s.province, co.prov)
                  and dp.product_id = co.p),
             (select dp.p_delivery from delivery_priors dp
                where dp.courier = s.courier and dp.province = coalesce(s.province, co.prov)
                  and dp.product_id is null),
             (select dp.p_delivery from delivery_priors dp
                where dp.courier = s.courier and dp.province is null and dp.product_id is null),
             0) as prior
    from cod_orders co
    join shipments s on s.order_id = co.id
    where s.status_canonical <> 'cancelado'
      and s.dispatched_at is not null
  ),
  cod_agg as (
    select d, c, p,
      count(*) filter (where st <> 'no_despachado')::int as despachadas,
      count(*) filter (where st = 'entregado')::int as entregadas,
      count(*) filter (where st in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro'))::int as resueltas,
      coalesce(sum(dep) * (1 - v_mp), 0) as senas_netas,
      coalesce(sum(cod) filter (where st = 'entregado'), 0) as cod_entregado,
      coalesce(sum(fc), 0) as flete,
      coalesce(sum(ucost) filter (where st in ('entregado','siniestro')), 0) as costo,
      coalesce(sum(prior * cod) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro','no_despachado')), 0) as est_cod,
      coalesce(sum(prior * ucost) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro','no_despachado')), 0) as est_cost
    from cod_ship group by 1,2,3
  ),
  -- Pesos para repartir el gasto de Meta por VENTA generada (Fixy pondera ×fw; correo por generados).
  gen_weights as (
    select d, c, p, (generadas * case when c = 'fixy' then v_fw else 1 end)::numeric as w
      from cod_gen
    union all
    select dispatch_date, 'correo'::text, product_id, despachadas::numeric
      from daily_pnl where courier = 'correo'
  ),
  ads_alloc as (
    select w.d, w.c, w.p,
           sp.spend * w.w / nullif(sum(w.w) over (partition by w.d, w.p), 0) as ads
    from gen_weights w
    join (select date, product_id, sum(spend) as spend from ad_spend
           where date >= p_from and product_id is not null group by 1,2) sp
      on sp.date = w.d and sp.product_id = w.p
  ),
  -- Gasto de Meta del día que NO se pudo anclar a ninguna venta generada (producto sin ventas ese día, o
  -- spend sin producto) → sin cohorte, como en dashboard_days: costo real que la página resta del profit.
  sin_cohorte_dia as (
    select ad.d, ad.total - coalesce(rep.rep, 0) as sin
    from (select date as d, sum(spend) as total from ad_spend where date >= p_from group by date) ad
    left join (select d, sum(ads) as rep from ads_alloc group by d) rep on rep.d = ad.d
  ),
  -- COD: generadas (por courier de la orden) ⟗ profit por envío (por courier de la guía). FULL JOIN porque
  -- ambos couriers casi siempre coinciden, pero cuando difieren la generada cae en un canal y el profit en
  -- otro → filas separadas que se suman correctamente en "Todos". profit SIN ads (Meta se resta luego por-venta).
  cod_rows as (
    select coalesce(g.d, a.d) as d, coalesce(g.c, a.c) as c, coalesce(g.p, a.p) as p,
           coalesce(g.generadas, 0) as generadas,
           coalesce(a.despachadas, 0) as despachadas,
           coalesce(a.entregadas, 0) as entregadas,
           coalesce(a.resueltas, 0) as resueltas,
           coalesce(a.cod_entregado + a.senas_netas, 0) as revenue_conf,
           coalesce(a.cod_entregado + a.senas_netas + a.est_cod, 0) as revenue_est,
           coalesce(a.cod_entregado + a.senas_netas - a.flete
             - (v_comm->>a.c)::numeric * a.cod_entregado - a.costo, 0) as profit_conf_x,
           coalesce(a.cod_entregado + a.senas_netas - a.flete
             - (v_comm->>a.c)::numeric * a.cod_entregado - a.costo
             + a.est_cod * (1 - (v_comm->>a.c)::numeric) - a.est_cost, 0) as profit_est_x
    from cod_gen g full outer join cod_agg a on a.d = g.d and a.c = g.c and a.p = g.p
  ),
  -- Correo: ya está por día de venta en daily_pnl. Se le devuelve el ads de Meta (profit + ads) para volver
  -- a restarle la porción repartida por-venta más abajo.
  correo_rows as (
    select dispatch_date as d, 'correo'::text as c, product_id as p,
           despachadas as generadas, despachadas, entregadas,
           (entregadas + rehusadas + en_devolucion + devueltas + siniestros) as resueltas,
           revenue_confirmado as revenue_conf, revenue_estimado as revenue_est,
           profit_confirmado + ads as profit_conf_x, profit_estimado + ads as profit_est_x
    from daily_pnl where courier = 'correo'
  ),
  -- COD + correo con el ads de Meta por-venta ya restado.
  meta_rows as (
    select r.d, r.c, r.p, r.generadas, r.despachadas, r.entregadas, r.resueltas,
           r.revenue_conf, r.revenue_est,
           r.profit_conf_x - coalesce(al.ads, 0) as profit_conf,
           r.profit_est_x  - coalesce(al.ads, 0) as profit_est,
           coalesce(al.ads, 0) as ads
    from (select * from cod_rows union all select * from correo_rows) r
    left join ads_alloc al on al.d = r.d and al.c = r.c and al.p = r.p
  ),
  -- ML: directo de daily_pnl (su ads = Product Ads de ML, propio y ya por día de venta).
  ml_rows as (
    select dispatch_date as d, 'ml'::text as c, product_id as p,
           despachadas as generadas, despachadas, entregadas,
           (entregadas + rehusadas + en_devolucion + devueltas + siniestros) as resueltas,
           revenue_confirmado as revenue_conf, revenue_estimado as revenue_est,
           profit_confirmado as profit_conf, profit_estimado as profit_est, ads
    from daily_pnl where courier = 'ml'
  )
  select x.d, sum(x.generadas)::int, sum(x.despachadas)::int, sum(x.entregadas)::int, sum(x.resueltas)::int,
         sum(x.revenue_conf), sum(x.revenue_est), sum(x.profit_conf), sum(x.profit_est), sum(x.ads),
         -- sin cohorte: costo whole-business, solo en la vista "Todos" (igual que dashboard_days #11)
         case when p_courier is null
              then coalesce((select sc.sin from sin_cohorte_dia sc where sc.d = x.d), 0)
              else 0 end
  from (select * from meta_rows union all select * from ml_rows) x
  where x.d >= p_from and (p_courier is null or x.c = p_courier)
  group by x.d order by x.d desc;
end $fn$;

revoke execute on function sales_days(date, text) from anon;
grant execute on function sales_days(date, text) to authenticated, service_role;

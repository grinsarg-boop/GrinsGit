-- 067 · La madurez del día se traba en el prepago: los links de pago que nadie va a pagar.
--
-- Síntoma: días de julio ya cerrados con la barra de Madurez clavada en 60-85% para siempre
-- (09/07 = 64,9% al 02/08, con CERO guías en la calle). Nada por resolver y nunca llega a 100%.
--
-- Causa: `recompute_daily_pnl` YA da por perdida la orden cuotas_3 que sigue en `pending` pasados
-- los 10 días de `settings.maturity_days.correo` (rama `cagg.perdidos`) — el P&L no le proyecta un
-- peso y `tasa_cerrada` la cuenta cerrada. Pero al escribir la fila de correo en `daily_pnl` esos
-- perdidos no van a ninguna columna: rehusadas/en_devolucion/devueltas/siniestros quedan en 0 y
-- solo `en_transito` guarda los pendientes NO maduros. Los dos lectores de madurez sumaban
-- `entregadas + rehusadas + en_devolucion + devueltas + siniestros`, que en correo es `pagados` a
-- secas → la cohorte se congela en su tasa de confirmación (~40%) aunque esté 100% definida.
--
-- Fix: resuelto = `despachadas − en_transito` (todo lo que ya NO está esperando desenlace). Es una
-- identidad exacta en COD y ML —verificado contra prod: 0 filas de daily_pnl donde las dos formas
-- difieran salvo las 60 de correo, que son justo el bug— y en correo agrega los perdidos. Sin
-- recompute: `en_transito` ya está bien guardado, cambia solo la lectura, y toda la historia se
-- corrige sola. 09/07 pasa de 24/37 (64,9%) a 37/37 (100%).
--
-- Lo que NO arregla: las guías COD trabadas (sin movimiento 14+ días). Esas siguen sin resolverse
-- porque siguen abiertas de verdad — son plata reclamable y la ventana para cerrarlas es /trabados.

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
         sum(s.despachadas - s.en_transito)::int,   -- resueltas: lo que ya no espera desenlace (067)
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


drop function if exists sales_rows(date);
create or replace function sales_rows(p_from date)
returns table (
  d date, c text, p int, generadas int, despachadas int, entregadas int, resueltas int, trabadas int,
  revenue_conf numeric, revenue_est numeric, profit_conf numeric, profit_est numeric,
  flete numeric, comisiones numeric, ads numeric, percepciones numeric
) language plpgsql stable as $fn$
#variable_conflict use_column
declare
  v_comm jsonb   := (select value from settings where key = 'commission_pct');
  v_mp   numeric := (select (value::text)::numeric from settings where key = 'mp_fee_pct');
  v_fw   numeric := (select (value::text)::numeric from settings where key = 'fixy_cpa_multiplier');
begin
return query
with
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
  cod_gen as (
    select d, c, p, count(*)::int as generadas from cod_orders group by 1,2,3
  ),
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
                  then estimate_urbano_freight(s.province)
                else coalesce(s.freight_cost, 0) end as fc,
           co.cod as cod,
           coalesce(s.status_at, s.dispatched_at::timestamptz) as mov,
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
      count(*) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro','no_despachado')
        and mov < now() - interval '14 days')::int as trabadas,
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
  cod_rows as (
    select coalesce(g.d, a.d) as d, coalesce(g.c, a.c) as c, coalesce(g.p, a.p) as p,
           coalesce(g.generadas, 0) as generadas,
           coalesce(a.despachadas, 0) as despachadas,
           coalesce(a.entregadas, 0) as entregadas,
           coalesce(a.resueltas, 0) as resueltas,
           coalesce(a.trabadas, 0) as trabadas,
           coalesce(a.cod_entregado + a.senas_netas, 0) as revenue_conf,
           coalesce(a.cod_entregado + a.senas_netas + a.est_cod, 0) as revenue_est,
           coalesce(a.cod_entregado + a.senas_netas - a.flete
             - (v_comm->>a.c)::numeric * a.cod_entregado - a.costo, 0) as profit_conf_x,
           coalesce(a.cod_entregado + a.senas_netas - a.flete
             - (v_comm->>a.c)::numeric * a.cod_entregado - a.costo
             + a.est_cod * (1 - (v_comm->>a.c)::numeric) - a.est_cost, 0) as profit_est_x,
           -- Los dos son costos FINALES (plata ya comprometida), no proyecciones:
           -- flete: hundido, se paga por TODA guía despachada, entregue o no (§4.1).
           coalesce(a.flete, 0) as flete_x,
           -- comisiones: solo sobre COD efectivamente cobrado en puerta (§4.2). La comisión de lo que
           -- sigue en la calle NO se cuenta acá — vive implícita en est_cod × (1 − comm) del profit
           -- estimado. Misma definición que daily_pnl.comisiones, así los dos paneles coinciden.
           coalesce((v_comm->>a.c)::numeric * a.cod_entregado, 0) as comisiones_x
    from cod_gen g full outer join cod_agg a on a.d = g.d and a.c = g.c and a.p = g.p
  ),
  correo_rows as (
    select dispatch_date as d, 'correo'::text as c, product_id as p,
           despachadas as generadas, despachadas, entregadas,
           (despachadas - en_transito) as resueltas,   -- 067: en correo, pagados + perdidos
           0 as trabadas,
           revenue_confirmado as revenue_conf, revenue_estimado as revenue_est,
           profit_confirmado + ads as profit_conf_x, profit_estimado + ads as profit_est_x,
           flete as flete_x, comisiones as comisiones_x
    from daily_pnl where courier = 'correo'
  ),
  meta_rows as (
    select r.d, r.c, r.p, r.generadas, r.despachadas, r.entregadas, r.resueltas, r.trabadas,
           r.revenue_conf, r.revenue_est,
           r.profit_conf_x - coalesce(al.ads, 0) as profit_conf,
           r.profit_est_x  - coalesce(al.ads, 0) as profit_est,
           r.flete_x as flete, r.comisiones_x as comisiones,
           coalesce(al.ads, 0) as ads,
           0 as percepciones
    from (select * from cod_rows union all select * from correo_rows) r
    left join ads_alloc al on al.d = r.d and al.c = r.c and al.p = r.p
  ),
  ml_rows as (
    select dispatch_date as d, 'ml'::text as c, product_id as p,
           despachadas as generadas, despachadas, entregadas,
           (despachadas - en_transito) as resueltas,   -- 067: en correo, pagados + perdidos
           0 as trabadas,
           revenue_confirmado as revenue_conf, revenue_estimado as revenue_est,
           profit_confirmado as profit_conf, profit_estimado as profit_est,
           flete, comisiones, ads, percepciones
    from daily_pnl where courier = 'ml'
  )
  select x.d, x.c, x.p, x.generadas, x.despachadas, x.entregadas, x.resueltas, x.trabadas,
         x.revenue_conf, x.revenue_est, x.profit_conf, x.profit_est,
         x.flete, x.comisiones, x.ads, x.percepciones
  from (select * from meta_rows union all select * from ml_rows) x
  where x.d >= p_from;
end $fn$;

revoke execute on function sales_rows(date) from anon;
grant execute on function sales_rows(date) to authenticated, service_role;

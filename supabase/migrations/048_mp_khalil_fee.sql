-- 048: fee REAL de MercadoPago por orden en el canal cuotas/correo (cuenta MP Khalil).
-- Los links de pago del ecom llevan external_reference ORDER-<n> → conciliación exacta con
-- orders.order_number. Medido en julio (215 pagos, $10,8M): transferencia/1 cuota ~8%, Mercado
-- Crédito 3 cuotas ~7,6%, tarjeta 3 SIN interés ~22% (mercadopago_fee + financing_fee que absorbe
-- el vendedor; el comprador SIEMPRE paga el precio de lista) → blended 14,2% vs el 18% plano que
-- estimaba el P&L (~$410k/mes de profit sub-mostrado). El recompute usa el fee real del pago
-- conciliado y cae al 18% (settings.cuotas_commission) solo para órdenes pagadas sin pago matcheado.
-- mp_payments lo llena syncMpKhalil (token estático MP_KHALIL_ACCESS_TOKEN, solo refs ORDER-).

create table if not exists mp_payments (
  payment_id   bigint primary key,
  order_number text not null,
  amount       numeric not null,
  fee          numeric not null,          -- transaction_amount − net_received (mp fee + financing)
  installments int,
  approved_at  timestamptz,
  updated_at   timestamptz not null default now()
);
create index if not exists mp_payments_order_idx on mp_payments (order_number);
alter table mp_payments enable row level security;
drop policy if exists mp_payments_read on mp_payments;
create policy mp_payments_read on mp_payments for select to authenticated using (true);

-- recompute_daily_pnl: rama 'ml' con ads = Product Ads del día repartido por revenue del producto.
create or replace function recompute_daily_pnl(p_from date, p_to date) returns void
language plpgsql as $fn$
declare
  v_comm  jsonb   := (select value from settings where key = 'commission_pct');
  v_mp    numeric := (select (value::text)::numeric from settings where key = 'mp_fee_pct');
  v_fw    numeric := (select (value::text)::numeric from settings where key = 'fixy_cpa_multiplier');
  v_mat   jsonb   := (select value from settings where key = 'maturity_days');
  v_ccomm numeric := (select (value::text)::numeric from settings where key = 'cuotas_commission');
  v_flete numeric := (select (value::text)::numeric from settings where key = 'correo_flete');
  v_adsiva numeric := coalesce((select (value::text)::numeric from settings where key = 'ml_ads_iva'), 0);
begin
  insert into product_costs (product_id, pack, unit_cost, is_estimated)
  select distinct oi.product_id, oi.pack, pc1.unit_cost * oi.pack, true
  from order_items oi
  join shipments s on s.order_id = oi.order_id
       and s.dispatched_at between p_from and p_to
  join product_costs pc1 on pc1.product_id = oi.product_id and pc1.pack = 1
  where oi.product_id is not null and oi.pack <> 1
    and not exists (select 1 from product_costs pc
                     where pc.product_id = oi.product_id and pc.pack = oi.pack)
  on conflict do nothing;

  -- packs de ML sin fila de costo → extrapolar pack1 × pack (is_estimated). Revival y cualquier pack nuevo.
  insert into product_costs (product_id, pack, unit_cost, is_estimated)
  select distinct p.id, o.pack, pc1.unit_cost * o.pack, true
  from ml_orders o
  join products p on p.name = o.product
  join product_costs pc1 on pc1.product_id = p.id and pc1.pack = 1
  where o.status = 'paid' and o.pack <> 1
    and not exists (select 1 from product_costs pc where pc.product_id = p.id and pc.pack = o.pack)
  on conflict do nothing;

  update shipments
     set freight_cost = estimate_urbano_freight(province), freight_is_estimated = true
  where courier = 'urbano' and freight_tarifa is null
    and dispatched_at between p_from and p_to;

  delete from daily_pnl where dispatch_date between p_from and p_to;

  insert into daily_pnl (dispatch_date, courier, product_id,
    despachadas, entregadas, rehusadas, en_devolucion, devueltas, siniestros, en_transito,
    pct_resuelto, tasa_actual, tasa_proyectada,
    revenue_confirmado, revenue_estimado, senas_netas, flete, flete_estimado_pct,
    costo_producto, comisiones, percepciones, ads, profit_confirmado, profit_estimado, computed_at)
  with ship as (
    select s.dispatched_at as d, s.courier as c, order_primary_product(o.id) as p,
           case
             when ((s.courier = 'urbano' and s.status_raw = 'PI')
                or (s.courier = 'fixy' and (s.status_raw = '41'
                     or lower(coalesce(s.status_raw, '')) like '%pendiente de retiro%')))
                  and current_date - s.dispatched_at > 7
               then 'no_despachado'
             else s.status_canonical
           end as st,
           case
             when ((s.courier = 'urbano' and s.status_raw = 'PI')
                or (s.courier = 'fixy' and (s.status_raw = '41'
                     or lower(coalesce(s.status_raw, '')) like '%pendiente de retiro%')))
                  and current_date - s.dispatched_at > 7
               then 0
             else coalesce(s.freight_cost, 0)
           end as fc,
           s.freight_is_estimated as fe,
           o.cod_amount as cod,
           case when row_number() over (partition by o.id order by s.dispatched_at, s.id) = 1
                then o.deposit_amount else 0 end as dep,
           coalesce((select sum(oi.qty * coalesce(pc.unit_cost, 0))
                       from order_items oi
                       left join product_costs pc
                              on pc.product_id = oi.product_id and pc.pack = oi.pack
                      where oi.order_id = o.id), 0) as ucost,
           coalesce(
             (select dp.p_delivery from delivery_priors dp
                where dp.courier = s.courier and dp.province = coalesce(s.province, o.province)
                  and dp.product_id = order_primary_product(o.id)),
             (select dp.p_delivery from delivery_priors dp
                where dp.courier = s.courier and dp.province = coalesce(s.province, o.province)
                  and dp.product_id is null),
             (select dp.p_delivery from delivery_priors dp
                where dp.courier = s.courier and dp.province is null and dp.product_id is null),
             0) as prior
    from shipments s
    join orders o on o.id = s.order_id
    where s.dispatched_at between p_from and p_to
      and s.status_canonical <> 'cancelado'
      and order_primary_product(o.id) is not null
      and (o.tags is null or lower(o.tags) not like '%cuotas_3%')
  ),
  agg as (
    select d, c, p,
      count(*) filter (where st <> 'no_despachado')::int as despachadas,
      count(*) filter (where st = 'no_despachado')::int as no_despachadas,
      count(*) filter (where st = 'entregado')::int as entregadas,
      count(*) filter (where st = 'rehusado')::int as rehusadas,
      count(*) filter (where st = 'en_devolucion')::int as en_devolucion,
      count(*) filter (where st = 'devuelto')::int as devueltas,
      count(*) filter (where st = 'siniestro')::int as siniestros,
      count(*) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro','no_despachado'))::int as en_transito,
      sum(fc) as flete,
      case when sum(fc) > 0
           then coalesce(sum(fc) filter (where fe), 0) / sum(fc) else 0 end as flete_est_pct,
      sum(dep) * (1 - v_mp) as senas_netas,
      coalesce(sum(cod) filter (where st = 'entregado'), 0) as cod_entregado,
      coalesce(sum(ucost) filter (where st in ('entregado','siniestro')), 0) as costo,
      coalesce(sum(prior * cod) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro','no_despachado')), 0) as est_cod,
      coalesce(sum(prior * ucost) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro','no_despachado')), 0) as est_cost,
      coalesce(sum(prior) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro','no_despachado')), 0) as est_deliv
    from ship
    group by 1, 2, 3
  ),
  cuotas as (
    select (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date as d,
           order_primary_product(o.id) as p,
           o.financial_status as fin,
           o.deposit_amount as dep, o.cod_amount as cod,
           case when o.financial_status = 'paid'
                then coalesce(mp.fee, o.deposit_amount * v_ccomm) else 0 end as feer,
           ((o.created_at at time zone 'America/Argentina/Buenos_Aires')::date
              <= current_date - ((v_mat->>'correo')::int)) as matured,
           coalesce((select sum(oi.qty * coalesce(pc.unit_cost, 0))
                       from order_items oi
                       left join product_costs pc
                              on pc.product_id = oi.product_id and pc.pack = oi.pack
                      where oi.order_id = o.id), 0) as ucost,
           coalesce(
             (select dp.p_delivery from delivery_priors dp
                where dp.courier = 'correo' and dp.province is null
                  and dp.product_id = order_primary_product(o.id)),
             (select dp.p_delivery from delivery_priors dp
                where dp.courier = 'correo' and dp.province is null and dp.product_id is null),
             0) as prior
    from orders o
    left join (select order_number, sum(fee) as fee from mp_payments group by 1) mp
           on mp.order_number = o.order_number
    where o.cancelled_at is null and lower(o.tags) like '%cuotas_3%'
      and o.financial_status in ('paid','pending')
      and (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date between p_from and p_to
      and order_primary_product(o.id) is not null
  ),
  cagg as (
    select d, p,
      count(*)::int as generados,
      count(*) filter (where fin = 'paid')::int as pagados,
      count(*) filter (where fin = 'pending' and matured)::int as perdidos,
      count(*) filter (where fin = 'pending' and not matured)::int as en_transito,
      coalesce(sum(dep) filter (where fin = 'paid'), 0) as revenue,
      coalesce(sum(feer), 0) as comision,
      coalesce(sum(ucost) filter (where fin = 'paid'), 0) as costo,
      coalesce(sum(prior * cod) filter (where fin = 'pending' and not matured), 0) as est_cod,
      coalesce(sum(prior * ucost) filter (where fin = 'pending' and not matured), 0) as est_cost,
      coalesce(sum(prior) filter (where fin = 'pending' and not matured), 0) as est_conf
    from cuotas group by 1, 2
  ),
  ml as (
    -- Ventas ML pagadas. Cohorte por date_created en día Argentina (igual que correo).
    select (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date as d,
           pr.id as p, o.units, o.total_amount, o.sale_fee,
           coalesce(o.tax_withheld, 0) as retencion,
           coalesce(o.ship_cost, 0) as flete,
           (o.ship_cost is null) as flete_pend,
           o.units * coalesce(pc.unit_cost, 0) as ucost
    from ml_orders o
    join products pr on pr.name = o.product
    left join product_costs pc on pc.product_id = pr.id and pc.pack = o.pack
    where o.status = 'paid'
      and (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date between p_from and p_to
  ),
  magg as (
    select d, p,
      count(*)::int as vendidas,
      sum(total_amount) as revenue,
      sum(sale_fee) as comision,
      sum(retencion) as retencion,
      sum(flete) as flete,
      count(*) filter (where flete_pend)::int as flete_pend,
      sum(ucost) as costo
    from ml group by 1, 2
  ),
  ads_weights as (
    select a.d, a.c, a.p, ((a.despachadas + a.no_despachadas) * case when a.c = 'fixy' then v_fw else 1 end)::numeric as w from agg a
    union all
    select c.d, 'correo'::text, c.p, c.generados::numeric as w from cagg c
  ),
  ads_alloc as (
    select w.d, w.c, w.p,
           sp.spend_total * w.w / nullif(sum(w.w) over (partition by w.p), 0) as ads
    from ads_weights w
    join (select product_id, sum(spend) as spend_total from ad_spend
           where date between p_from and p_to and product_id is not null group by 1) sp
      on sp.product_id = w.p
  ),
  mlads as (
    select date, cost * (1 + v_adsiva) as cost from ml_ad_spend where date between p_from and p_to
  ),
  mlbonif as (
    select date, amount from ml_flex_bonif where date between p_from and p_to
  ),
  mlpercep as (
    select date, amount from ml_percepciones where date between p_from and p_to
  ),
  ml_alloc as (
    -- Product Ads del día repartido entre los productos ML de ese día por su revenue.
    select m.d, m.p, m.vendidas, m.revenue, m.comision, m.retencion, m.flete, m.flete_pend, m.costo,
      coalesce((select mm.cost from mlads mm where mm.date = m.d) * m.revenue
               / nullif(sum(m.revenue) over (partition by m.d), 0), 0) as ads,
      coalesce((select b.amount from mlbonif b where b.date = m.d) * m.revenue
               / nullif(sum(m.revenue) over (partition by m.d), 0), 0) as bonif,
      coalesce((select pp.amount from mlpercep pp where pp.date = m.d) * m.revenue
               / nullif(sum(m.revenue) over (partition by m.d), 0), 0) as percep
    from magg m
  )
  select a.d, a.c, a.p,
    a.despachadas, a.entregadas, a.rehusadas, a.en_devolucion, a.devueltas, a.siniestros, a.en_transito,
    coalesce((a.entregadas + a.rehusadas + a.en_devolucion + a.devueltas + a.siniestros)::numeric / nullif(a.despachadas, 0), 0),
    coalesce(a.entregadas::numeric / nullif(a.despachadas, 0), 0),
    coalesce((a.entregadas + a.est_deliv)::numeric / nullif(a.despachadas, 0), 0),
    a.cod_entregado + a.senas_netas,
    a.cod_entregado + a.senas_netas + a.est_cod,
    a.senas_netas, a.flete, a.flete_est_pct,
    a.costo,
    (v_comm->>a.c)::numeric * a.cod_entregado,
    0,
    coalesce(al.ads, 0),
    a.cod_entregado + a.senas_netas - a.flete
      - (v_comm->>a.c)::numeric * a.cod_entregado - a.costo - coalesce(al.ads, 0),
    a.cod_entregado + a.senas_netas - a.flete
      - (v_comm->>a.c)::numeric * a.cod_entregado - a.costo - coalesce(al.ads, 0)
      + a.est_cod * (1 - (v_comm->>a.c)::numeric) - a.est_cost,
    now()
  from agg a
  left join ads_alloc al on al.d = a.d and al.c = a.c and al.p = a.p
  union all
  select c.d, 'correo', c.p,
    c.generados, c.pagados, 0, 0, 0, 0, c.en_transito,
    (c.pagados + c.perdidos)::numeric / c.generados,
    c.pagados::numeric / c.generados,
    c.pagados::numeric / c.generados,
    c.revenue,
    c.revenue,
    0, v_flete * c.pagados, 0,
    c.costo,
    c.comision,
    0,
    coalesce(cal.ads, 0),
    c.revenue - c.comision - v_flete * c.pagados - c.costo - coalesce(cal.ads, 0),
    c.revenue - c.comision - v_flete * c.pagados - c.costo - coalesce(cal.ads, 0),
    now()
  from cagg c
  left join ads_alloc cal on cal.d = c.d and cal.c = 'correo' and cal.p = c.p
  union all
  -- filas ML: ya pagadas y entregadas por ML → sin proyección, sin priors. ads = Product Ads del día
  -- repartido por revenue del producto. flete_estimado_pct = fracción con flete pendiente/estimado.
  select a.d, 'ml', a.p,
    a.vendidas, a.vendidas, 0, 0, 0, 0, 0,
    1, 1, 1,
    a.revenue, a.revenue,
    0, a.flete - a.bonif,
    case when a.vendidas > 0 then a.flete_pend::numeric / a.vendidas else 0 end,
    a.costo,
    a.comision + a.retencion,
    a.percep,
    a.ads,
    a.revenue - a.comision - a.retencion - a.percep - (a.flete - a.bonif) - a.costo - a.ads,
    a.revenue - a.comision - a.retencion - a.percep - (a.flete - a.bonif) - a.costo - a.ads,
    now()
  from ml_alloc a;
end $fn$;

revoke execute on function recompute_daily_pnl(date, date) from anon, authenticated;

drop function if exists dashboard_days(date, text);
create or replace function dashboard_days(p_from date, p_courier text default null)
returns table (
  dispatch_date date, despachadas int, entregadas int, resueltas int, en_transito int,
  proyectadas numeric, revenue_confirmado numeric, revenue_estimado numeric,
  profit_confirmado numeric, profit_estimado numeric,
  flete numeric, comisiones numeric, ads numeric, ads_sin_cohorte numeric, percepciones numeric
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
         sum(s.percepciones)
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
           (entregadas + rehusadas + en_devolucion + devueltas + siniestros) as resueltas,
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
           (entregadas + rehusadas + en_devolucion + devueltas + siniestros) as resueltas,
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

drop function if exists sales_days(date, text);
create or replace function sales_days(p_from date, p_courier text default null)
returns table (
  sale_date date, generadas int, despachadas int, entregadas int, resueltas int, trabadas int,
  revenue_confirmado numeric, revenue_estimado numeric,
  profit_confirmado numeric, profit_estimado numeric,
  flete numeric, comisiones numeric, ads numeric, ads_sin_cohorte numeric, percepciones numeric
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
         sum(r.percepciones)
  from r
  where p_courier is null or r.c = p_courier
  group by r.d
  order by r.d desc
$$;

revoke execute on function sales_days(date, text) from anon;
grant execute on function sales_days(date, text) to authenticated, service_role;

drop function if exists sales_by_product(date, date, text);
create or replace function sales_by_product(p_from date, p_to date, p_courier text default null)
returns table (
  courier text, product_id int, product text,
  generadas int, despachadas int, entregadas int, resueltas int, trabadas int,
  revenue_confirmado numeric, revenue_estimado numeric,
  profit_confirmado numeric, profit_estimado numeric,
  flete numeric, comisiones numeric, ads numeric, percepciones numeric
) language sql stable as $$
  select r.c, r.p, coalesce(pr.name, '(sin producto)'),
         sum(r.generadas)::int, sum(r.despachadas)::int, sum(r.entregadas)::int, sum(r.resueltas)::int,
         sum(r.trabadas)::int,
         sum(r.revenue_conf), sum(r.revenue_est), sum(r.profit_conf), sum(r.profit_est),
         sum(r.flete), sum(r.comisiones), sum(r.ads), sum(r.percepciones)
  from sales_rows(p_from) r
  left join products pr on pr.id = r.p
  where r.d between p_from and p_to
    and (p_courier is null or r.c = p_courier)
  group by r.c, r.p, pr.name
  order by sum(r.profit_est)          -- lo más deficitario primero
$$;

revoke execute on function sales_by_product(date, date, text) from anon;
grant execute on function sales_by_product(date, date, text) to authenticated, service_role;

drop function if exists analisis_pnl(date, date, text);
create or replace function analisis_pnl(p_from date, p_to date, p_courier text default null)
returns table (
  courier text, product_id int, product text,
  despachadas int, entregadas int,
  revenue numeric, flete numeric, comisiones numeric, costo_producto numeric, ads numeric,
  profit_conf numeric, profit_est numeric, percepciones numeric
) language sql stable as $$
  select d.courier, d.product_id, coalesce(pr.name, '(sin producto)'),
         sum(d.despachadas)::int, sum(d.entregadas)::int,
         sum(d.revenue_confirmado), sum(d.flete), sum(d.comisiones),
         sum(d.costo_producto), sum(d.ads),
         sum(d.profit_confirmado), sum(d.profit_estimado), sum(d.percepciones)
  from daily_pnl d
  left join products pr on pr.id = d.product_id
  where d.dispatch_date between p_from and p_to
    and (p_courier is null or d.courier = p_courier)
  group by d.courier, d.product_id, pr.name
  order by sum(d.profit_estimado) desc
$$;

revoke execute on function analisis_pnl(date, date, text) from anon;
grant execute on function analisis_pnl(date, date, text) to authenticated, service_role;

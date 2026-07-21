-- 045: bonificaciones Flex de ML al P&L, neteadas del flete.
-- ML paga ~$650-1.025 por envío Flex como money_transfer (descripción bonificaciones_flex_fc).
-- El pago NO referencia al envío → se agrega POR DÍA (ART de date_approved) en ml_flex_bonif y el
-- recompute la reparte por revenue ML del día como MENOR flete (columna flete = flete − bonif;
-- profit consistente). Solo transfers APROBADOS (un refund posterior voltea el status y el re-sync
-- del día lo corrige solo). Magnitud: $73-263k/mes (jul 2026), ~0,5-1% del revenue ML.

create table if not exists ml_flex_bonif (
  date       date primary key,
  amount     numeric not null default 0,   -- bonificaciones Flex del día (netas de refunds)
  updated_at timestamptz not null default now()
);
alter table ml_flex_bonif enable row level security;
drop policy if exists ml_flex_bonif_read on ml_flex_bonif;
create policy ml_flex_bonif_read on ml_flex_bonif for select to authenticated using (true);

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
    costo_producto, comisiones, ads, profit_confirmado, profit_estimado, computed_at)
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
    select date, cost from ml_ad_spend where date between p_from and p_to
  ),
  mlbonif as (
    select date, amount from ml_flex_bonif where date between p_from and p_to
  ),
  ml_alloc as (
    -- Product Ads del día repartido entre los productos ML de ese día por su revenue.
    select m.d, m.p, m.vendidas, m.revenue, m.comision, m.retencion, m.flete, m.flete_pend, m.costo,
      coalesce((select mm.cost from mlads mm where mm.date = m.d) * m.revenue
               / nullif(sum(m.revenue) over (partition by m.d), 0), 0) as ads,
      coalesce((select b.amount from mlbonif b where b.date = m.d) * m.revenue
               / nullif(sum(m.revenue) over (partition by m.d), 0), 0) as bonif
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
    v_ccomm * c.revenue,
    coalesce(cal.ads, 0),
    c.revenue - v_ccomm * c.revenue - v_flete * c.pagados - c.costo - coalesce(cal.ads, 0),
    c.revenue - v_ccomm * c.revenue - v_flete * c.pagados - c.costo - coalesce(cal.ads, 0),
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
    a.ads,
    a.revenue - a.comision - a.retencion - (a.flete - a.bonif) - a.costo - a.ads,
    a.revenue - a.comision - a.retencion - (a.flete - a.bonif) - a.costo - a.ads,
    now()
  from ml_alloc a;
end $fn$;

revoke execute on function recompute_daily_pnl(date, date) from anon, authenticated;

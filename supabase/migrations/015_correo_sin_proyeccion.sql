-- 015 — Correo/cuotas: SIN proyección. Es prepago (cuotas_3 s/i; transferencia descartada):
-- lo cobrado ya se cobró y no se anula. No tiene tasa de ENTREGA proyectada — tiene tasa de
-- CONFIRMACIÓN (pagados/generados), ACTUAL. Por eso su estimado = confirmado (no se proyectan las
-- cuotas pendientes al prior). Cambia SOLO la rama correo de recompute_daily_pnl (COD intacto).
-- Base = 012. Las columnas est_cod/est_cost/est_conf del cagg quedan sin usar (dejadas por diff mínimo).

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
           s.status_canonical as st,
           coalesce(s.freight_cost, 0) as fc, s.freight_is_estimated as fe,
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
      count(*)::int as despachadas,
      count(*) filter (where st = 'entregado')::int as entregadas,
      count(*) filter (where st = 'rehusado')::int as rehusadas,
      count(*) filter (where st = 'en_devolucion')::int as en_devolucion,
      count(*) filter (where st = 'devuelto')::int as devueltas,
      count(*) filter (where st = 'siniestro')::int as siniestros,
      count(*) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro'))::int as en_transito,
      sum(fc) as flete,
      case when sum(fc) > 0
           then coalesce(sum(fc) filter (where fe), 0) / sum(fc) else 0 end as flete_est_pct,
      sum(dep) * (1 - v_mp) as senas_netas,
      coalesce(sum(cod) filter (where st = 'entregado'), 0) as cod_entregado,
      coalesce(sum(ucost) filter (where st in ('entregado','siniestro')), 0) as costo,
      coalesce(sum(prior * cod) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro')), 0) as est_cod,
      coalesce(sum(prior * ucost) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro')), 0) as est_cost,
      coalesce(sum(prior) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro')), 0) as est_deliv
    from ship
    group by 1, 2, 3
  ),
  cuotas as (
    select o.created_at::date as d, order_primary_product(o.id) as p,
           o.financial_status as fin,
           o.deposit_amount as dep, o.cod_amount as cod,
           (o.created_at::date <= current_date - ((v_mat->>'correo')::int)) as matured,
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
      and o.created_at::date between p_from and p_to
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
  ads_weights as (
    select a.d, a.c, a.p, (a.despachadas * case when a.c = 'fixy' then v_fw else 1 end)::numeric as w from agg a
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
  )
  -- filas COD (sin cambios)
  select a.d, a.c, a.p,
    a.despachadas, a.entregadas, a.rehusadas, a.en_devolucion, a.devueltas, a.siniestros, a.en_transito,
    (a.entregadas + a.rehusadas + a.en_devolucion + a.devueltas + a.siniestros)::numeric / a.despachadas,
    a.entregadas::numeric / a.despachadas,
    (a.entregadas + a.est_deliv)::numeric / a.despachadas,
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
  -- filas CORREO/cuotas: SIN proyección (015). despachadas=generados · entregadas=pagados (confirmados).
  -- estimado = confirmado (prepago firme) · tasa_proyectada = tasa_actual (confirmación ACTUAL).
  select c.d, 'correo', c.p,
    c.generados, c.pagados, 0, 0, 0, 0, c.en_transito,
    (c.pagados + c.perdidos)::numeric / c.generados,          -- pct_resuelto
    c.pagados::numeric / c.generados,                          -- tasa_actual = confirmación
    c.pagados::numeric / c.generados,                          -- tasa_proyectada := actual (SIN proyectar)
    c.revenue,                                                 -- revenue_confirmado (prepago)
    c.revenue,                                                 -- revenue_estimado := confirmado
    0, v_flete * c.pagados, 0,
    c.costo,
    v_ccomm * c.revenue,                                       -- comisiones = 18% MP
    coalesce(cal.ads, 0),
    c.revenue - v_ccomm * c.revenue - v_flete * c.pagados - c.costo - coalesce(cal.ads, 0),   -- profit_confirmado
    c.revenue - v_ccomm * c.revenue - v_flete * c.pagados - c.costo - coalesce(cal.ads, 0),   -- profit_estimado := confirmado
    now()
  from cagg c
  left join ads_alloc cal on cal.d = c.d and cal.c = 'correo' and cal.p = c.p;
end $fn$;

revoke execute on function recompute_daily_pnl(date, date) from anon, authenticated;

-- 011 — Reparto de pauta por PERÍODO, no por día (fix del artefacto que hacía a Fixy proyectar pérdida).
-- Problema (audit): ads_alloc repartía el spend de cada (día,producto) entre los despachos de ESE día.
-- En días de bajo volumen, toda la pauta del producto-día se apilaba sobre 1-2 guías → Fixy (bajo
-- volumen) era el más castigado (35% de su ads caía en filas de ≤2 despachos, arrastrándolo a pérdida).
-- Fix: repartir el spend TOTAL del producto en [p_from,p_to] entre TODOS sus despachos ponderados.
-- El total de pauta del período es idéntico; cambia sólo cómo se distribuye entre cohortes/couriers.
-- Simulado sobre prod (30d): Fixy profitEst −$67k → +$2,56M · Urbano $16,3M → $8,8M · total "Todos" ≈ igual.
-- CREATE OR REPLACE de recompute_daily_pnl (solo cambia el CTE ads_alloc) + v_ads_sin_cohorte.

create or replace function recompute_daily_pnl(p_from date, p_to date) returns void
language plpgsql as $fn$
declare
  v_comm jsonb   := (select value from settings where key = 'commission_pct');
  v_mp   numeric := (select (value::text)::numeric from settings where key = 'mp_fee_pct');
  v_fw   numeric := (select (value::text)::numeric from settings where key = 'fixy_cpa_multiplier');
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
  -- Pauta §4.6 (011): spend TOTAL del producto en el período repartido entre TODOS sus despachos
  -- ponderados (partition by producto), no por día → sin concentración en días de bajo volumen.
  ads_alloc as (
    select a.d, a.c, a.p,
           sp.spend_total * (a.despachadas * case when a.c = 'fixy' then v_fw else 1 end)
             / sum(a.despachadas * case when a.c = 'fixy' then v_fw else 1 end)
               over (partition by a.p) as ads
    from (select product_id, sum(spend) as spend_total
            from ad_spend
           where date between p_from and p_to and product_id is not null
           group by 1) sp
    join agg a on a.p = sp.product_id
  )
  select a.d, a.c, a.p,
    a.despachadas, a.entregadas, a.rehusadas, a.en_devolucion, a.devueltas, a.siniestros, a.en_transito,
    (a.entregadas + a.rehusadas + a.en_devolucion + a.devueltas + a.siniestros)::numeric
      / a.despachadas as pct_resuelto,
    a.entregadas::numeric / a.despachadas as tasa_actual,
    (a.entregadas + a.est_deliv)::numeric / a.despachadas as tasa_proyectada,
    a.cod_entregado + a.senas_netas as revenue_confirmado,
    a.cod_entregado + a.senas_netas + a.est_cod as revenue_estimado,
    a.senas_netas, a.flete, a.flete_est_pct,
    a.costo,
    (v_comm->>a.c)::numeric * a.cod_entregado as comisiones,
    coalesce(al.ads, 0) as ads,
    a.cod_entregado + a.senas_netas - a.flete
      - (v_comm->>a.c)::numeric * a.cod_entregado - a.costo - coalesce(al.ads, 0)
      as profit_confirmado,
    a.cod_entregado + a.senas_netas - a.flete
      - (v_comm->>a.c)::numeric * a.cod_entregado - a.costo - coalesce(al.ads, 0)
      + a.est_cod * (1 - (v_comm->>a.c)::numeric) - a.est_cost
      as profit_estimado,
    now()
  from agg a
  left join ads_alloc al on al.d = a.d and al.c = a.c and al.p = a.p;
end $fn$;

revoke execute on function recompute_daily_pnl(date, date) from anon, authenticated;

-- v_ads_sin_cohorte: con el reparto por período, TODO el spend de un producto con despachos se atribuye.
-- Queda "sin cohorte" solo la pauta SIN producto asignado (keyword no matcheó) o de un producto sin
-- ningún despacho en la base → no atribuible. Evita el doble-conteo con el reparto nuevo.
create or replace view v_ads_sin_cohorte as
select a.date, a.product_id, p.name as product, sum(a.spend) as spend
from ad_spend a
left join products p on p.id = a.product_id
where a.product_id is null
   or not exists (select 1 from daily_pnl d where d.product_id = a.product_id)
group by a.date, a.product_id, p.name;

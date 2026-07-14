-- 009 — P&L estimado (Fase 2 / R16) + fixes de auditoría en el core de plata.
-- NO edita 001/002: CREATE OR REPLACE de recompute_daily_pnl y dashboard_days; agrega v_costos_faltantes.
--
-- Cambios (todos sobre recompute_daily_pnl salvo donde se aclara):
--   #4/#16 P&L estimado §4.7: cablea Δ_estimado con los priors P(entrega) (delivery_priors, que ya
--          poblaba recompute_priors pero nadie consumía). profit/revenue_estimado y tasa_proyectada
--          dejan de ser copias del confirmado. Propiedad §4.7 #1: cohorte 100% resuelta ⇒ 0 en tránsito
--          ⇒ estimado == confirmado (lo valida pnl_check).
--   #5    seña duplicada: el deposit es del PEDIDO; contarlo una vez por order_id (1a guía despachada).
--          Antes un pedido Fixy con 2+ guías duplicaba senas_netas y revenue.
--   #11   dashboard_days: expone estimado + ads_sin_cohorte (pauta del día no atribuida) para que las
--          cards 7d/30d puedan restar ese costo real y mostrar el proyectado.
--   #12   v_costos_faltantes: producto·pack con entregas/siniestros pero sin fila en product_costs
--          (costo que hoy entra como 0 en silencio).

-- ============ recompute_daily_pnl (reemplaza 002) ============
create or replace function recompute_daily_pnl(p_from date, p_to date) returns void
language plpgsql as $fn$
declare
  v_comm jsonb   := (select value from settings where key = 'commission_pct');
  v_mp   numeric := (select (value::text)::numeric from settings where key = 'mp_fee_pct');
  v_fw   numeric := (select (value::text)::numeric from settings where key = 'fixy_cpa_multiplier');
begin
  -- Pack sin fila en product_costs → extrapolar del pack 1 × unidades, is_estimated (§4.4)
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

  -- Refrescar flete estimado urbano sin facturar (§4.1)
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
    -- Cohorte: guías con pedido y producto conocidos; el resto va a v_sin_clasificar (§2).
    -- ponytail: cancelado queda fuera de despachadas (se anuló antes de viajar).
    select s.dispatched_at as d, s.courier as c, order_primary_product(o.id) as p,
           s.status_canonical as st,
           coalesce(s.freight_cost, 0) as fc, s.freight_is_estimated as fe,
           o.cod_amount as cod,
           -- #5: la seña es del PEDIDO, no de la guía → contarla una sola vez, en la 1a guía despachada
           -- del order_id. Antes un pedido con 2+ guías (re-despacho Fixy) la duplicaba en senas/revenue.
           case when row_number() over (partition by o.id order by s.dispatched_at, s.id) = 1
                then o.deposit_amount else 0 end as dep,
           coalesce((select sum(oi.qty * coalesce(pc.unit_cost, 0))
                       from order_items oi
                       left join product_costs pc
                              on pc.product_id = oi.product_id and pc.pack = oi.pack
                      where oi.order_id = o.id), 0) as ucost,
           -- P(entrega) §4.5 para estimar las en tránsito: (c,prov,prod) → (c,prov) → (c) → 0.
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
      sum(dep) * (1 - v_mp) as senas_netas,                          -- §4.3
      coalesce(sum(cod) filter (where st = 'entregado'), 0) as cod_entregado,
      coalesce(sum(ucost) filter (where st in ('entregado','siniestro')), 0) as costo,  -- §4.4
      -- Estimado §4.7: sumar sobre las EN TRÁNSITO (no resueltas) ponderando por su prior P_i.
      coalesce(sum(prior * cod) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro')), 0) as est_cod,
      coalesce(sum(prior * ucost) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro')), 0) as est_cost,
      coalesce(sum(prior) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro')), 0) as est_deliv
    from ship
    group by 1, 2, 3
  ),
  -- Pauta §4.6: spend(producto, día) repartido por despachos ponderados entre couriers
  ads_alloc as (
    select sp.date as d, sp.product_id as p, a.c,
           sp.spend_total * (a.despachadas * case when a.c = 'fixy' then v_fw else 1 end)
             / sum(a.despachadas * case when a.c = 'fixy' then v_fw else 1 end)
               over (partition by sp.date, sp.product_id) as ads
    from (select date, product_id, sum(spend) as spend_total
            from ad_spend
           where date between p_from and p_to and product_id is not null
           group by 1, 2) sp
    join agg a on a.d = sp.date and a.p = sp.product_id
  )
  select a.d, a.c, a.p,
    a.despachadas, a.entregadas, a.rehusadas, a.en_devolucion, a.devueltas, a.siniestros, a.en_transito,
    (a.entregadas + a.rehusadas + a.en_devolucion + a.devueltas + a.siniestros)::numeric
      / a.despachadas as pct_resuelto,
    a.entregadas::numeric / a.despachadas as tasa_actual,
    (a.entregadas + a.est_deliv)::numeric / a.despachadas as tasa_proyectada,       -- §4.7
    a.cod_entregado + a.senas_netas as revenue_confirmado,                          -- §4.7
    a.cod_entregado + a.senas_netas + a.est_cod as revenue_estimado,                -- §4.7
    a.senas_netas, a.flete, a.flete_est_pct,
    a.costo,
    (v_comm->>a.c)::numeric * a.cod_entregado as comisiones,                        -- §4.2
    coalesce(al.ads, 0) as ads,
    a.cod_entregado + a.senas_netas - a.flete
      - (v_comm->>a.c)::numeric * a.cod_entregado - a.costo - coalesce(al.ads, 0)
      as profit_confirmado,
    -- profit_estimado = profit_confirmado + Δ_estimado; Δ = Σ P_i(cod_i(1−rate) − ucost_i)
    --                 = est_cod×(1−rate) − est_cost  (§4.7)
    a.cod_entregado + a.senas_netas - a.flete
      - (v_comm->>a.c)::numeric * a.cod_entregado - a.costo - coalesce(al.ads, 0)
      + a.est_cod * (1 - (v_comm->>a.c)::numeric) - a.est_cost
      as profit_estimado,
    now()
  from agg a
  left join ads_alloc al on al.d = a.d and al.c = a.c and al.p = a.p;
end $fn$;

revoke execute on function recompute_daily_pnl(date, date) from anon, authenticated;

-- ============ dashboard_days (reemplaza 007): + estimado + ads_sin_cohorte ============
-- Cambia el tipo de retorno (agrega columnas) → hay que dropear la de 007 primero.
drop function if exists dashboard_days(date, text);
create or replace function dashboard_days(p_from date, p_courier text default null)
returns table (
  dispatch_date date, despachadas int, entregadas int, resueltas int, en_transito int,
  proyectadas numeric, revenue_confirmado numeric, revenue_estimado numeric,
  profit_confirmado numeric, profit_estimado numeric, ads numeric, ads_sin_cohorte numeric
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
         sum(s.ads),
         -- #11: pauta del día NO atribuida a ninguna cohorte — costo real que las cards 7d/30d deben
         -- restar. Solo en la vista "Todos" (p_courier null); es un costo whole-business, no de un courier.
         case when p_courier is null
              then coalesce((select sum(v.spend) from v_ads_sin_cohorte v where v.date = s.dispatch_date), 0)
              else 0 end
  from daily_pnl s
  where s.dispatch_date >= p_from
    and (p_courier is null or s.courier = p_courier)
  group by s.dispatch_date
  order by s.dispatch_date desc
$$;

grant execute on function dashboard_days(date, text) to authenticated, service_role;

-- ============ v_costos_faltantes (#12): costo $0 silencioso ============
-- producto·pack con entregas/siniestros (donde el costo SÍ cuenta, §4.4) pero sin fila en product_costs
-- → coalesce(unit_cost,0) lo mete como 0 sin avisar. Visible acá para cargar el costo real en /config.
create or replace view v_costos_faltantes as
select distinct oi.product_id, p.name as product, oi.pack
from order_items oi
join products p on p.id = oi.product_id
join shipments s on s.order_id = oi.order_id and s.status_canonical in ('entregado','siniestro')
where oi.product_id is not null
  and not exists (select 1 from product_costs pc
                   where pc.product_id = oi.product_id and pc.pack = oi.pack);

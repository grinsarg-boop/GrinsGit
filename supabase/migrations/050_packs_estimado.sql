-- 050 — analisis_packs: margen neto ESTIMADO por pack (y conteo en_calle), al lado del cerrado.
-- El cerrado solo (049) castiga rangos recientes: las guías en la calle ya pagaron flete pero todavía
-- no cobraron. Para decidir sobre la marcha hace falta el estimado con las MISMAS reglas del panel
-- (026 §4.7): por cada guía en tránsito, Δ = prior×COD×(1−comisión) − prior×costo, con el prior de
-- delivery_priors en fallback courier×provincia×producto → courier×provincia → courier (026:86-95).
-- El flete no aparece en el Δ porque ya está hundido completo en el neto. Mono-línea ⇒ el producto
-- primario ES oi.product_id (sin order_primary_product). Cambia el RETURNS → drop primero.
--
--   margen_neto_est = margen_neto + Σ en_calle [ prior×cod×(1−rate) − prior×ucost ]
--   propiedad §4.7: pack sin guías en la calle ⇒ margen_neto_est = margen_neto (packs_pmin_check).

drop function if exists analisis_packs(date, date, text, int, int);

create or replace function analisis_packs(p_from date, p_to date, p_courier text default null, p_producto int default null, p_min int default 40)
returns table (
  pack int, guias int, entregadas int, devueltas int, en_calle int,
  cod_cobrado numeric, flete numeric,
  comisiones numeric, costo_producto numeric, margen_bruto numeric, margen_neto numeric,
  margen_neto_est numeric
) language sql stable as $$
  with g as (
    select oi.pack,
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
           coalesce(o.cod_amount, 0) as cod,
           coalesce(((select value from settings where key = 'commission_pct')->>s.courier)::numeric, 0) as rate,
           oi.qty * coalesce(pc.unit_cost, 0) as ucost,
           coalesce(
             (select dp.p_delivery from delivery_priors dp
                where dp.courier = s.courier and dp.province = coalesce(s.province, o.province)
                  and dp.product_id = oi.product_id),
             (select dp.p_delivery from delivery_priors dp
                where dp.courier = s.courier and dp.province = coalesce(s.province, o.province)
                  and dp.product_id is null),
             (select dp.p_delivery from delivery_priors dp
                where dp.courier = s.courier and dp.province is null and dp.product_id is null),
             0) as prior
    from shipments s
    join orders o on o.id = s.order_id
    join order_items oi on oi.order_id = o.id
    left join product_costs pc on pc.product_id = oi.product_id and pc.pack = oi.pack
    where s.dispatched_at between p_from and p_to
      and s.status_canonical <> 'cancelado'
      and (p_courier is null or s.courier = p_courier)
      and (select count(*) from order_items x where x.order_id = o.id) = 1
      and (p_producto is null or oi.product_id = p_producto)
  )
  select pack,
         count(*) filter (where st <> 'no_despachado')::int,
         count(*) filter (where st = 'entregado')::int,
         count(*) filter (where st in ('devuelto','rehusado','en_devolucion'))::int,
         count(*) filter (where st not in
           ('entregado','rehusado','en_devolucion','devuelto','siniestro','no_despachado'))::int,
         coalesce(sum(cod) filter (where st = 'entregado'), 0),
         coalesce(sum(fc), 0),
         coalesce(sum(rate * cod) filter (where st = 'entregado'), 0),
         coalesce(sum(ucost) filter (where st in ('entregado','siniestro')), 0),
         coalesce(sum(cod) filter (where st = 'entregado'), 0) - coalesce(sum(fc), 0),
         coalesce(sum(cod) filter (where st = 'entregado'), 0) - coalesce(sum(fc), 0)
           - coalesce(sum(rate * cod) filter (where st = 'entregado'), 0)
           - coalesce(sum(ucost) filter (where st in ('entregado','siniestro')), 0),
         coalesce(sum(cod) filter (where st = 'entregado'), 0) - coalesce(sum(fc), 0)
           - coalesce(sum(rate * cod) filter (where st = 'entregado'), 0)
           - coalesce(sum(ucost) filter (where st in ('entregado','siniestro')), 0)
           + coalesce(sum(prior * cod * (1 - rate) - prior * ucost) filter (where st not in
               ('entregado','rehusado','en_devolucion','devuelto','siniestro','no_despachado')), 0)
  from g
  group by pack
  having count(*) filter (where st <> 'no_despachado') >= p_min
  order by pack
$$;

revoke execute on function analisis_packs(date, date, text, int, int) from anon;
grant execute on function analisis_packs(date, date, text, int, int) to authenticated, service_role;

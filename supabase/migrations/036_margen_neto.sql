-- 036 — Margen NETO (sin Ads) en zonas y packs. La 034/035 se quedaba en margen bruto (COD − flete)
-- con el argumento de que costo y ads no se imputan por zona — era conservador de más: el costo de
-- producto ES por pedido (order_items × product_costs) y la comisión es por guía entregada. Lo único
-- que de verdad no se reparte por zona/pack son los Ads (van por producto × día). Entonces:
--
--   margen_neto = cod_cobrado − flete − comisiones − costo_producto      ("neto sin Ads")
--
-- Comisión solo sobre entregadas (§4.2), costo solo en entregado+siniestro (§4.4) — las mismas reglas
-- del P&L. Cambian los RETURNS TABLE → drop primero (sin drop quedaría una sobrecarga).

drop function if exists analisis_zonas(date, date, text, int);

create or replace function analisis_zonas(p_from date, p_to date, p_courier text default null, p_producto int default null)
returns table (
  province text, guias int, entregadas int, devueltas int,
  cod_cobrado numeric, flete numeric, flete_perdido numeric,
  comisiones numeric, costo_producto numeric, margen_bruto numeric, margen_neto numeric
) language sql stable as $$
  with g as (
    select coalesce(nullif(trim(s.province), ''), '(sin provincia)') as province,
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
           coalesce((select sum(oi.qty * coalesce(pc.unit_cost, 0))
                       from order_items oi
                       left join product_costs pc
                              on pc.product_id = oi.product_id and pc.pack = oi.pack
                      where oi.order_id = o.id), 0) as ucost
    from shipments s
    join orders o on o.id = s.order_id
    where s.dispatched_at between p_from and p_to
      and s.status_canonical <> 'cancelado'
      and (p_courier is null or s.courier = p_courier)
      and (p_producto is null or order_primary_product(o.id) = p_producto)
  )
  select province,
         count(*) filter (where st <> 'no_despachado')::int,
         count(*) filter (where st = 'entregado')::int,
         count(*) filter (where st in ('devuelto','rehusado','en_devolucion'))::int,
         coalesce(sum(cod) filter (where st = 'entregado'), 0),
         coalesce(sum(fc), 0),
         coalesce(sum(fc) filter (where st in ('devuelto','rehusado','en_devolucion')), 0),
         coalesce(sum(rate * cod) filter (where st = 'entregado'), 0),
         coalesce(sum(ucost) filter (where st in ('entregado','siniestro')), 0),
         coalesce(sum(cod) filter (where st = 'entregado'), 0) - coalesce(sum(fc), 0),
         coalesce(sum(cod) filter (where st = 'entregado'), 0) - coalesce(sum(fc), 0)
           - coalesce(sum(rate * cod) filter (where st = 'entregado'), 0)
           - coalesce(sum(ucost) filter (where st in ('entregado','siniestro')), 0)
  from g
  group by province
  having count(*) filter (where st <> 'no_despachado') > 0
  order by 11 asc                    -- lo que más pierde en NETO, primero
$$;

revoke execute on function analisis_zonas(date, date, text, int) from anon;
grant execute on function analisis_zonas(date, date, text, int) to authenticated, service_role;

drop function if exists analisis_packs(date, date, text, int);

create or replace function analisis_packs(p_from date, p_to date, p_courier text default null, p_producto int default null)
returns table (
  pack int, guias int, entregadas int, devueltas int,
  cod_cobrado numeric, flete numeric,
  comisiones numeric, costo_producto numeric, margen_bruto numeric, margen_neto numeric
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
           oi.qty * coalesce(pc.unit_cost, 0) as ucost
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
         coalesce(sum(cod) filter (where st = 'entregado'), 0),
         coalesce(sum(fc), 0),
         coalesce(sum(rate * cod) filter (where st = 'entregado'), 0),
         coalesce(sum(ucost) filter (where st in ('entregado','siniestro')), 0),
         coalesce(sum(cod) filter (where st = 'entregado'), 0) - coalesce(sum(fc), 0),
         coalesce(sum(cod) filter (where st = 'entregado'), 0) - coalesce(sum(fc), 0)
           - coalesce(sum(rate * cod) filter (where st = 'entregado'), 0)
           - coalesce(sum(ucost) filter (where st in ('entregado','siniestro')), 0)
  from g
  group by pack
  having count(*) filter (where st <> 'no_despachado') >= 40
  order by pack
$$;

revoke execute on function analisis_packs(date, date, text, int) from anon;
grant execute on function analisis_packs(date, date, text, int) to authenticated, service_role;

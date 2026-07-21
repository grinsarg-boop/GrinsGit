-- 049 — analisis_packs: umbral de guías parametrizable (p_min, default 40).
-- El HAVING >= 40 fijo (035/036) es anti-ruido para la vista global de /analisis, pero la subpágina
-- por producto (/analisis/[id]) con un rango angosto se quedaba sin filas: ahí se pide p_min := 1 y
-- los buckets chicos se MARCAN en la UI en vez de esconderse. La llamada vieja de 4 args sigue
-- devolviendo exactamente lo mismo (default 40). p_min solo filtra buckets: jamás cambia números
-- (lo ancla packs_pmin_check). Cambia la firma → drop primero (patrón 036: sin drop quedaría una
-- sobrecarga y PostgREST no sabría a cuál llamar).

drop function if exists analisis_packs(date, date, text, int);

create or replace function analisis_packs(p_from date, p_to date, p_courier text default null, p_producto int default null, p_min int default 40)
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
  having count(*) filter (where st <> 'no_despachado') >= p_min
  order by pack
$$;

revoke execute on function analisis_packs(date, date, text, int, int) from anon;
grant execute on function analisis_packs(date, date, text, int, int) to authenticated, service_role;

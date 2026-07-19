-- 034 — RPCs de la página /analisis. Read-only, no tocan datos ni fórmulas: reagrupan lo que ya
-- calcula el P&L por ejes que hoy no existen (zona, desenlace, producto×courier).
--
-- Tres funciones porque son tres granos distintos:
--   analisis_pnl        → (courier, producto) con TODAS las columnas de costo. De acá salen, sumando
--                         en el cliente, la composición del peso, el profit por canal y por producto.
--                         Son ~30 filas, así que agregar en TS es honesto y evita 3 RPCs casi iguales.
--   analisis_zonas      → por provincia. daily_pnl NO tiene provincia: hay que ir a shipments.
--   analisis_desenlaces → distribución de estados finales de las guías.
--
-- Las tres replican la regla `no_despachado` de la 018 (PI/pendiente-de-retiro de +7 días no cuentan
-- como despacho ni pagan flete), para que los números no discutan con los otros paneles.

-- ============ P&L por canal × producto, con el desglose completo de costos ============
create or replace function analisis_pnl(p_from date, p_to date, p_courier text default null)
returns table (
  courier text, product_id int, product text,
  despachadas int, entregadas int,
  revenue numeric, flete numeric, comisiones numeric, costo_producto numeric, ads numeric, profit numeric
) language sql stable as $$
  select d.courier, d.product_id, coalesce(pr.name, '(sin producto)'),
         sum(d.despachadas)::int, sum(d.entregadas)::int,
         sum(d.revenue_confirmado), sum(d.flete), sum(d.comisiones),
         sum(d.costo_producto), sum(d.ads), sum(d.profit_confirmado)
  from daily_pnl d
  left join products pr on pr.id = d.product_id
  where d.dispatch_date between p_from and p_to
    and (p_courier is null or d.courier = p_courier)
  group by d.courier, d.product_id, pr.name
  order by sum(d.profit_confirmado) desc
$$;

revoke execute on function analisis_pnl(date, date, text) from anon;
grant execute on function analisis_pnl(date, date, text) to authenticated, service_role;

-- ============ Zonas: la única vista con provincia ============
-- Margen bruto = COD cobrado − flete de TODAS las guías (el flete es hundido). No baja a profit porque
-- ni el costo de producto ni los ads se pueden imputar por provincia sin inventar un reparto.
create or replace function analisis_zonas(p_from date, p_to date, p_courier text default null)
returns table (
  province text, guias int, entregadas int, devueltas int,
  cod_cobrado numeric, flete numeric, margen_bruto numeric
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
           coalesce(o.cod_amount, 0) as cod
    from shipments s
    join orders o on o.id = s.order_id
    where s.dispatched_at between p_from and p_to
      and s.status_canonical <> 'cancelado'
      and (p_courier is null or s.courier = p_courier)
  )
  select province,
         count(*) filter (where st <> 'no_despachado')::int,
         count(*) filter (where st = 'entregado')::int,
         count(*) filter (where st in ('devuelto','rehusado','en_devolucion'))::int,
         coalesce(sum(cod) filter (where st = 'entregado'), 0),
         coalesce(sum(fc), 0),
         coalesce(sum(cod) filter (where st = 'entregado'), 0) - coalesce(sum(fc), 0)
  from g
  group by province
  having count(*) filter (where st <> 'no_despachado') > 0
  order by 7 asc                      -- lo que más pierde, primero
$$;

revoke execute on function analisis_zonas(date, date, text) from anon;
grant execute on function analisis_zonas(date, date, text) to authenticated, service_role;

-- ============ Desenlaces: en qué termina cada guía ============
create or replace function analisis_desenlaces(p_from date, p_to date, p_courier text default null)
returns table (estado text, guias int, cod numeric) language sql stable as $$
  with g as (
    select case when ((s.courier = 'urbano' and s.status_raw = 'PI')
                   or (s.courier = 'fixy' and (s.status_raw = '41'
                        or lower(coalesce(s.status_raw, '')) like '%pendiente de retiro%')))
                     and current_date - s.dispatched_at > 7
                  then 'no_despachado'
                when s.status_canonical in ('despachado','en_transito','en_reparto','incidencia','en_sucursal')
                  then 'en_la_calle'
                else s.status_canonical end as estado,
           coalesce(o.cod_amount, 0) as cod
    from shipments s
    join orders o on o.id = s.order_id
    where s.dispatched_at between p_from and p_to
      and s.status_canonical <> 'cancelado'
      and (p_courier is null or s.courier = p_courier)
  )
  select estado, count(*)::int, coalesce(sum(cod), 0)
  from g group by estado order by count(*) desc
$$;

revoke execute on function analisis_desenlaces(date, date, text) from anon;
grant execute on function analisis_desenlaces(date, date, text) to authenticated, service_role;

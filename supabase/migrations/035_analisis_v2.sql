-- 035 — Segunda tanda de /analisis: packs, maduración de cohortes, el flete quemado en devoluciones
-- (para el Pareto de zonas), analisis_pnl con los dos profits, y filtro por PRODUCTO en todas las RPCs
-- de guías (p_producto, via order_primary_product — el criterio de siempre). Más el seed de CPA.
--
-- Los drops previos a cada create cubren tanto venir de la 034 como de una corrida anterior de este
-- mismo archivo: sin ellos, cambiar la firma crearía una sobrecarga y PostgREST no sabría cuál llamar.
--
-- La comparativa de períodos NO necesita SQL: se resuelve llamando dos veces a las RPCs de la 034 con
-- rangos distintos y restando en el cliente.

-- ============ Entrega y plata por TAMAÑO DE PACK ============
-- Hallazgo que lo motivó (jun–jul 2026): la tasa sube con el pack — x1 35,2% · x2 42,9% · x3 52,3%.
-- Solo pedidos de UNA línea: con carrito mixto el pack del pedido no está definido y atribuirlo a
-- cualquiera de las líneas sería inventar.
drop function if exists analisis_packs(date, date, text);

create or replace function analisis_packs(p_from date, p_to date, p_courier text default null, p_producto int default null)
returns table (
  pack int, guias int, entregadas int, devueltas int,
  cod_cobrado numeric, flete numeric, margen_bruto numeric
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
           coalesce(o.cod_amount, 0) as cod
    from shipments s
    join orders o on o.id = s.order_id
    join order_items oi on oi.order_id = o.id
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
         coalesce(sum(cod) filter (where st = 'entregado'), 0) - coalesce(sum(fc), 0)
  from g
  group by pack
  having count(*) filter (where st <> 'no_despachado') >= 40   -- menos que eso es ruido
  order by pack
$$;

revoke execute on function analisis_packs(date, date, text, int) from anon;
grant execute on function analisis_packs(date, date, text, int) to authenticated, service_role;

-- ============ Curva de maduración ============
-- Para cada EDAD de cohorte (días desde el despacho), qué fracción ya tiene desenlace. Dice cuándo un
-- número es confiable, y si la curva se aplana de golpe es señal de que el sync se congeló (pasó con
-- el n8n cortado del 14/07). Se corta a 21 días: más allá la cohorte ya está madura por definición.
drop function if exists analisis_maduracion(date, text);

create or replace function analisis_maduracion(p_desde date, p_courier text default null, p_producto int default null)
returns table (dias int, guias int, resueltas int, entregadas int) language sql stable as $$
  with g as (
    select least((current_date - s.dispatched_at), 21) as dias,
           case when ((s.courier = 'urbano' and s.status_raw = 'PI')
                   or (s.courier = 'fixy' and (s.status_raw = '41'
                        or lower(coalesce(s.status_raw, '')) like '%pendiente de retiro%')))
                     and current_date - s.dispatched_at > 7
                  then 'no_despachado' else s.status_canonical end as st
    from shipments s
    join orders o on o.id = s.order_id
    where s.dispatched_at >= p_desde
      and s.dispatched_at <= current_date
      and s.status_canonical <> 'cancelado'
      and (p_courier is null or s.courier = p_courier)
      and (p_producto is null or order_primary_product(o.id) = p_producto)
  )
  select dias,
         count(*) filter (where st <> 'no_despachado')::int,
         count(*) filter (where st in
           ('entregado','rehusado','en_devolucion','devuelto','siniestro'))::int,
         count(*) filter (where st = 'entregado')::int
  from g
  where dias >= 0
  group by dias
  having count(*) filter (where st <> 'no_despachado') >= 20
  order by dias
$$;

revoke execute on function analisis_maduracion(date, text, int) from anon;
grant execute on function analisis_maduracion(date, text, int) to authenticated, service_role;

-- ============ Zonas v2: se agrega el flete quemado en devoluciones (Pareto) ============
-- Cambia el RETURNS TABLE, así que hay que dropear primero.
drop function if exists analisis_zonas(date, date, text);

create or replace function analisis_zonas(p_from date, p_to date, p_courier text default null, p_producto int default null)
returns table (
  province text, guias int, entregadas int, devueltas int,
  cod_cobrado numeric, flete numeric, flete_perdido numeric, margen_bruto numeric
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
      and (p_producto is null or order_primary_product(o.id) = p_producto)
  )
  select province,
         count(*) filter (where st <> 'no_despachado')::int,
         count(*) filter (where st = 'entregado')::int,
         count(*) filter (where st in ('devuelto','rehusado','en_devolucion'))::int,
         coalesce(sum(cod) filter (where st = 'entregado'), 0),
         coalesce(sum(fc), 0),
         -- flete PERDIDO: el de las guías que volvieron. Es el agujero del negocio COD.
         coalesce(sum(fc) filter (where st in ('devuelto','rehusado','en_devolucion')), 0),
         coalesce(sum(cod) filter (where st = 'entregado'), 0) - coalesce(sum(fc), 0)
  from g
  group by province
  having count(*) filter (where st <> 'no_despachado') > 0
  order by 8 asc
$$;

revoke execute on function analisis_zonas(date, date, text, int) from anon;
grant execute on function analisis_zonas(date, date, text, int) to authenticated, service_role;

-- ============ CPA de referencia por producto ============
-- Valores del vault (20-Ads/Learnings.md, recalculados el 13/07 tras corregir cuotas a 18%).
-- Son REFERENCIA, no regla: manda producto × zona y la tasa de entrega. Editables desde /config.
insert into settings (key, value) values
  ('cpa_referencia', '{
     "Veinguard": {"objetivo": 9300, "maximo": 17200},
     "BeeVenom":  {"objetivo": 8600, "maximo": 16100},
     "Natures":   {"objetivo": 5200, "maximo": 12400},
     "Pureza":    {"objetivo": 4200, "maximo": 11400}
   }'::jsonb)
on conflict (key) do nothing;

-- ============ Desenlaces v2: aprende el filtro por producto ============
drop function if exists analisis_desenlaces(date, date, text);

create or replace function analisis_desenlaces(p_from date, p_to date, p_courier text default null, p_producto int default null)
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
      and (p_producto is null or order_primary_product(o.id) = p_producto)
  )
  select estado, count(*)::int, coalesce(sum(cod), 0)
  from g group by estado order by count(*) desc
$$;

revoke execute on function analisis_desenlaces(date, date, text, int) from anon;
grant execute on function analisis_desenlaces(date, date, text, int) to authenticated, service_role;

-- ============ analisis_pnl v2: confirmado Y estimado ============
-- En rangos recientes el confirmado solo es muy negativo (el flete y los ads ya se pagaron, el COD
-- todavía no maduró) y se lee como pérdida sin serlo. Se exponen los dos. Cambia el RETURNS TABLE.
drop function if exists analisis_pnl(date, date, text);

create or replace function analisis_pnl(p_from date, p_to date, p_courier text default null)
returns table (
  courier text, product_id int, product text,
  despachadas int, entregadas int,
  revenue numeric, flete numeric, comisiones numeric, costo_producto numeric, ads numeric,
  profit_conf numeric, profit_est numeric
) language sql stable as $$
  select d.courier, d.product_id, coalesce(pr.name, '(sin producto)'),
         sum(d.despachadas)::int, sum(d.entregadas)::int,
         sum(d.revenue_confirmado), sum(d.flete), sum(d.comisiones),
         sum(d.costo_producto), sum(d.ads),
         sum(d.profit_confirmado), sum(d.profit_estimado)
  from daily_pnl d
  left join products pr on pr.id = d.product_id
  where d.dispatch_date between p_from and p_to
    and (p_courier is null or d.courier = p_courier)
  group by d.courier, d.product_id, pr.name
  order by sum(d.profit_estimado) desc
$$;

revoke execute on function analisis_pnl(date, date, text) from anon;
grant execute on function analisis_pnl(date, date, text) to authenticated, service_role;

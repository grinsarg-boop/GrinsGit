-- ml_check.sql (022): canal 'ml' — ventas MercadoLibre ya pagadas y entregadas por ML.
-- revenue = total_amount · comisión = sale_fee REAL · flete = ship_cost (null→0, Flex pendiente) ·
-- COGS = units × product_costs(pack) (Revival extrapola su pack) · ads = 0 · sin proyección · cancelled fuera.
begin;

do $t$
declare d date := current_date - 1; pid_pureza int; pid_rev int; r daily_pnl%rowtype;
begin
  select id into pid_pureza from products where name = 'Pureza';
  select id into pid_rev    from products where name = 'Revival Oil';

  insert into ml_orders (ml_id, created_at, product, units, pack, total_amount, sale_fee, ship_cost, shipment_id, status, raw) values
    (9001, (d::text||'T12:00:00-03:00')::timestamptz, 'Pureza',      1, 3, 58911.36, 14079.81, 7470, 1, 'paid',      '{}'),  -- A normal
    (9002, (d::text||'T12:00:00-03:00')::timestamptz, 'Revival Oil', 1, 1, 40000,     9600,     5000, 2, 'paid',      '{}'),  -- B Revival pack1 real
    (9003, (d::text||'T12:00:00-03:00')::timestamptz, 'Revival Oil', 1, 2, 70000,    16800,     null, 3, 'paid',      '{}'),  -- C Flex sin flete
    (9004, (d::text||'T12:00:00-03:00')::timestamptz, 'Pureza',      1, 1, 30000,     7200,     4000, 4, 'cancelled', '{}');  -- D excluida

  perform recompute_daily_pnl(d, d);

  -- Pureza (1 orden, flete normal, COGS pack3 seed = 7000)
  select * into r from daily_pnl where courier='ml' and dispatch_date=d and product_id=pid_pureza;
  assert r.despachadas = 1,                 'ml Pureza vendidas=1';
  assert r.entregadas  = 1,                 'ml Pureza entregadas=vendidas';
  assert r.revenue_confirmado = 58911.36,   'ml Pureza revenue=total_amount';
  assert r.comisiones = 14079.81,           'ml Pureza comision=sale_fee';
  assert r.flete = 7470,                     'ml Pureza flete=ship_cost';
  assert r.costo_producto = 7000,            'ml Pureza COGS pack3=7000';
  assert r.ads = 0,                          'ml sin ads';
  assert round(r.profit_confirmado,2) = round(58911.36-14079.81-7470-7000,2), 'ml Pureza profit';
  assert r.profit_estimado = r.profit_confirmado, 'ml sin proyeccion (est=conf)';

  -- Revival (2 órdenes; pack2 extrapolado=4265*2=8530; 1 flete pendiente Flex)
  select * into r from daily_pnl where courier='ml' and dispatch_date=d and product_id=pid_rev;
  assert r.despachadas = 2,                 'ml Revival vendidas=2';
  assert r.revenue_confirmado = 110000,      'ml Revival revenue';
  assert r.comisiones = 26400,               'ml Revival comision';
  assert r.flete = 5000,                     'ml Revival flete (5000 + null->0)';
  assert r.costo_producto = 4265 + 8530,     'ml Revival COGS = pack1 real + pack2 extrapolado';
  assert round(r.flete_estimado_pct,4) = 0.5,'ml Revival 1/2 sin flete cargado';
  assert round(r.profit_confirmado,2) = round(110000-26400-5000-12795,2), 'ml Revival profit';

  assert (select count(*) from daily_pnl where courier='ml' and dispatch_date=d) = 2, 'ml: 2 productos, cancelada fuera';

  raise notice 'ml_check (022): OK';
end $t$;

rollback;

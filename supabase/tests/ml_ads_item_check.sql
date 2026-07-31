-- ml_ads_item_check.sql (062): Product Ads de ML imputados a la publicación que los gastó.
begin;

do $t$
declare
  d date := current_date - 3; d2 date := current_date - 4;
  pid_pureza int; pid_rev int; pid_vein int;
  r daily_pnl%rowtype; r2 daily_pnl%rowtype; r3 daily_pnl%rowtype;
begin
  update settings set value = '0' where key = 'ml_ads_iva';   -- el IVA (046) se prueba aparte
  select id into pid_pureza from products where name = 'Pureza';
  select id into pid_rev    from products where name = 'Revival Oil';
  select id into pid_vein   from products where name = 'Veinguard';

  -- día d: Pureza factura 60.000 y Revival 40.000, pero la pauta REAL es al revés (Revival gasta el doble).
  insert into ml_orders (ml_id, created_at, product, units, pack, total_amount, sale_fee, ship_cost, shipment_id, status, raw) values
    (95101, (d::text||'T12:00:00-03:00')::timestamptz, 'Pureza',      1, 1, 60000, 0, 0, 11, 'paid',
     '{"order_items":[{"item":{"id":"MLA95101"}}]}'),
    (95102, (d::text||'T12:00:00-03:00')::timestamptz, 'Revival Oil', 1, 1, 40000, 0, 0, 12, 'paid',
     '{"order_items":[{"item":{"id":"MLA95102"}}]}');
  insert into ml_ad_spend (date, cost) values (d, 10000);              -- total del día (el que factura ML)
  insert into ml_ad_spend_item (date, item_id, cost) values
    (d, 'MLA95101', 3000), (d, 'MLA95102', 6000);                      -- imputable: 9.000 → resto 1.000

  perform recompute_daily_pnl(d, d);

  select * into r  from daily_pnl where courier='ml' and dispatch_date=d and product_id=pid_pureza;
  select * into r2 from daily_pnl where courier='ml' and dispatch_date=d and product_id=pid_rev;

  -- el mapeo item→producto se sembró solo desde raw.order_items[].item.id (sin matchear títulos)
  assert (select product_id from ml_ad_items where item_id = 'MLA95102') = pid_rev, '062: seed item→producto';
  assert r.ads  = 3600, '062: Pureza = 3.000 propios + 60% del resto (600)';
  assert r2.ads = 6400, '062: Revival = 6.000 propios + 40% del resto (400) — no el 40% prorrateado';
  assert round(r.ads + r2.ads) = 10000, '062: la suma del día sigue siendo el total facturado';
  assert r2.profit_confirmado = r2.revenue_confirmado - r2.comisiones - r2.flete - r2.costo_producto - r2.ads,
         '062: profit resta el ads real';

  -- día d2: Veinguard gasta pauta y NO vende. Su costo tiene que aparecer igual, no repartirse en Pureza.
  insert into ml_orders (ml_id, created_at, product, units, pack, total_amount, sale_fee, ship_cost, shipment_id, status, raw) values
    (95103, (d2::text||'T12:00:00-03:00')::timestamptz, 'Pureza', 1, 1, 50000, 0, 0, 13, 'paid',
     '{"order_items":[{"item":{"id":"MLA95101"}}]}');
  insert into ml_ad_items (item_id, product_id) values ('MLA95104', pid_vein);  -- item sin ventas: carga a mano
  insert into ml_ad_spend (date, cost) values (d2, 5000);
  insert into ml_ad_spend_item (date, item_id, cost) values (d2, 'MLA95101', 1000), (d2, 'MLA95104', 4000);

  perform recompute_daily_pnl(d2, d2);

  select * into r  from daily_pnl where courier='ml' and dispatch_date=d2 and product_id=pid_pureza;
  select * into r3 from daily_pnl where courier='ml' and dispatch_date=d2 and product_id=pid_vein;

  assert r.ads  = 1000, '062: Pureza solo su gasto (no absorbe el de Veinguard)';
  assert r3.ads = 4000, '062: Veinguard tiene fila con ads propios aunque no vendió';
  assert r3.despachadas = 0 and r3.revenue_confirmado = 0, '062: la fila sin venta va en cero';
  assert r3.profit_confirmado = -4000, '062: gastar sin vender es profit negativo';
  assert round(r.ads + r3.ads) = 5000, '062: nada del gasto del día se pierde';

  raise notice '062 ml-ads-item: OK';
end $t$;

rollback;

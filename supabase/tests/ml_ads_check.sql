-- ml_ads_check.sql (026): Product Ads de ML repartido por revenue y restado al profit.
begin;

do $t$
declare d date := current_date - 1; pid_pureza int; pid_rev int; r daily_pnl%rowtype; r2 daily_pnl%rowtype;
begin
  -- este check prueba el REPARTO por revenue; el IVA de ads (046) se neutraliza acá (rollback lo restaura)
  update settings set value = '0' where key = 'ml_ads_iva';
  select id into pid_pureza from products where name = 'Pureza';
  select id into pid_rev    from products where name = 'Revival Oil';

  -- 2 productos ese día: revenue 60.000 (Pureza) + 40.000 (Revival) = 100.000. Sin comisión/flete para aislar ads.
  insert into ml_orders (ml_id, created_at, product, units, pack, total_amount, sale_fee, ship_cost, shipment_id, status, raw) values
    (95001, (d::text||'T12:00:00-03:00')::timestamptz, 'Pureza',      1, 1, 60000, 0, 0, 1, 'paid', '{}'),
    (95002, (d::text||'T12:00:00-03:00')::timestamptz, 'Revival Oil', 1, 1, 40000, 0, 0, 2, 'paid', '{}');
  insert into ml_ad_spend (date, cost) values (d, 10000);   -- gasto Product Ads del día

  perform recompute_daily_pnl(d, d);

  select * into r  from daily_pnl where courier='ml' and dispatch_date=d and product_id=pid_pureza;
  select * into r2 from daily_pnl where courier='ml' and dispatch_date=d and product_id=pid_rev;

  assert r.ads  = 6000, '026: ads Pureza = 10000 * 60% del revenue';
  assert r2.ads = 4000, '026: ads Revival = 10000 * 40% del revenue';
  assert round(r.ads + r2.ads) = 10000, '026: la suma de ads del día = gasto Product Ads';
  assert r.profit_confirmado  = r.revenue_confirmado  - r.comisiones  - r.flete  - r.costo_producto  - r.ads,  '026: profit resta ads (Pureza)';
  assert r2.profit_confirmado = r2.revenue_confirmado - r2.comisiones - r2.flete - r2.costo_producto - r2.ads, '026: profit resta ads (Revival)';

  raise notice '026 ml-ads: OK';
end $t$;

rollback;

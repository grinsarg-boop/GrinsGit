-- ml_bonif_check.sql (045): bonificación Flex del día netea el flete y sube el profit.
begin;

do $t$
declare d date := current_date - 1; pid int; r daily_pnl%rowtype;
begin
  select id into pid from products where name = 'Pureza';

  insert into ml_orders (ml_id, created_at, product, units, pack, total_amount, sale_fee, ship_cost, shipment_id, status, raw) values
    (98001, (d::text||'T12:00:00-03:00')::timestamptz, 'Pureza', 1, 1, 60000, 0, 4150, 1, 'paid', '{}');
  insert into ml_flex_bonif (date, amount) values (d, 869);

  perform recompute_daily_pnl(d, d);

  select * into r from daily_pnl where courier='ml' and dispatch_date=d and product_id=pid;

  assert r.flete = 4150 - 869, '045: flete neto de bonificación';
  assert r.profit_confirmado = r.revenue_confirmado - r.comisiones - r.flete - r.costo_producto - r.ads,
         '045: profit consistente con flete neteado';

  raise notice '045 ml-bonif: OK';
end $t$;

rollback;

-- ml_percep_check.sql (046): ads con IVA en la columna ads + percepciones dentro de comisiones.
begin;

do $t$
declare d date := current_date - 1; pid int; r daily_pnl%rowtype;
begin
  select id into pid from products where name = 'Pureza';

  insert into ml_orders (ml_id, created_at, product, units, pack, total_amount, sale_fee, ship_cost, shipment_id, status, raw, tax_withheld) values
    (99001, (d::text||'T12:00:00-03:00')::timestamptz, 'Pureza', 1, 1, 60000, 10000, 0, 1, 'paid', '{}', 500);
  insert into ml_ad_spend (date, cost) values (d, 10000);          -- neto de la API
  insert into ml_percepciones (date, amount, estimated) values (d, 1800, true);

  perform recompute_daily_pnl(d, d);

  select * into r from daily_pnl where courier='ml' and dispatch_date=d and product_id=pid;

  assert round(r.ads, 2) = 12100, '046: ads = neto × (1 + ml_ads_iva 0.21)';
  assert r.comisiones = 10000 + 500, '047: comisiones = sale_fee + retención (percepciones aparte)';
  assert r.percepciones = 1800, '047: percepciones en su propia columna';
  assert r.profit_confirmado = r.revenue_confirmado - r.comisiones - r.percepciones - r.flete - r.costo_producto - r.ads,
         '047: profit consistente con percepciones desdobladas';

  raise notice '046/047 ml-percep: OK';
end $t$;

rollback;

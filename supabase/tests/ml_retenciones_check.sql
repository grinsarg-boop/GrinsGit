-- ml_retenciones_check.sql (043): retención IIBB/SIRTAC dentro de comisiones y restada al profit.
begin;

do $t$
declare d date := current_date - 1; pid int; r daily_pnl%rowtype;
begin
  select id into pid from products where name = 'Pureza';

  -- 2 órdenes: una con retención real (caso pago 168914140511) y una aún sin consultar (null → 0).
  insert into ml_orders (ml_id, created_at, product, units, pack, total_amount, sale_fee, ship_cost, shipment_id, status, raw, tax_withheld) values
    (96001, (d::text||'T12:00:00-03:00')::timestamptz, 'Pureza', 1, 1, 60000, 10000, 0, 1, 'paid', '{}', 1303.24),
    (96002, (d::text||'T12:00:00-03:00')::timestamptz, 'Pureza', 1, 1, 40000,  5000, 0, 2, 'paid', '{}', null);

  perform recompute_daily_pnl(d, d);

  select * into r from daily_pnl where courier='ml' and dispatch_date=d and product_id=pid;

  assert r.comisiones = 15000 + 1303.24, '043: comisiones = sale_fee + retenciones (null cuenta 0)';
  assert r.profit_confirmado = r.revenue_confirmado - r.comisiones - r.flete - r.costo_producto - r.ads,
         '043: profit resta la retención vía comisiones';

  raise notice '043 ml-retenciones: OK';
end $t$;

rollback;

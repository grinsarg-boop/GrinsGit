-- mp_khalil_check.sql (048): fee real del pago conciliado en correo; 18% solo para no matcheados.
begin;

do $t$
declare d date := current_date - 40; pid int; r daily_pnl%rowtype;
begin
  select id into pid from products where name = 'Natures';

  -- dos órdenes cuotas_3 pagadas de $50.000: una conciliada con fee real $4.000, otra sin pago → 18%
  perform upsert_order(jsonb_build_object('id', 97101, 'name', '#97101', 'created_at', d::text || 'T12:00:00-03:00',
    'financial_status', 'paid', 'tags', 'cuotas_3', 'total_price', '50000',
    'shipping_address', '{"province":"CABA","city":"CABA","zip":"1000"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"50000"}]'::jsonb));
  perform upsert_order(jsonb_build_object('id', 97102, 'name', '#97102', 'created_at', d::text || 'T12:00:00-03:00',
    'financial_status', 'paid', 'tags', 'cuotas_3', 'total_price', '50000',
    'shipping_address', '{"province":"CABA","city":"CABA","zip":"1000"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"50000"}]'::jsonb));
  insert into mp_payments (payment_id, order_number, amount, fee, installments, approved_at)
    values (91001, '97101', 50000, 4000, 1, now());

  perform recompute_daily_pnl(d, d);

  select * into r from daily_pnl where courier='correo' and dispatch_date=d and product_id=pid;

  assert r.comisiones = 4000 + 50000 * 0.18,
    format('048: comisiones = fee real + 18%% fallback (got %s)', r.comisiones);
  assert r.profit_confirmado = r.revenue_confirmado - r.comisiones - r.flete - r.costo_producto - r.ads,
    '048: profit consistente con fee real';

  raise notice '048 mp-khalil: OK';
end $t$;

rollback;

-- correo_check.sql (015): Correo/cuotas SIN proyección — estimado = confirmado, tasa = confirmación actual.
begin;

delete from product_costs;
insert into product_costs (product_id, pack, unit_cost, is_estimated)
select id, 1, 2000, false from products where name = 'Natures';

do $t$
declare d date := current_date - 2; r daily_pnl%rowtype;
begin
  -- 3 cuotas_3 (mismo día, mismo producto): 2 pagadas (confirmadas), 1 pendiente reciente (no madura)
  perform upsert_order(jsonb_build_object('id', 7101, 'name', '#7101', 'created_at', d, 'financial_status', 'paid',
    'tags', 'cod-form, cuotas_3, mp-pagado', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb));
  perform upsert_order(jsonb_build_object('id', 7102, 'name', '#7102', 'created_at', d, 'financial_status', 'paid',
    'tags', 'cuotas_3', 'total_price', '50000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"50000"}]'::jsonb));
  perform upsert_order(jsonb_build_object('id', 7103, 'name', '#7103', 'created_at', d, 'financial_status', 'pending',
    'tags', 'cuotas_3', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb));
  perform recompute_daily_pnl(d, d);

  select * into r from daily_pnl where courier = 'correo' and dispatch_date = d limit 1;
  assert r.despachadas = 3, '015: generados = 3';
  assert r.entregadas = 2, '015: pagados (confirmados) = 2';
  assert r.en_transito = 1, '015: 1 cuota pendiente reciente';
  assert round(r.tasa_actual, 4) = round(2.0 / 3, 4), '015: tasa_actual = 2/3 (confirmación)';
  assert r.tasa_proyectada = r.tasa_actual, '015: tasa_proyectada = tasa_actual (NO se proyecta)';
  assert r.revenue_estimado = r.revenue_confirmado, '015: revenue estimado = confirmado (prepago firme)';
  assert r.profit_estimado = r.profit_confirmado, '015: profit estimado = confirmado (sin proyección)';
  raise notice '015 correo-sin-proyección: OK';
end $t$;

rollback;

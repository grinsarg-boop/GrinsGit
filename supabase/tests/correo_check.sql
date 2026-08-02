-- correo_check.sql (015): Correo/cuotas SIN proyección — estimado = confirmado, tasa = confirmación actual.
begin;

delete from product_costs;
insert into product_costs (product_id, pack, unit_cost, is_estimated)
select id, 1, 2000, false from products where name = 'Natures';

do $t$
declare d date := current_date - 2; r daily_pnl%rowtype;
begin
  -- 3 cuotas_3 (mismo día, mismo producto): 2 pagadas (confirmadas), 1 pendiente reciente (no madura)
  perform upsert_order(jsonb_build_object('id', 7101, 'name', '#7101', 'created_at', d::text || 'T12:00:00-03:00', 'financial_status', 'paid',
    'tags', 'cod-form, cuotas_3, mp-pagado', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb));
  perform upsert_order(jsonb_build_object('id', 7102, 'name', '#7102', 'created_at', d::text || 'T12:00:00-03:00', 'financial_status', 'paid',
    'tags', 'cuotas_3', 'total_price', '50000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"50000"}]'::jsonb));
  perform upsert_order(jsonb_build_object('id', 7103, 'name', '#7103', 'created_at', d::text || 'T12:00:00-03:00', 'financial_status', 'pending',
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

-- 067: el pendiente que ya maduró (link no pagado, +10 días) es un desenlace DEFINITIVO. Antes no
-- entraba en ninguna columna de pérdida y la madurez del día se congelaba en la tasa de confirmación.
do $t$
declare v_d date := current_date - 20; r daily_pnl%rowtype; v_res int;
begin
  perform upsert_order(jsonb_build_object('id', 7104, 'name', '#7104', 'created_at', v_d::text || 'T12:00:00-03:00', 'financial_status', 'paid',
    'tags', 'cuotas_3', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb));
  perform upsert_order(jsonb_build_object('id', 7105, 'name', '#7105', 'created_at', v_d::text || 'T12:00:00-03:00', 'financial_status', 'pending',
    'tags', 'cuotas_3', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb));
  perform recompute_daily_pnl(v_d, v_d);

  select * into r from daily_pnl where courier = 'correo' and dispatch_date = v_d limit 1;
  assert r.despachadas = 2 and r.entregadas = 1, '067: 2 generados, 1 pagado';
  assert r.en_transito = 0, '067: el pendiente de 20 días ya no está en tránsito, está perdido';

  select resueltas into v_res from dashboard_days(v_d) where dispatch_date = v_d;
  assert v_res = 2, '067: dashboard_days — el link no pagado cuenta como resuelto (madurez 100%)';

  select sum(resueltas)::int into v_res from sales_rows(v_d) sr where sr.d = v_d and sr.c = 'correo';
  assert v_res = 2, '067: sales_rows — idem en /ventas (columna Resolución)';
  raise notice '067 madurez-prepago: OK';
end $t$;

rollback;

-- despacho_check.sql (080): el día de venta reconoce los pedidos que todavía no despacharon.
-- Lo que protege: que un pedido generado y sin guía valga δ(edad) × prior en el ESTIMADO (nunca en
-- el confirmado), que δ decaiga con la edad, y que los pedidos de link MP (cuotas_3) no entren al
-- cálculo de δ — sin ese filtro δ se hunde ~20 pp y es artefacto, no operación.
begin;

do $t$
declare
  v_dsp jsonb; v_est numeric; v_conf numeric; v_gen int; v_desp int;
  v_est_viejo numeric; v_d0 numeric; v_d6 numeric;
begin
  delete from shipments; delete from order_items; delete from orders; delete from delivery_priors;
  insert into products (id, name) values (902, 'TestDespacho') on conflict (id) do nothing;
  insert into product_costs (product_id, pack, unit_cost) values (902, 1, 5000)
  on conflict (product_id, pack) do update set unit_cost = 5000;

  -- ---- Cohorte cerrada (-30): da el prior (60%) y la base de fletes ------------------------
  insert into orders (shopify_id, order_number, created_at, province, cod_amount, total, courier)
  select 560000 + g, '#D' || g, now() - interval '30 days', 'Córdoba', 40000, 40000, 'urbano'
  from generate_series(1, 200) g;
  insert into order_items (order_id, product_id, pack, qty, unit_price, title_raw)
  select o.id, 902, 1, 1, 40000, 'TestDespacho' from orders o where o.shopify_id between 560001 and 560200;
  insert into shipments (courier, tracking, order_id, province, dispatched_at,
                         status_raw, status_canonical, resolved_at, freight_cost)
  select 'urbano', 'D' || o.shopify_id, o.id, 'Córdoba', current_date - 30, 'X',
         case when o.shopify_id <= 560120 then 'entregado' else 'devuelto' end,
         current_date - 25, 9000
  from orders o where o.shopify_id between 560001 and 560200;

  -- ---- Cohortes de DESPACHO maduras (generadas -21..-7): definen δ -------------------------
  -- 300 pedidos: 285 despachan al día 1 (95%), 15 nunca. ⇒ δ(0) = 95%, y δ sube condicionado
  -- porque los que no despacharon al día 1 ya casi no despachan.
  insert into orders (shopify_id, order_number, created_at, province, cod_amount, total, courier)
  select 570000 + g, '#E' || g, now() - interval '14 days', 'Córdoba', 40000, 40000, 'urbano'
  from generate_series(1, 300) g;
  insert into order_items (order_id, product_id, pack, qty, unit_price, title_raw)
  select o.id, 902, 1, 1, 40000, 'TestDespacho' from orders o where o.shopify_id between 570001 and 570300;
  insert into shipments (courier, tracking, order_id, province, dispatched_at,
                         status_raw, status_canonical, resolved_at, freight_cost)
  select 'urbano', 'E' || o.shopify_id, o.id, 'Córdoba', current_date - 13, 'X',
         case when o.shopify_id <= 570160 then 'entregado' else 'devuelto' end,
         current_date - 8, 9000
  from orders o where o.shopify_id between 570001 and 570285;

  -- ---- Trampa cuotas_3: 200 pedidos de link MP, courier seteado, NUNCA llevan guía ---------
  -- Si entraran al cálculo, δ caería de 95% a ~57%. Este bloque existe para que eso se ponga rojo.
  insert into orders (shopify_id, order_number, created_at, province, cod_amount, total, courier,
                      tags, financial_status)
  select 580000 + g, '#L' || g, now() - interval '14 days', 'Córdoba', 40000, 40000, 'urbano',
         'cuotas_3', case when g <= 80 then 'paid' else 'pending' end
  from generate_series(1, 200) g;
  insert into order_items (order_id, product_id, pack, qty, unit_price, title_raw)
  select o.id, 902, 1, 1, 40000, 'TestDespacho' from orders o where o.shopify_id between 580001 and 580200;

  perform recompute_priors();
  v_dsp := (select value from settings where key = 'dispatch_curve');

  -- ---- 1. La curva existe y refleja el 95%, no el 57% del artefacto -----------------------
  assert v_dsp -> 'urbano' is not null, '080: urbano tiene curva de despacho';
  v_d0 := (v_dsp -> 'urbano' ->> 0)::numeric;
  assert abs(v_d0 - 0.95) < 0.02,
    '080: δ(0) = 95% — si da ~57% es que los cuotas_3 se colaron en el cálculo';

  -- ---- 2. δ decae: seguir sin guía es mala señal ------------------------------------------
  v_d6 := (v_dsp -> 'urbano' ->> 6)::numeric;
  assert v_d6 < v_d0,
    '080: δ(6) < δ(0) — un pedido que sigue sin guía a los 6 días ya casi no despacha';
  assert not exists (select 1 from generate_series(0, 29) i
    where (v_dsp -> 'urbano' ->> i)::numeric < (v_dsp -> 'urbano' ->> (i + 1))::numeric),
    '080: la curva de despacho nunca sube';

  -- ---- 3. Un pedido generado HOY y sin guía entra al estimado, no al confirmado ------------
  insert into orders (shopify_id, order_number, created_at, province, cod_amount, total, courier)
  select 590000 + g, '#S' || g, now(), 'Córdoba', 40000, 40000, 'urbano'
  from generate_series(1, 50) g;
  insert into order_items (order_id, product_id, pack, qty, unit_price, title_raw)
  select o.id, 902, 1, 1, 40000, 'TestDespacho' from orders o where o.shopify_id between 590001 and 590050;

  perform recompute_daily_pnl(current_date - 35, current_date);

  select sum(generadas), sum(despachadas), sum(revenue_est), sum(revenue_conf)
    into v_gen, v_desp, v_est, v_conf
  from sales_rows(current_date) where d = current_date and c = 'urbano';

  assert v_gen = 50,   '080: los 50 generados de hoy figuran';
  assert v_desp = 0,   '080: ninguno despachó todavía';
  assert v_conf = 0,   '080: sin guía no hay NADA confirmado';
  assert v_est > 0,    '080: pero sí hay revenue estimado — antes de esta migración era 0';
  -- 50 × δ(0)=0,95 × prior=0,60 × $40.000 ≈ $1,14 M
  assert abs(v_est - 50 * v_d0 * 0.60 * 40000) < 50000,
    '080: el estimado es exactamente Σ δ(edad) × prior × cod';

  raise notice '080 despacho: OK (δ0=%, δ6=%, revenue_est de hoy=%)',
    round(v_d0, 4), round(v_d6, 4), round(v_est);
end $t$;

rollback;

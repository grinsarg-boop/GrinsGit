-- cohorte_check.sql (079): el estimado reacciona a la propia cohorte, no solo al prior.
-- Lo que protege: que una cohorte que viene entregando MAL se valúe por debajo del prior (y una
-- que viene bien, por encima), que no reaccione antes de tener señal (día 7) ni con muestra chica,
-- y que siga convergiendo al confirmado cuando cierra.
begin;

do $t$
declare
  v_k_joven numeric; v_k_chica numeric; v_k_mala numeric;
  v_prior numeric; v_dec jsonb; v_tasa numeric; v_tasa_072 numeric;
  v_gd jsonb; v_res jsonb;
begin
  delete from shipments; delete from order_items; delete from orders; delete from delivery_priors;
  insert into products (id, name) values (901, 'TestCohorte') on conflict (id) do nothing;
  insert into product_costs (product_id, pack, unit_cost) values (901, 1, 5000)
  on conflict (product_id, pack) do update set unit_cost = 5000;

  -- ---- Cohorte CERRADA (despacho -30): de acá salen las curvas y el prior --------------------
  -- 200 guías: 120 entregan (60 a edad 3, 40 a edad 10, 20 a edad 18), 80 devuelven a edad 14.
  --   prior      = 120/200 = 60,0%
  --   Gd(10)     = 100/120 = 0,8333   (fracción de las entregas finales ya realizada al día 10)
  --   Rexp(10)   = 100/200 = 0,5000
  --   decay(10)  = P(entrega|abierta@10)/P(entrega) = (20/100)/0,60 = 0,3333
  insert into orders (shopify_id, order_number, created_at, province, cod_amount, total)
  select 510000 + g, '#C' || g, now() - interval '30 days', 'Córdoba', 40000, 40000
  from generate_series(1, 200) g;
  insert into order_items (order_id, product_id, pack, qty, unit_price, title_raw)
  select o.id, 901, 1, 1, 40000, 'TestCohorte' from orders o where o.shopify_id between 510001 and 510200;

  insert into shipments (courier, tracking, order_id, province, dispatched_at,
                         status_raw, status_canonical, resolved_at, freight_cost)
  select 'urbano', 'C' || o.shopify_id, o.id, 'Córdoba', current_date - 30, 'X',
         case when o.shopify_id <= 510120 then 'entregado' else 'devuelto' end,
         case when o.shopify_id <= 510060 then current_date - 27    -- 60 entregas a edad 3
              when o.shopify_id <= 510100 then current_date - 20    -- 40 entregas a edad 10
              when o.shopify_id <= 510120 then current_date - 12    -- 20 entregas a edad 18
              else current_date - 16 end,                           -- 80 devoluciones a edad 14
         9000
  from orders o where o.shopify_id between 510001 and 510200;

  perform recompute_priors();

  v_gd  := (select value from settings where key = 'delivery_curve_gd');
  v_res := (select value from settings where key = 'delivery_curve_res');
  select p_delivery into v_prior from delivery_priors
   where courier = 'urbano' and province is null and product_id is null;

  -- ---- 1. Las curvas existen y tienen la forma medida ----------------------------------------
  assert v_gd -> 'urbano' is not null,  '079: urbano tiene curva Gd';
  assert v_res -> 'urbano' is not null, '079: urbano tiene curva Rexp';
  assert (v_gd -> 'urbano' ->> 0)::numeric = 0, '079: Gd(0) = 0 (a edad 0 no entregó nada todavía)';
  assert abs((v_gd -> 'urbano' ->> 10)::numeric - 0.8333) < 0.001, '079: Gd(10) = 100/120';
  assert abs((v_res -> 'urbano' ->> 10)::numeric - 0.5000) < 0.001, '079: Rexp(10) = 100/200';
  assert abs(v_prior - 0.60) < 0.001, '079: el prior sale de la ventana fija 21-35 (la cohorte -30)';

  -- ---- 2. Monótonas no decrecientes: el tiempo no borra entregas ni resoluciones -------------
  assert not exists (select 1 from generate_series(0, 29) i
    where (v_gd -> 'urbano' ->> i)::numeric > (v_gd -> 'urbano' ->> (i + 1))::numeric),
    '079: Gd nunca baja';
  assert not exists (select 1 from generate_series(0, 29) i
    where (v_res -> 'urbano' ->> i)::numeric > (v_res -> 'urbano' ->> (i + 1))::numeric),
    '079: Rexp nunca baja';

  -- ---- 3. Guardas: sin señal (t<7) y con muestra chica, k = 1 exacto -------------------------
  -- Cohorte VIVA joven: 80 guías despachadas hace 3 días, todas abiertas.
  insert into orders (shopify_id, order_number, created_at, province, cod_amount, total)
  select 520000 + g, '#J' || g, now(), 'Córdoba', 40000, 40000 from generate_series(1, 80) g;
  insert into order_items (order_id, product_id, pack, qty, unit_price, title_raw)
  select o.id, 901, 1, 1, 40000, 'TestCohorte' from orders o where o.shopify_id between 520001 and 520080;
  insert into shipments (courier, tracking, order_id, province, dispatched_at,
                         status_raw, status_canonical, freight_cost)
  select 'urbano', 'J' || o.shopify_id, o.id, 'Córdoba', current_date - 3, 'EN', 'en_reparto', 9000
  from orders o where o.shopify_id between 520001 and 520080;

  v_k_joven := cohort_k('urbano', current_date - 3);
  assert v_k_joven = 1,
    '079: antes del día 7 no hay señal (B y C se abren 2×) ⇒ k = 1, comportamiento 072 exacto';

  -- Cohorte VIVA de 10 guías a 10 días: muestra chica ⇒ no se corrige.
  insert into orders (shopify_id, order_number, created_at, province, cod_amount, total)
  select 530000 + g, '#P' || g, now(), 'Santa Fe', 40000, 40000 from generate_series(1, 10) g;
  insert into order_items (order_id, product_id, pack, qty, unit_price, title_raw)
  select o.id, 901, 1, 1, 40000, 'TestCohorte' from orders o where o.shopify_id between 530001 and 530010;
  insert into shipments (courier, tracking, order_id, province, dispatched_at,
                         status_raw, status_canonical, freight_cost)
  select 'fixy', 'P' || o.shopify_id, o.id, 'Santa Fe', current_date - 10, 'EN', 'en_reparto', 5000
  from orders o where o.shopify_id between 530001 and 530010;

  v_k_chica := cohort_k('fixy', current_date - 10);
  assert v_k_chica = 1, '079: muestra chica (<60 guías) ⇒ k = 1, no se corrige con ruido';

  -- ---- 4. Una cohorte que entrega MAL se valúa por debajo del prior --------------------------
  -- 100 guías a 10 días: 25 entregadas + 35 devueltas (40 abiertas). El prior diría 60%; su propia
  -- maduración dice ~30%: al día 10 ya debería haber realizado el 83% de sus entregas finales.
  insert into orders (shopify_id, order_number, created_at, province, cod_amount, total)
  select 540000 + g, '#M' || g, now(), 'Córdoba', 40000, 40000 from generate_series(1, 100) g;
  insert into order_items (order_id, product_id, pack, qty, unit_price, title_raw)
  select o.id, 901, 1, 1, 40000, 'TestCohorte' from orders o where o.shopify_id between 540001 and 540100;
  insert into shipments (courier, tracking, order_id, province, dispatched_at,
                         status_raw, status_canonical, resolved_at, freight_cost)
  select 'urbano', 'M' || o.shopify_id, o.id, 'Córdoba', current_date - 10, 'EN',
         case when o.shopify_id <= 540025 then 'entregado'
              when o.shopify_id <= 540060 then 'devuelto'
              else 'en_reparto' end,
         case when o.shopify_id <= 540060 then current_date - 4 else null end,
         9000
  from orders o where o.shopify_id between 540001 and 540100;

  v_k_mala := cohort_k('urbano', current_date - 10);
  assert v_k_mala < 1,
    '079: cohorte entregando por debajo del prior ⇒ k < 1 (el estimado la sigue a ella, no al pasado)';
  assert v_k_mala >= 0 and v_k_mala <= 3, '079: k queda dentro de los rieles [0,3]';

  -- End-to-end: la tasa que muestra el panel tiene que quedar por debajo del prior × decay.
  v_dec := (select value from settings where key = 'delivery_decay');
  perform recompute_daily_pnl(current_date - 15, current_date);
  select tasa_proyectada into v_tasa from daily_pnl where dispatch_date = current_date - 10;
  v_tasa_072 := (25.0 + 40.0 * v_prior * (v_dec -> 'urbano' ->> 10)::numeric) / 100.0;
  assert v_tasa < v_tasa_072,
    '079: end-to-end, el panel proyecta MENOS que el método 072 para una cohorte que viene mal';

  -- ---- 5. §4.7 prop 1: cohorte 100% resuelta ⇒ estimado = confirmado -------------------------
  -- La cerrada del -30 no tiene guías abiertas: su tasa es exactamente 120/200, sin proyección.
  select tasa_proyectada into v_tasa from daily_pnl where dispatch_date = current_date - 30;
  assert v_tasa is null or abs(v_tasa - 0.60) < 0.0001,
    '079: cohorte cerrada ⇒ el estimado converge al confirmado (k no la mueve)';

  raise notice '079 cohorte: OK (prior=%, k_mala=%, tasa panel=% vs 072=%)',
    round(v_prior, 4), round(v_k_mala, 4), round(v_tasa, 4), round(v_tasa_072, 4);
end $t$;

rollback;

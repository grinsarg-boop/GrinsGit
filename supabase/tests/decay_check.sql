-- decay_check.sql (072): el prior se condiciona a la EDAD de la guía.
-- 079: el fixture se despachaba a 40 días, que entraba en la ventana vieja del prior (piso -45) y
-- queda FUERA de la ventana fija 21-35 del canon del 21/08/2026. Movido a 30 días: mismo fixture,
-- misma forma de hazard, dentro de la ventana. Las edades de resolución (2 y 12) no cambian.
-- Lo que protege: que una guía vieja y todavía abierta valga menos que una despachada hoy. Si alguien
-- saca el `× decay` de cualquiera de los dos consumidores, o la curva sale mal, esto se pone rojo.
begin;

do $t$
declare
  v_dec  jsonb;
  v_arr  jsonb;
  v_p1   numeric;
  v_p10  numeric;
  v_prior numeric;
begin
  delete from shipments; delete from order_items; delete from orders; delete from delivery_priors;
  insert into products (id, name) values (900, 'TestDecay') on conflict (id) do nothing;
  insert into product_costs (product_id, pack, unit_cost) values (900, 1, 5000)
  on conflict (product_id, pack) do update set unit_cost = 5000;

  -- ---- Fixture: cohorte URBANO cerrada, despachada hace 40 días. Tres grupos, para que el hazard
  -- tenga forma: 100 entregan rápido (edad 2), 20 entregan lento (edad 12), 80 se devuelven (edad 12).
  --   P(entrega) global      = 120/200 = 60,0%
  --   P(entrega | abierta@5) =  20/100 = 20,0%  → decay(5) = 0,3333
  insert into orders (shopify_id, order_number, created_at, province, cod_amount, total)
  select 500000 + g, '#T' || g, now() - interval '30 days', 'Córdoba', 40000, 40000
  from generate_series(1, 200) g;
  insert into order_items (order_id, product_id, pack, qty, unit_price, title_raw)
  select o.id, 900, 1, 1, 40000, 'TestDecay' from orders o where o.shopify_id >= 500000;

  insert into shipments (courier, tracking, order_id, province, dispatched_at,
                         status_raw, status_canonical, resolved_at, freight_cost)
  select 'urbano', 'T' || o.shopify_id, o.id, 'Córdoba', current_date - 30,
         'X',
         case when o.shopify_id < 500121 then 'entregado' else 'devuelto' end,
         case when o.shopify_id < 500101 then current_date - 28    -- 100 entregas rápidas (edad 2)
              else current_date - 18 end,                          -- 20 lentas + 80 devueltas (edad 12)
         9000
  from orders o where o.shopify_id >= 500000;

  -- ---- Fixture FIXY: 150 guías que "resuelven" todas el día del despacho. Es la firma exacta del
  -- histórico importado sin fechas reales (Fixy pre-julio/2026). La guarda tiene que dejarlo AFUERA.
  insert into orders (shopify_id, order_number, created_at, province, cod_amount, total)
  select 600000 + g, '#F' || g, now() - interval '30 days', 'CABA', 40000, 40000
  from generate_series(1, 150) g;
  insert into order_items (order_id, product_id, pack, qty, unit_price, title_raw)
  select o.id, 900, 1, 1, 40000, 'TestDecay' from orders o where o.shopify_id >= 600000;
  insert into shipments (courier, tracking, order_id, province, dispatched_at,
                         status_raw, status_canonical, resolved_at, freight_cost)
  select 'fixy', 'F' || o.shopify_id, o.id, 'CABA', current_date - 30, 'X',
         case when o.shopify_id < 600101 then 'entregado' else 'devuelto' end,
         current_date - 30, 5000
  from orders o where o.shopify_id >= 600000;

  perform recompute_priors();
  v_dec := (select value from settings where key = 'delivery_decay');
  v_arr := v_dec -> 'urbano';

  -- ---- 1. La curva existe, arranca en 1 y decae ----
  assert v_arr is not null, '072: urbano tiene curva de decay';
  assert (v_arr ->> 0)::numeric = 1, '072: decay(0) = 1 (a edad 0 el prior vale tal cual)';
  assert abs((v_arr ->> 5)::numeric - 0.3333) < 0.001,
         '072: decay(5) = P(entrega|abierta@5)/P(entrega) = 0,20/0,60';

  -- ---- 2. Monótona no creciente: sobrevivir un día más nunca mejora las chances ----
  assert not exists (
    select 1 from generate_series(0, 29) i
    where (v_arr ->> i)::numeric < (v_arr ->> (i + 1))::numeric),
    '072: la curva de decay nunca sube';

  -- ---- 3. Guarda: fechas de resolución rotas ⇒ el courier queda afuera y vuelve al prior plano ----
  assert v_dec -> 'fixy' is null,
         '072: fixy con 100% de resoluciones a edad 0 queda fuera del decay (guarda de datos rotos)';

  -- ---- 4. Consumo end-to-end: dos guías abiertas idénticas, distinta edad ----
  -- tasa_proyectada con 0 entregadas y 1 abierta es exactamente prior × decay(edad), así que compara
  -- el número que el panel muestra, no la fórmula por dentro.
  insert into orders (shopify_id, order_number, created_at, province, cod_amount, total)
  values (700001, '#N1', now(), 'Córdoba', 40000, 40000),
         (700010, '#N10', now(), 'Córdoba', 40000, 40000);
  insert into order_items (order_id, product_id, pack, qty, unit_price, title_raw)
  select o.id, 900, 1, 1, 40000, 'TestDecay' from orders o where o.shopify_id in (700001, 700010);
  insert into shipments (courier, tracking, order_id, province, dispatched_at,
                         status_raw, status_canonical, freight_cost)
  select 'urbano', 'N' || o.shopify_id, o.id, 'Córdoba',
         current_date - (case when o.shopify_id = 700001 then 1 else 10 end),
         'EN', 'en_reparto', 9000
  from orders o where o.shopify_id in (700001, 700010);

  perform recompute_daily_pnl(current_date - 15, current_date);

  select tasa_proyectada into v_p1  from daily_pnl where dispatch_date = current_date - 1;
  select tasa_proyectada into v_p10 from daily_pnl where dispatch_date = current_date - 10;
  select p_delivery into v_prior from delivery_priors
   where courier = 'urbano' and province = 'Córdoba' and product_id = 900;

  assert v_p10 < v_p1, '072: la guía de 10 días proyecta MENOS que la de 1 día (era el bug: iguales)';
  assert abs(v_p1  - v_prior * (v_arr ->> 1)::numeric)  < 0.0001, '072: tasa@1d  = prior × decay(1)';
  assert abs(v_p10 - v_prior * (v_arr ->> 10)::numeric) < 0.0001, '072: tasa@10d = prior × decay(10)';

  -- ---- 5. Madurez por % resuelto, no por días fijos ----
  -- El fixture resuelve el 50% a edad 2 y el 100% a edad 12 ⇒ el primer t con ≥90% es 12.
  assert (select (value->>'urbano')::int from settings where key = 'maturity_days') = 12,
         '072: maturity_days.urbano se calcula (primer t con ≥90% resuelto), no es el 10 fijo';
  assert (select (value->>'correo')::int from settings where key = 'maturity_days') = 10,
         '072: correo no se toca (es P(confirmación), otra cohorte)';

  raise notice '072 decay: OK (decay(5)=%, tasa 1d=% vs 10d=%)',
    round((v_arr ->> 5)::numeric, 4), round(v_p1, 4), round(v_p10, 4);
end $t$;

rollback;

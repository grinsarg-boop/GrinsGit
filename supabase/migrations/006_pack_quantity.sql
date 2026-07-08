-- 006 — Lleva a prod lo validado en la reconciliación de mayo. NO edita 001–005: CREATE OR REPLACE.
--   a. upsert_order: pack = QUANTITY del line item de Shopify (el título es marketing "2x1" y NO
--      lleva el pack; el regex match_pack colapsaba todo a 1). qty=1 (el costo se cuenta 1 vez por
--      línea; la escala de costos es NO lineal). match_pack muere.
--   b. upsert_shipment_events: el estimate de flete corre SOLO sobre las guías del batch (no re-estima
--      todas en cada llamada) → mata el O(n²) que reventaba el statement timeout de 8s en el backfill.
--      Además: dispatched_at de urbano sin ciclo = fecha de fulfillment de Shopify (fallback validado).
--   c. Seed completo de product_costs (tabla de Pancho + goteros x4/x5 + alias x1→x2 beevenom/veinguard).
-- NO se toca el statement_timeout del service_role: con la función arreglada no hace falta, y los 8s
-- quedan como guardia (si vuelve a saltar, algo sigue mal).

-- ============ a. upsert_order: pack = quantity ============
create or replace function upsert_order(p jsonb) returns bigint
language plpgsql as $fn$
declare
  v_id      bigint;
  v_total   numeric := coalesce((p->>'total_price')::numeric, 0);
  v_deposit numeric := 0;
  v_tags    text    := coalesce(p->>'tags', '');
  v_fin     text    := p->>'financial_status';
  v_number  text    := replace(coalesce(p->>'name', p->>'order_number', p->>'id'), '#', '');
  v_addr    jsonb   := coalesce(p->'shipping_address', '{}'::jsonb);
  v_ship_courier text;
  m text[];
begin
  m := regexp_match(v_tags, '(sena|seña):\s*([0-9]+(?:[.,][0-9]+)?)', 'i');
  if m is not null then v_deposit := replace(m[2], ',', '.')::numeric; end if;
  if v_fin = 'paid' then v_deposit := v_total; end if;

  insert into orders (shopify_id, order_number, created_at, cancelled_at, financial_status,
                      customer_name, phone, province, city, zip, courier,
                      total, cod_amount, deposit_amount, tags, raw, updated_at)
  values ((p->>'id')::bigint, v_number, (p->>'created_at')::timestamptz,
          (p->>'cancelled_at')::timestamptz, v_fin,
          v_addr->>'name', v_addr->>'phone', v_addr->>'province', v_addr->>'city', v_addr->>'zip',
          classify_courier(v_addr->>'province', v_addr->>'zip'),
          v_total, greatest(v_total - v_deposit, 0), v_deposit, v_tags, p, now())
  on conflict (shopify_id) do update set
    order_number = excluded.order_number, created_at = excluded.created_at,
    cancelled_at = excluded.cancelled_at, financial_status = excluded.financial_status,
    customer_name = excluded.customer_name, phone = excluded.phone,
    province = excluded.province, city = excluded.city, zip = excluded.zip,
    courier = excluded.courier, total = excluded.total, cod_amount = excluded.cod_amount,
    deposit_amount = excluded.deposit_amount, tags = excluded.tags, raw = excluded.raw,
    updated_at = now()
  returning id into v_id;

  select courier into v_ship_courier from shipments where order_id = v_id limit 1;
  if v_ship_courier is not null then
    update orders set courier = v_ship_courier where id = v_id;
  end if;

  -- Ítems: producto por keyword; PACK = quantity (unidades compradas), qty = 1 (costo 1 vez/línea).
  delete from order_items where order_id = v_id;
  insert into order_items (order_id, product_id, pack, qty, unit_price, title_raw)
  select v_id,
         match_product(coalesce(li->>'title', '')),
         coalesce((li->>'quantity')::int, 1),        -- pack = quantity (antes: match_pack del título)
         1,                                           -- qty = 1: el pack ya es las unidades
         coalesce((li->>'price')::numeric, 0),
         li->>'title'
  from jsonb_array_elements(coalesce(p->'line_items', '[]'::jsonb)) li;

  update shipments set order_id = v_id, updated_at = now()
  where order_id is null and order_ref is not null
    and replace(order_ref, '#', '') = v_number;

  return v_id;
end $fn$;

-- match_pack muere: el pack sale del quantity, no del título. Era usado sólo por upsert_order.
drop function if exists match_pack(text);

-- ============ b. upsert_shipment_events: estimate por batch (mata O(n²)) + fallback fulfillment ============
create or replace function upsert_shipment_events(p jsonb) returns int
language plpgsql as $fn$
declare
  e jsonb;
  v_ship bigint; v_canon text; v_ins int; v_count int := 0;
  v_courier text; v_tarifa numeric; v_importe numeric;
  v_mult numeric := (select (value::text)::numeric from settings where key = 'urbano_freight_mult');
  v_touched bigint[] := '{}';               -- guías tocadas por ESTE batch (para acotar el estimate)
begin
  for e in select * from jsonb_array_elements(p) loop
    v_courier := e->>'courier';

    insert into shipments (courier, tracking, order_ref, province, raw)
    values (v_courier, e->>'tracking', e->>'order_ref', e->>'province', coalesce(e->'raw', '{}'::jsonb))
    on conflict (courier, tracking) do update set
      order_ref = coalesce(shipments.order_ref, excluded.order_ref),
      province  = coalesce(shipments.province, excluded.province),
      raw       = shipments.raw || excluded.raw
    returning id into v_ship;
    v_touched := array_append(v_touched, v_ship);

    v_canon := map_status(v_courier, e->>'status_raw');
    insert into shipment_events (shipment_id, status_raw, status_canonical, occurred_at, raw)
    values (v_ship, e->>'status_raw', v_canon, (e->>'occurred_at')::timestamptz, e->'raw')
    on conflict do nothing;
    get diagnostics v_ins = row_count;
    v_count := v_count + v_ins;

    v_tarifa  := (e->>'tarifa')::numeric;
    v_importe := (e->>'importe')::numeric;
    if v_courier = 'urbano' and v_tarifa is not null then
      update shipments set freight_tarifa = v_tarifa, freight_cost = v_tarifa * v_mult,
             freight_is_estimated = false where id = v_ship;
    elsif v_courier = 'fixy' and v_importe is not null then
      update shipments set freight_tarifa = v_importe, freight_cost = v_importe,
             freight_is_estimated = false where id = v_ship;
    end if;

    update shipments s set
      status_raw = le.status_raw, status_canonical = le.status_canonical, status_at = le.occurred_at,
      resolved_at = case when le.status_canonical in ('entregado','devuelto','siniestro','cancelado')
                         then le.occurred_at end,
      dispatched_at = coalesce(desp.d, s.dispatched_at, fe.d),
      updated_at = now()
    from (select status_raw, status_canonical, occurred_at from shipment_events
           where shipment_id = v_ship order by occurred_at desc limit 1) le,
         (select min(occurred_at)::date as d from shipment_events where shipment_id = v_ship) fe,
         (select min(occurred_at)::date as d from shipment_events
           where shipment_id = v_ship and status_canonical = 'despachado') desp
    where s.id = v_ship;
  end loop;

  -- Match exacto por shopify_id (Urbano) → order_number (Fixy). Sin cambios respecto de 003.
  update shipments s
     set order_id = o.id, province = coalesce(s.province, o.province), updated_at = now()
  from orders o
  where s.order_id is null
    and o.shopify_id = case when s.order_ref ~ '^\d{10,}$' then s.order_ref::bigint end;
  update shipments s
     set order_id = o.id, province = coalesce(s.province, o.province), updated_at = now()
  from orders o
  where s.order_id is null and s.order_ref is not null
    and replace(s.order_ref, '#', '') = o.order_number;

  -- Fallback de cohorte (validado en la reconciliación): urbano sin evento 'despachado' (WS sin
  -- ciclo, ej. estados de intake PI/IF) → dispatched_at = fecha de fulfillment de Shopify. Acotado
  -- al batch. El dato ya está en orders.raw.
  update shipments s set dispatched_at = (o.raw->'fulfillments'->0->>'created_at')::date, updated_at = now()
  from orders o
  where o.id = s.order_id and s.id = any(v_touched) and s.courier = 'urbano'
    and (o.raw->'fulfillments'->0->>'created_at') is not null
    and not exists (select 1 from shipment_events e where e.shipment_id = s.id and e.status_canonical = 'despachado');

  -- Flete estimado SÓLO de las guías del batch (§4.1) — antes re-estimaba TODAS las urbano sin
  -- facturar en cada llamada → O(n²) que reventaba el timeout de 8s del backfill.
  update shipments
     set freight_cost = estimate_urbano_freight(province), freight_is_estimated = true
  where id = any(v_touched) and courier = 'urbano' and freight_tarifa is null
    and (freight_cost is null or freight_is_estimated);

  return v_count;
end $fn$;

-- ============ c. Seed completo de product_costs (costo TOTAL por pack, ARS, tabla de Pancho) ============
insert into product_costs (product_id, pack, unit_cost, is_estimated)
select p.id, v.pack, v.cost, false
from products p
join (values
  ('Natures', 1, 2500), ('Natures', 2, 4500), ('Natures', 3, 7000), ('Natures', 4, 10000), ('Natures', 5, 12500),
  ('Pureza',  1, 2500), ('Pureza',  2, 4500), ('Pureza',  3, 7000), ('Pureza',  4, 10000), ('Pureza',  5, 12500),
  -- Veinguard/BeeVenom NO existen como x1: el x1 es el x2 mal tipeado en Shopify (quantity=1 en vez
  -- de 2). Se seedea x1 = costo de x2 (ALIAS) → blinda prod: cualquier quantity=1 futura recibe el
  -- costo correcto automáticamente.
  ('Veinguard', 1, 3000), ('Veinguard', 2, 3000), ('Veinguard', 4, 6000),   -- x1 = alias de x2
  ('BeeVenom',  1, 6000), ('BeeVenom',  2, 6000), ('BeeVenom',  3, 8500),    -- x1 = alias de x2
  ('Altus', 1, 3000), ('Altus', 2, 5500), ('Altus', 3, 8000)
) v(name, pack, cost) on p.name = v.name
on conflict (product_id, pack) do update set unit_cost = excluded.unit_cost, is_estimated = false;

-- ACL: CREATE OR REPLACE preserva permisos; se re-aplica por las dudas (sólo service role).
revoke execute on function upsert_order(jsonb) from anon, authenticated;
revoke execute on function upsert_shipment_events(jsonb) from anon, authenticated;

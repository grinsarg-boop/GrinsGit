-- tag_dispatch_check.sql (013): la guía COD nace del tag `guia-<código>`.
-- Corre sobre 001..013 aplicadas. Rollbackea al final.
begin;

do $t$
declare v_trk text; v_cour text; v_ref text;
begin
  -- Urbano despachado por tag: guía = shopify_id, courier del tag
  perform upsert_order(jsonb_build_object(
    'id', 9001, 'name', '#9001', 'created_at', current_date - 2, 'financial_status', 'pending',
    'tags', 'cod-form, urbano, despachado, guia-9001', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000","name":"Cli U"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb));
  select count(*) into strict v_trk from shipments s join orders o on o.id = s.order_id where o.shopify_id = 9001;
  assert v_trk = '1', '013: pedido con tag guia- debe crear exactamente 1 guía';
  select s.tracking, s.courier into v_trk, v_cour from shipments s join orders o on o.id = s.order_id where o.shopify_id = 9001;
  assert v_trk = '9001', '013: tracking = código del tag (urbano = shopify_id)';
  assert v_cour = 'urbano', '013: courier tomado del tag';

  -- Idempotencia: reprocesar el mismo pedido (webhook orders/updated repetido) no duplica
  perform upsert_order((select raw from orders where shopify_id = 9001));
  assert (select count(*) from shipments s join orders o on o.id = s.order_id where o.shopify_id = 9001) = 1,
    '013: reprocesar el pedido no duplica la guía';

  -- Fixy: guía Fixy en el tag + order_ref=remito (el sync fixy poletea por remito=order_number)
  perform upsert_order(jsonb_build_object(
    'id', 9002, 'name', '#9002', 'created_at', current_date - 2, 'financial_status', 'pending',
    'tags', 'cod-form, fixy, despachado, guia-777123', 'total_price', '40000',
    'shipping_address', '{"province":"Ciudad Autónoma de Buenos Aires","city":"CABA","zip":"1425","name":"Cli F"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb));
  select s.courier, s.tracking, s.order_ref into v_cour, v_trk, v_ref
    from shipments s join orders o on o.id = s.order_id where o.shopify_id = 9002;
  assert v_cour = 'fixy' and v_trk = '777123' and v_ref = '9002', '013: fixy → guía Fixy + order_ref=remito';

  -- cuotas_3 con tag guia-: NO crea guía COD (esos van por la rama Correo/prepago, 012)
  perform upsert_order(jsonb_build_object(
    'id', 9003, 'name', '#9003', 'created_at', current_date - 2, 'financial_status', 'paid',
    'tags', 'andreani, cuotas_3, despachado, guia-9003', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000","name":"Cli C"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb));
  assert (select count(*) from shipments s join orders o on o.id = s.order_id where o.shopify_id = 9003) = 0,
    '013: cuotas_3 no crea guía COD (canal Correo)';

  -- Backfill (recupera el gap): pedido tageado que quedó SIN guía (pre-013) → la sentencia lo levanta.
  insert into orders (shopify_id, order_number, created_at, financial_status, province, courier, total, cod_amount, tags, raw)
  values (9004, '9004', current_date - 3, 'pending', 'Córdoba', 'urbano', 40000, 40000, 'urbano, despachado, guia-9004', '{}'::jsonb);
  insert into shipments (courier, tracking, order_id, order_ref, province, raw, updated_at)
  select case when o.tags ~* '(^|,|\s)fixy(,|\s|$)' then 'fixy' else 'urbano' end,
         (regexp_match(o.tags, 'guia-([A-Za-z0-9]+)', 'i'))[1],
         o.id, o.order_number, o.province, jsonb_build_object('via', 'tag-backfill'), now() - interval '90 days'
  from orders o
  where o.tags ~* 'guia-' and o.cancelled_at is null and o.tags not ilike '%cuotas_3%'
    and not exists (select 1 from shipments s where s.order_id = o.id)
  on conflict (courier, tracking) do nothing;
  assert (select s.tracking = '9004' and s.courier = 'urbano'
            from shipments s join orders o on o.id = s.order_id where o.shopify_id = 9004),
    '013 backfill: crea la guía de un pedido tageado que estaba sin shipment';

  raise notice '013 tag-dispatch: todos los checks OK';
end $t$;

rollback;

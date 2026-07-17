-- override_check.sql (024): corrección manual de producto durable (sobrevive al re-sync).
begin;

do $t$
declare pid_pureza int; pid_nat int; oid bigint;
begin
  select id into pid_pureza from products where name = 'Pureza';
  select id into pid_nat    from products where name = 'Natures';

  -- Orden cuyo título NO matchea ningún keyword → order_items.product_id null → sin clasificar.
  oid := upsert_order(jsonb_build_object('id', 88010001, 'name', '#88010001',
    'created_at', (current_date-2)::text||'T12:00:00-03:00', 'financial_status','pending',
    'tags','cod-form', 'total_price','40000',
    'shipping_address','{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items','[{"title":"Producto Raro XYZ","quantity":1,"price":"40000"}]'::jsonb));
  assert order_primary_product(oid) is null, '024: sin override → producto null (cae en sin-clasificar)';

  -- Server action: setear override + aplicarlo a los items existentes.
  update orders set product_override = pid_pureza where id = oid;
  update order_items set product_id = pid_pureza where order_id = oid and product_id is null;
  assert order_primary_product(oid) = pid_pureza, '024: con override → producto = Pureza';

  -- Durabilidad: un re-sync de Shopify borra+reinserta los items; el trigger re-aplica el override.
  perform upsert_order(jsonb_build_object('id', 88010001, 'name', '#88010001',
    'created_at', (current_date-2)::text||'T12:00:00-03:00', 'financial_status','pending',
    'tags','cod-form', 'total_price','40000',
    'shipping_address','{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items','[{"title":"Producto Raro XYZ","quantity":1,"price":"40000"}]'::jsonb));
  assert order_primary_product(oid) = pid_pureza, '024: tras re-sync el override sobrevive (trigger)';
  assert (select product_id from order_items where order_id = oid limit 1) = pid_pureza,
    '024: item.product_id = override tras re-sync → COGS correcto, no 0';

  -- Una orden que SÍ matchea no la toca el trigger (no tiene override).
  perform upsert_order(jsonb_build_object('id', 88010002, 'name', '#88010002',
    'created_at', (current_date-2)::text||'T12:00:00-03:00', 'financial_status','pending',
    'tags','cod-form', 'total_price','30000',
    'shipping_address','{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items','[{"title":"Natures Sunrise","quantity":1,"price":"30000"}]'::jsonb));
  assert order_primary_product((select id from orders where shopify_id = 88010002)) = pid_nat,
    '024: orden que ya matchea no se ve afectada';

  raise notice '024 override: OK';
end $t$;

rollback;

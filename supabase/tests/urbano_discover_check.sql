-- urbano_discover_check.sql (029): urbano_sin_guia devuelve SOLO órdenes urbano activas, recientes y sin
-- guía (los shopify_id que el descubrimiento debe consultar contra la masiva).
begin;

do $t$
declare
  reciente timestamptz := now() - interval '2 days';
  vieja    timestamptz := now() - interval '40 days';
  cba jsonb := '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb;
  caba jsonb := '{"province":"Ciudad Autónoma de Buenos Aires","city":"CABA","zip":"1425"}'::jsonb;
  li jsonb := '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb;
begin
  -- A: urbano reciente sin guía → DEBE aparecer
  perform upsert_order(jsonb_build_object('id', 3301, 'name', '#3301', 'created_at', reciente::text,
    'financial_status', 'pending', 'tags', '', 'total_price', '40000', 'shipping_address', cba, 'line_items', li));
  -- B: urbano reciente CON guía → no aparece
  perform upsert_order(jsonb_build_object('id', 3302, 'name', '#3302', 'created_at', reciente::text,
    'financial_status', 'pending', 'tags', '', 'total_price', '40000', 'shipping_address', cba, 'line_items', li));
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','urbano','tracking','3302','order_ref','3302','status_raw','MA','occurred_at', reciente::text)));
  -- C: urbano VIEJA (fuera de ventana) sin guía → no aparece
  perform upsert_order(jsonb_build_object('id', 3303, 'name', '#3303', 'created_at', vieja::text,
    'financial_status', 'pending', 'tags', '', 'total_price', '40000', 'shipping_address', cba, 'line_items', li));
  -- D: urbano reciente CANCELADA sin guía → no aparece
  perform upsert_order(jsonb_build_object('id', 3304, 'name', '#3304', 'created_at', reciente::text,
    'cancelled_at', (now())::text, 'financial_status', 'pending', 'tags', '', 'total_price', '40000',
    'shipping_address', cba, 'line_items', li));
  -- E: FIXY reciente sin guía → no aparece (no es urbano)
  perform upsert_order(jsonb_build_object('id', 3305, 'name', '#3305', 'created_at', reciente::text,
    'financial_status', 'pending', 'tags', '', 'total_price', '40000', 'shipping_address', caba, 'line_items', li));
  -- F: urbano reciente sin guía pero tag Standby (nunca despachada) → no aparece
  perform upsert_order(jsonb_build_object('id', 3306, 'name', '#3306', 'created_at', reciente::text,
    'financial_status', 'pending', 'tags', 'Standby', 'total_price', '40000', 'shipping_address', cba, 'line_items', li));

  assert exists (select 1 from urbano_sin_guia(now() - interval '21 days', 100) where shopify_id = 3301),
    '029: A (urbano reciente sin guía) aparece';
  assert not exists (select 1 from urbano_sin_guia(now() - interval '21 days', 100) where shopify_id = 3302),
    '029: B (con guía) NO aparece';
  assert not exists (select 1 from urbano_sin_guia(now() - interval '21 days', 100) where shopify_id = 3303),
    '029: C (fuera de ventana) NO aparece';
  assert not exists (select 1 from urbano_sin_guia(now() - interval '21 days', 100) where shopify_id = 3304),
    '029: D (cancelada) NO aparece';
  assert (select courier from orders where shopify_id = 3305) = 'fixy', '029: E ruteó a fixy';
  assert not exists (select 1 from urbano_sin_guia(now() - interval '21 days', 100) where shopify_id = 3305),
    '029: E (fixy) NO aparece';
  assert not exists (select 1 from urbano_sin_guia(now() - interval '21 days', 100) where shopify_id = 3306),
    '029: F (tag Standby) NO aparece';
  -- respeta el límite
  assert (select count(*) from urbano_sin_guia(now() - interval '21 days', 0)) = 0, '029: p_limit 0 → vacío';

  -- cursor de rotación: A ya intentada (discovery_at seteado) cae al fondo; G nunca intentada va antes
  update orders set urbano_discovery_at = now() where shopify_id = 3301;
  perform upsert_order(jsonb_build_object('id', 3307, 'name', '#3307', 'created_at', reciente::text,
    'financial_status', 'pending', 'tags', '', 'total_price', '40000', 'shipping_address', cba, 'line_items', li));
  assert (
    (select ordinality from urbano_sin_guia(now() - interval '21 days', 1000) with ordinality where shopify_id = 3307)
    < (select ordinality from urbano_sin_guia(now() - interval '21 days', 1000) with ordinality where shopify_id = 3301)
  ), '029: cursor — la nunca intentada (3307) sale antes que la ya intentada (3301)';

  raise notice '029 urbano_sin_guia (descubrimiento + cursor): OK';
end $t$;

rollback;

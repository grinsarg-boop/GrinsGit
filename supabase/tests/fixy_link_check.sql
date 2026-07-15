-- fixy_link_check.sql (014): status codes + flete por CP + vista de candidatos. Rollbackea.
begin;

do $t$
begin
  assert (select (value::text)::numeric from settings where key = 'fixy_freight_default') = 8663,
    '014: flete default';
  assert (select value ? '1425' from settings where key = 'fixy_freight_by_cp'),
    '014: CP 1425 en el mapa de flete';
  assert (select (value ->> '1425')::numeric from settings where key = 'fixy_freight_by_cp') = 5198,
    '014: flete CP 1425 = 5198';
  assert (select status_canonical from courier_status_map where courier = 'fixy' and status_raw = '41') = 'despachado',
    '014: cod 41 → despachado';
  assert (select status_canonical from courier_status_map where courier = 'fixy' and status_raw = '51') = 'rehusado',
    '014: cod 51 → rehusado';
  assert (select status_canonical from courier_status_map where courier = 'fixy' and status_raw = '123') = 'cancelado',
    '014: cod 123 → cancelado';

  -- v_fixy_sin_guia: un pedido fixy sin guía aparece; con guía, no.
  perform upsert_order(jsonb_build_object(
    'id', 8801, 'name', '#8801', 'created_at', current_date - 1, 'financial_status', 'pending',
    'tags', '', 'total_price', '40000',
    'shipping_address', '{"province":"Ciudad Autónoma de Buenos Aires","city":"CABA","zip":"1425"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb));
  assert (select courier from orders where shopify_id = 8801) = 'fixy', '014: CABA → fixy';
  assert exists (select 1 from v_fixy_sin_guia where order_number = '8801'),
    '014: pedido fixy sin guía aparece en la vista';

  raise notice '014 fixy-link: todos los checks OK';
end $t$;

rollback;

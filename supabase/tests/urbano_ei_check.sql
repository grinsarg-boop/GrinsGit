-- urbano_ei_check.sql (055): EI de Urbano es ENTREGADO, no "en reparto".
-- El código se llama "EI" pero la descripción del WS es "El chofer informo la entrega de su envio".
-- Si alguien vuelve a mapearlo por el nombre, esto revienta.
begin;

do $t$
declare oid bigint; sid bigint;
begin
  assert map_status('urbano', 'EI') = 'entregado', '055: EI de Urbano tiene que ser entregado';
  assert map_status('urbano', 'LD') = 'en_reparto', '055: LD sigue siendo en reparto (ese sí va en camino)';

  oid := upsert_order(jsonb_build_object('id', 88055001, 'name', '#88055001',
    'created_at', (current_date-6)::text||'T12:00:00-03:00', 'financial_status','pending',
    'tags','cod-form', 'total_price','49990',
    'shipping_address','{"province":"Tucumán","city":"San Miguel","zip":"4000"}'::jsonb,
    'line_items','[{"title":"Pureza x1","quantity":1,"price":"49990"}]'::jsonb));

  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','urbano','tracking','88055001','order_ref','88055001',
      'status_raw','CICLO - Despacho','occurred_at',(current_date-5)::text||'T12:00:00Z','raw','{}'::jsonb),
    jsonb_build_object('courier','urbano','tracking','88055001','order_ref','88055001',
      'status_raw','EI','occurred_at',(current_date-2)::text||'T12:00:00Z',
      'raw', jsonb_build_object('descripcion','El chofer informo la entrega de su envio'))));

  select id into sid from shipments where courier='urbano' and tracking='88055001';
  assert (select status_canonical from shipments where id = sid) = 'entregado',
    '055: una guía cuyo último estado es EI queda entregada';
  assert (select resolved_at from shipments where id = sid) is not null,
    '055: EI cierra la guía (resolved_at) — si no, la cohorte nunca madura';
  assert not exists (select 1 from trabados_list() where tracking = '88055001'),
    '055: una guía EI no puede aparecer en /trabados (está entregada, no trabada)';
end $t$;

rollback;

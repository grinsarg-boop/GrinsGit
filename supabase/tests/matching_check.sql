-- matching_check.sql — cubre 003: rama shopify_id (Urbano) + regresión order_number (Fixy)
-- + evento sintético de despacho (ciclo → despachado, dispatched_at) + facturación por shopify_id.
-- Corre sobre 001+002+003, rollbackea. Complementa pnl_check.sql (que valida la regresión de P&L).

begin;

do $test$
declare
  d date := current_date - 20;
  v_ship shipments%rowtype;
begin
  ---------------------------------------------------------------- pedidos
  -- Urbano: id Shopify de 13 dígitos (cli_codigo). name #5001 → order_number '5001'.
  perform upsert_order(jsonb_build_object(
    'id', 6854687555824, 'name', '#5001', 'created_at', d - 1, 'financial_status', 'pending',
    'tags', '', 'total_price', '49990',
    'shipping_address', '{"province":"Córdoba","city":"Río Cuarto","zip":"5800","phone":"351-1","name":"Cliente URB"}'::jsonb,
    'line_items', '[{"title":"Natures","variant_title":null,"quantity":1,"price":"49990"}]'::jsonb));
  -- Fixy: pedido CABA, matchea por Remito = order_number '5002'
  perform upsert_order(jsonb_build_object(
    'id', 6870864625904, 'name', '#5002', 'created_at', d - 1, 'financial_status', 'pending',
    'tags', '', 'total_price', '40000',
    'shipping_address', '{"province":"Ciudad Autónoma de Buenos Aires","city":"CABA","zip":"1425","phone":"11-9","name":"Cliente FIX"}'::jsonb,
    'line_items', '[{"title":"Natures","variant_title":null,"quantity":1,"price":"40000"}]'::jsonb));

  ---------------------------------------- Urbano: eventos como los emite urbano.ts (Opción A)
  -- tracking = shopify_id, order_ref = shopify_id, gui_numero en raw, 2 eventos: ciclo + estado.
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','urbano','tracking','6854687555824','order_ref','6854687555824',
      'status_raw','CICLO - Despacho','occurred_at', d::text || 'T09:00:00Z',
      'raw', jsonb_build_object('gui_numero','231541972')),
    jsonb_build_object('courier','urbano','tracking','6854687555824','order_ref','6854687555824',
      'status_raw','RC - Conformes y devoluciones rendidos al remitente',
      'occurred_at',(d+18)::text || 'T14:00:00Z',
      'raw', jsonb_build_object('gui_numero','231541972'))));

  select * into v_ship from shipments where courier='urbano' and tracking='6854687555824';
  assert v_ship.order_id is not null, '003: Urbano linkea por shopify_id (order_ref 13 díg = shopify_id)';
  assert v_ship.order_id = (select id from orders where shopify_id=6854687555824), '003: linkeó al pedido correcto';
  -- "RC - Conformes y devoluciones rendidos al remitente": keyword DEVOLUCION (más largo) gana
  -- sobre REMITENTE → en_devolucion. Resuelto y P&L-equivalente a devuelto; el dueño afina el
  -- exact 'RC - ...' → devuelto en /config si quiere distinguir terminal.
  assert v_ship.status_canonical = 'en_devolucion', '003: RC...remitente → en_devolucion';
  assert v_ship.dispatched_at = d, '003: dispatched_at = ciclo (no la fecha del último estado)';
  assert v_ship.province = 'Córdoba', '003: provincia heredada del pedido';
  assert v_ship.raw->>'gui_numero' = '231541972', '003: gui_numero real guardado en raw';
  assert not exists (select 1 from v_estados_sin_mapear
    where courier='urbano' and status_raw='CICLO - Despacho'), '003: el evento sintético NO ensucia sin_mapear';

  ------------------------------------------------- Regresión + 004: Fixy por order_number, códigos reales
  -- POD-ENTREGADA → entregado; motivo en raw; order_ref = Remito = order_number.
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','fixy','tracking','FX5002','order_ref','5002',
      'status_raw','POD-ENTREGADA','occurred_at',(d+2)::text || 'T14:00:00Z','importe',7420,
      'raw', jsonb_build_object('motivo', null::text))));
  select * into v_ship from shipments where courier='fixy' and tracking='FX5002';
  assert v_ship.order_id = (select id from orders where shopify_id=6870864625904),
         'regresión: Fixy linkea por order_number (#NNNN) igual que en 002';
  assert v_ship.status_canonical = 'entregado', '004: POD-ENTREGADA → entregado';
  assert (select order_ref from shipments where tracking='FX5002') = '5002',
         'guard: order_ref corto de Fixy NO dispara la rama shopify_id (≥10 díg)';

  ------------------- 004 + alerta flete: CSYDV (devuelto) cobra flete → suma al flete confirmado
  perform upsert_order(jsonb_build_object(
    'id', 6870864625905, 'name', '#5003', 'created_at', d - 1, 'financial_status', 'pending',
    'tags', '', 'total_price', '49990',
    'shipping_address', '{"province":"Ciudad Autónoma de Buenos Aires","city":"CABA","zip":"1407","phone":"11-8","name":"Cliente FIX2"}'::jsonb,
    'line_items', '[{"title":"Natures","variant_title":null,"quantity":1,"price":"49990"}]'::jsonb));
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','fixy','tracking','FX5003','order_ref','5003',
      'status_raw','CSYDV-COBRO DE SERVICIO Y DEVOLUCION DE MERCADERIA A LA EMPRESA',
      'occurred_at',(d+3)::text || 'T14:00:00Z','importe',5198,
      'raw', jsonb_build_object('motivo','PLAZO DE REPROGRAMACION VENCIDO'))));
  select * into v_ship from shipments where courier='fixy' and tracking='FX5003';
  assert v_ship.status_canonical = 'devuelto', '004: CSYDV → devuelto';
  assert v_ship.freight_cost = 5198, '004: Fixy importe = flete tal cual, también en devueltas';
  assert v_ship.raw->>'motivo' = 'PLAZO DE REPROGRAMACION VENCIDO', 'motivo preservado en raw';

  -- Flete confirmado del cohorte Fixy suma AMBAS (entregada 7420 + devuelta 5198), no solo la entregada.
  perform recompute_daily_pnl(d, d + 3);
  assert (select flete from daily_pnl where dispatch_date = d + 2 and courier='fixy'
            and product_id=(select id from products where name='Natures')) = 7420,
         'flete: entregada del d+2';
  assert (select flete from daily_pnl where dispatch_date = d + 3 and courier='fixy'
            and product_id=(select id from products where name='Natures')) = 5198,
         'alerta flete: la DEVUELTA (CSYDV) suma su importe al flete confirmado del cohorte';

  ---------------------------------------------- Facturación Urbano por shopify_id
  perform import_urbano_freight(jsonb_build_array(
    jsonb_build_object('tracking','6854687555824','tarifa', 7557)));
  select * into v_ship from shipments where courier='urbano' and tracking='6854687555824';
  assert not v_ship.freight_is_estimated and round(v_ship.freight_cost,2) = round(7557*1.29,2),
         '003: facturación matchea por shopify_id y pisa el flete (7557×1.29)';

  raise notice 'matching_check: OK';
end $test$;

rollback;

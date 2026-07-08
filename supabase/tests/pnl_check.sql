-- pnl_check.sql — R10: 10 guías armadas a mano, el P&L cuadra al peso.
-- También cubre los AC de R2 (upsert_order), R3 (estados), R4 (matching) y R9 (flete).
-- Correr sobre una base con 001 + 002 aplicadas y SIN datos (usa current_date−15 y rollbackea).
--
-- Escenario (despacho D = hoy−15, todo producto Natures):
--   urbano (Córdoba):  U1 entregado cod 40k tarifa 10k · U2 entregado total 50k seña 10k
--                      "Natures x2" tarifa 8k · U3 rehusado cod 40k sin tarifa ·
--                      U4 incidencia (estado desconocido) cod 45k · U5 devuelto cod 40k ·
--                      U6 siniestro cod 40k
--   fixy (CABA):       F1/F2 entregado cod 40k importe 5k · F3 rehusado cod 40k importe 5k ·
--                      F4 en reparto cod 40k importe 5k
--   ads: $29.000 Natures el día D → urbano 6 / fixy 4×1.4=5.6 → 15.000 / 14.000
--
-- Cuentas (settings seed: comisión 5,2%/1%, mult 1,29, mp_fee 10%, costo Natures p1 = 5.000):
--   estimado urbano = avg(10000,8000)×1.29 = 11.610 → flete U = 12900+10320+4×11610 = 69.660
--   urbano: rev = 80.000+9.000 = 89.000 · com = 4.160 · costo = 5k+10k(sin.)+5k = 20.000
--           profit = 89.000−69.660−4.160−20.000−15.000 = −19.820
--   fixy:   rev = 80.000 · com = 800 · costo = 10.000 · flete = 20.000
--           profit = 80.000−20.000−800−10.000−14.000 = 35.200
--   tras importar facturación U3=9.500: estimado pasa a avg(10k,8k,9.5k)×1.29 = 11.825
--           flete U = 12900+10320+12255+3×11825 = 70.950 · profit = −21.110

begin;

-- Escenario aislado: limpia el seed de costos (006 lo puebla) y carga sólo el fixture del test.
-- Rollbackea al final → no afecta nada. Este test valida las FÓRMULAS del P&L con un costo
-- controlado, no los valores de 006 (eso lo valida la reconciliación con datos reales).
delete from product_costs;
-- costo real del pack 1 (el pack 2 NO se carga: debe extrapolarse — §4.4)
insert into product_costs (product_id, pack, unit_cost, is_estimated)
select id, 1, 5000, false from products where name = 'Natures';

do $test$
declare
  d date := current_date - 15;
  r daily_pnl%rowtype;
  v_id bigint;
begin
  ------------------------------------------------------------------ pedidos
  -- U1..U6 (Córdoba → urbano), F1..F4 (CABA → fixy)
  perform upsert_order(jsonb_build_object(
    'id', 1001, 'name', '#1001', 'created_at', d - 1, 'financial_status', 'pending',
    'tags', '', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000","phone":"351-1","name":"Cliente U1"}'::jsonb,
    'line_items', '[{"title":"Natures","variant_title":null,"quantity":1,"price":"40000"}]'::jsonb));
  perform upsert_order(jsonb_build_object(
    'id', 1002, 'name', '#1002', 'created_at', d - 1, 'financial_status', 'partially_paid',
    'tags', 'sena:10000', 'total_price', '50000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000","phone":"351-2","name":"Cliente U2"}'::jsonb,
    -- pack 2 = quantity 2 (006: el pack es el quantity, no el título). El costo se extrapola (§4.4).
    'line_items', '[{"title":"Natures x2","variant_title":null,"quantity":2,"price":"50000"}]'::jsonb));
  perform upsert_order(jsonb_build_object(
    'id', 1003, 'name', '#1003', 'created_at', d - 1, 'financial_status', 'pending',
    'tags', '', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000","phone":"351-3","name":"Cliente U3"}'::jsonb,
    'line_items', '[{"title":"Natures","variant_title":null,"quantity":1,"price":"40000"}]'::jsonb));
  perform upsert_order(jsonb_build_object(
    'id', 1004, 'name', '#1004', 'created_at', d - 1, 'financial_status', 'pending',
    'tags', '', 'total_price', '45000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000","phone":"351-4","name":"Cliente U4"}'::jsonb,
    'line_items', '[{"title":"Natures","variant_title":null,"quantity":1,"price":"45000"}]'::jsonb));
  perform upsert_order(jsonb_build_object(
    'id', 1005, 'name', '#1005', 'created_at', d - 1, 'financial_status', 'pending',
    'tags', '', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000","phone":"351-5","name":"Cliente U5"}'::jsonb,
    'line_items', '[{"title":"Natures","variant_title":null,"quantity":1,"price":"40000"}]'::jsonb));
  perform upsert_order(jsonb_build_object(
    'id', 1006, 'name', '#1006', 'created_at', d - 1, 'financial_status', 'pending',
    'tags', '', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000","phone":"351-6","name":"Cliente U6"}'::jsonb,
    'line_items', '[{"title":"Natures","variant_title":null,"quantity":1,"price":"40000"}]'::jsonb));
  for v_id in 1007..1010 loop
    perform upsert_order(jsonb_build_object(
      'id', v_id, 'name', '#' || v_id, 'created_at', d - 1, 'financial_status', 'pending',
      'tags', '', 'total_price', '40000',
      'shipping_address', '{"province":"Ciudad Autónoma de Buenos Aires","city":"CABA","zip":"1425","phone":"11-1","name":"Cliente F"}'::jsonb,
      'line_items', '[{"title":"Natures","variant_title":null,"quantity":1,"price":"40000"}]'::jsonb));
  end loop;

  ---------------------------------------------------- R2: idempotencia y match
  perform upsert_order((select raw from orders where shopify_id = 1001));
  assert (select count(*) from orders where shopify_id = 1001) = 1, 'R2: mismo payload 2x debe dar 1 fila';
  assert (select count(*) from order_items oi join orders o on o.id = oi.order_id
           where o.shopify_id = 1001) = 1, 'R2: items no se duplican';
  assert (select courier from orders where shopify_id = 1007) = 'fixy', 'R2: CABA sin fulfillment → fixy';
  assert (select courier from orders where shopify_id = 1001) = 'urbano', 'R2: Córdoba → urbano';
  assert (select (oi.product_id = (select id from products where name = 'Natures') and oi.pack = 2)
            from order_items oi join orders o on o.id = oi.order_id where o.shopify_id = 1002),
         'R2: "Natures x2" → Natures pack 2';
  assert (select cod_amount = 40000 and deposit_amount = 10000 from orders where shopify_id = 1002),
         'R2/§4.3: sena:10000 → deposit 10000, cod 40000';

  ----------------- R9: fallback de flete SIN ningún promedio disponible
  -- U0 (despacho d−1, fuera del rango del P&L de abajo) llega antes de que exista
  -- tarifa real alguna → urbano_freight_fallback = 10200 como COSTO FINAL, sin ×1.29
  -- (el 10200 ya incluye impuestos).
  perform upsert_order(jsonb_build_object(
    'id', 1000, 'name', '#1000', 'created_at', d - 2, 'financial_status', 'pending',
    'tags', '', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000","phone":"351-0","name":"Cliente U0"}'::jsonb,
    'line_items', '[{"title":"Natures","variant_title":null,"quantity":1,"price":"40000"}]'::jsonb));
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','urbano','tracking','U0','order_ref','1000','status_raw','MA',
                       'occurred_at',(d-1)::text || 'T08:00:00Z')));
  assert (select freight_is_estimated and round(freight_cost, 2) = 10200.00
            from shipments where tracking = 'U0'),
         'R9: sin promedio rolling → fallback 10200 directo (costo final, no tarifa ×1.29)';

  ------------------------------------------------------------------ eventos
  perform upsert_shipment_events(jsonb_build_array(
    -- U1: despacho + entrega con tarifa real
    jsonb_build_object('courier','urbano','tracking','U1','order_ref','1001','status_raw','MA','occurred_at', d::text || 'T08:00:00Z'),
    jsonb_build_object('courier','urbano','tracking','U1','order_ref','1001','status_raw','ENTREGADO EN DOMICILIO','occurred_at',(d+2)::text || 'T14:00:00Z','tarifa',10000),
    -- U2: entregado, tarifa real
    jsonb_build_object('courier','urbano','tracking','U2','order_ref','1002','status_raw','MA','occurred_at', d::text || 'T08:00:00Z'),
    jsonb_build_object('courier','urbano','tracking','U2','order_ref','1002','status_raw','ENTREGADO EN DOMICILIO','occurred_at',(d+3)::text || 'T14:00:00Z','tarifa',8000),
    -- U3: rehusado, sin tarifa (flete estimado)
    jsonb_build_object('courier','urbano','tracking','U3','order_ref','1003','status_raw','MA','occurred_at', d::text || 'T08:00:00Z'),
    jsonb_build_object('courier','urbano','tracking','U3','order_ref','1003','status_raw','REHUSA RECIBIR','occurred_at',(d+2)::text || 'T14:00:00Z'),
    -- U4: en tránsito y después un estado desconocido (R3)
    jsonb_build_object('courier','urbano','tracking','U4','order_ref','1004','status_raw','MA','occurred_at', d::text || 'T08:00:00Z'),
    jsonb_build_object('courier','urbano','tracking','U4','order_ref','1004','status_raw','CODIGO_RARO_XYZ','occurred_at',(d+2)::text || 'T14:00:00Z'),
    -- U5: devuelto
    jsonb_build_object('courier','urbano','tracking','U5','order_ref','1005','status_raw','MA','occurred_at', d::text || 'T08:00:00Z'),
    jsonb_build_object('courier','urbano','tracking','U5','order_ref','1005','status_raw','DEVUELTO AL REMITENTE','occurred_at',(d+6)::text || 'T14:00:00Z'),
    -- U6: siniestro
    jsonb_build_object('courier','urbano','tracking','U6','order_ref','1006','status_raw','MA','occurred_at', d::text || 'T08:00:00Z'),
    jsonb_build_object('courier','urbano','tracking','U6','order_ref','1006','status_raw','EXTRAVIADO EN PLANTA','occurred_at',(d+4)::text || 'T14:00:00Z'),
    -- F1..F4
    jsonb_build_object('courier','fixy','tracking','F1','order_ref','1007','status_raw','En reparto','occurred_at', d::text || 'T08:00:00Z'),
    jsonb_build_object('courier','fixy','tracking','F1','order_ref','1007','status_raw','Entregado','occurred_at',(d+1)::text || 'T14:00:00Z','importe',5000),
    jsonb_build_object('courier','fixy','tracking','F2','order_ref','1008','status_raw','En reparto','occurred_at', d::text || 'T08:00:00Z'),
    jsonb_build_object('courier','fixy','tracking','F2','order_ref','1008','status_raw','Entregado','occurred_at',(d+2)::text || 'T14:00:00Z','importe',5000),
    jsonb_build_object('courier','fixy','tracking','F3','order_ref','1009','status_raw','En reparto','occurred_at', d::text || 'T08:00:00Z'),
    jsonb_build_object('courier','fixy','tracking','F3','order_ref','1009','status_raw','Rehusado','occurred_at',(d+2)::text || 'T14:00:00Z','importe',5000),
    jsonb_build_object('courier','fixy','tracking','F4','order_ref','1010','status_raw','En reparto','occurred_at', d::text || 'T08:00:00Z','importe',5000)
  ));

  --------------------------------------------------------- R3/R4: estados y match
  assert (select count(*) from shipments where order_id is null) = 0,
         'R4: toda guía con order_ref válido queda linkeada en el mismo sync';
  assert (select status_canonical from shipments where tracking = 'U4') = 'incidencia',
         'R3: estado desconocido no rompe → incidencia';
  assert exists (select 1 from v_estados_sin_mapear where courier = 'urbano' and status_raw = 'CODIGO_RARO_XYZ'),
         'R3: estado desconocido visible en v_estados_sin_mapear';
  assert (select resolved_at is not null from shipments where tracking = 'U1'), 'R3: entregado setea resolved_at';
  assert (select resolved_at is null from shipments where tracking = 'U3'), 'R3: rehusado no es terminal';
  assert (select dispatched_at from shipments where tracking = 'U1') = d, 'R3: dispatched_at del primer evento';

  --------------------------------------------------------------- R9: flete
  assert (select freight_is_estimated and round(freight_cost, 2) = 11610.00
            from shipments where tracking = 'U3'),
         'R9: guía sin facturar → estimado por provincia 9000×1.29 = 11610, flageado';
  assert (select not freight_is_estimated and freight_cost = 12900 from shipments where tracking = 'U1'),
         'R9: tarifa real 10000×1.29 = 12900';
  assert (select freight_cost = 5000 from shipments where tracking = 'F1'),
         '§4.1: fixy importe tal cual, sin gross-up';

  ------------------------------------------------------------------ pauta
  perform upsert_ad_spend(jsonb_build_array(jsonb_build_object(
    'date', d, 'ad_id', 'ad1', 'ad_name', 'Natures - Video hook 1',
    'campaign_name', 'NATURES ARG', 'spend', 29000, 'purchases', 10)));
  assert (select product_id = (select id from products where name = 'Natures') from ad_spend where ad_id = 'ad1'),
         'R6: producto asignado por keyword';

  ------------------------------------------------------------------ R10: P&L
  perform recompute_daily_pnl(d, d);

  assert (select unit_cost = 10000 and is_estimated from product_costs
           where product_id = (select id from products where name = 'Natures') and pack = 2),
         '§4.4: pack 2 extrapolado del pack 1 × unidades, estimado';

  select * into strict r from daily_pnl
   where dispatch_date = d and courier = 'urbano'
     and product_id = (select id from products where name = 'Natures');
  assert r.despachadas = 6 and r.entregadas = 2 and r.rehusadas = 1 and r.en_devolucion = 0
     and r.devueltas = 1 and r.siniestros = 1 and r.en_transito = 1, 'R10 urbano: conteos';
  assert round(r.pct_resuelto, 4) = round(5.0/6, 4), 'R10 urbano: pct_resuelto 5/6';
  assert round(r.tasa_actual, 4) = round(2.0/6, 4), 'R10 urbano: tasa_actual 2/6';
  assert round(r.flete, 2) = 69660.00, 'R10 urbano: flete 69660';
  assert round(r.flete_estimado_pct, 4) = round(46440.0/69660, 4), 'R10 urbano: 2/3 del flete estimado';
  assert round(r.senas_netas, 2) = 9000.00, 'R10 urbano: seña 10000×0.9';
  assert round(r.revenue_confirmado, 2) = 89000.00, 'R10 urbano: revenue 80000+9000';
  assert round(r.comisiones, 2) = 4160.00, 'R10 urbano: 5.2% de 80000';
  assert round(r.costo_producto, 2) = 20000.00, 'R10 urbano: 5000+10000+5000 (siniestro pierde costo)';
  assert round(r.ads, 2) = 15000.00, 'R10 urbano: 29000×6/11.6';
  assert round(r.profit_confirmado, 2) = -19820.00, 'R10 urbano: profit −19820';

  select * into strict r from daily_pnl
   where dispatch_date = d and courier = 'fixy'
     and product_id = (select id from products where name = 'Natures');
  assert r.despachadas = 4 and r.entregadas = 2 and r.rehusadas = 1 and r.en_transito = 1, 'R10 fixy: conteos';
  assert round(r.flete, 2) = 20000.00, 'R10 fixy: flete 4×5000';
  assert round(r.revenue_confirmado, 2) = 80000.00, 'R10 fixy: revenue';
  assert round(r.comisiones, 2) = 800.00, 'R10 fixy: 1% de 80000';
  assert round(r.costo_producto, 2) = 10000.00, 'R10 fixy: costo 2×5000';
  assert round(r.ads, 2) = 14000.00, 'R10 fixy: 29000×5.6/11.6';
  assert round(r.profit_confirmado, 2) = 35200.00, 'R10 fixy: profit 35200';

  ------------------------------------- R9: la facturación pisa y recalcula
  perform import_urbano_freight('[{"tracking":"U3","tarifa":9500}]'::jsonb);
  assert (select not freight_is_estimated and round(freight_cost, 2) = 12255.00
            from shipments where tracking = 'U3'), 'R9: facturación pisa el estimado';
  select * into strict r from daily_pnl
   where dispatch_date = d and courier = 'urbano'
     and product_id = (select id from products where name = 'Natures');
  assert round(r.flete, 2) = 70950.00, 'R9: flete recalculado 12900+10320+12255+3×11825';
  assert round(r.flete_estimado_pct, 4) = 0.5, 'R9: 35475/70950 estimado';
  assert round(r.profit_confirmado, 2) = -21110.00, 'R9: profit recalculado tras import';

  --------------------------------- propiedad 3 §4.7: recompute determinista
  create temp table _snap on commit drop as select * from daily_pnl;
  perform recompute_daily_pnl(d, d);
  assert not exists (
    (select dispatch_date, courier, product_id, despachadas, entregadas, rehusadas, en_devolucion,
            devueltas, siniestros, en_transito, pct_resuelto, tasa_actual, tasa_proyectada,
            revenue_confirmado, revenue_estimado, senas_netas, flete, flete_estimado_pct,
            costo_producto, comisiones, ads, profit_confirmado, profit_estimado from daily_pnl
     except
     select dispatch_date, courier, product_id, despachadas, entregadas, rehusadas, en_devolucion,
            devueltas, siniestros, en_transito, pct_resuelto, tasa_actual, tasa_proyectada,
            revenue_confirmado, revenue_estimado, senas_netas, flete, flete_estimado_pct,
            costo_producto, comisiones, ads, profit_confirmado, profit_estimado from _snap)),
    'propiedad 3: recalcular dos veces da idéntico resultado';

  ----------------------- pedido creado DESPUÉS de la guía (link inverso, R4)
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','urbano','tracking','T11','order_ref','1011','status_raw','MA',
                       'occurred_at',(current_date - 40)::text || 'T08:00:00Z')));
  assert (select order_id is null from shipments where tracking = 'T11'), 'pre: T11 huérfana';
  perform upsert_order(jsonb_build_object(
    'id', 1011, 'name', '#1011', 'created_at', current_date - 41, 'financial_status', 'paid',
    'tags', '', 'total_price', '30000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000","phone":"351-9","name":"Cliente T11"}'::jsonb,
    'line_items', '[{"title":"Natures","variant_title":null,"quantity":1,"price":"30000"}]'::jsonb));
  assert (select order_id is not null from shipments where tracking = 'T11'),
         'R4: upsert_order linkea guías huérfanas existentes';
  assert (select cod_amount = 0 and deposit_amount = 30000 from orders where shopify_id = 1011),
         '§4.3: prepago total (paid) → deposit=total, cod=0';

  raise notice 'pnl_check: OK — todos los asserts pasaron';
end $test$;

rollback;

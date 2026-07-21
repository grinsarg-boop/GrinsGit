-- packs_pmin_check — 049: p_min solo filtra buckets, jamás cambia números.
-- Escenario mínimo (despacho D = hoy−15, urbano Córdoba, todo Natures):
--   PK1 pack1 entregado cod 40k tarifa 10k → flete 12.900
--   PK2 pack1 rehusado sin tarifa → estimado avg(10k,9k)×1.29 = 12.255
--   PK3 pack3 entregado cod 60k tarifa 9k → flete 11.610
--   MIX pedido de DOS líneas entregado → excluido del corte por pack
-- Cuentas (comisión urbano 5,2%; costos: pack1 5.000, pack3 12.000):
--   pack1: cod 40.000 · flete 25.155 · com 2.080 · costo 5.000 → bruto 14.845 · neto 7.765
--   pack3: cod 60.000 · flete 11.610 · com 3.120 · costo 12.000 → bruto 48.390 · neto 33.270
-- Con el default (p_min 40) los DOS buckets quedan afuera; con p_min=1 aparecen al peso.

begin;

delete from product_costs;
insert into product_costs (product_id, pack, unit_cost, is_estimated)
select id, 1, 5000, false from products where name = 'Natures';
insert into product_costs (product_id, pack, unit_cost, is_estimated)
select id, 3, 12000, false from products where name = 'Natures';

do $test$
declare
  d date := current_date - 15;
  v_nat int := (select id from products where name = 'Natures');
  r record;
begin
  perform upsert_order(jsonb_build_object(
    'id', 3001, 'name', '#3001', 'created_at', d - 1, 'financial_status', 'pending',
    'tags', '', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000","phone":"351-p1","name":"Pack1 Ent"}'::jsonb,
    'line_items', '[{"title":"Natures","variant_title":null,"quantity":1,"price":"40000"}]'::jsonb));
  perform upsert_order(jsonb_build_object(
    'id', 3002, 'name', '#3002', 'created_at', d - 1, 'financial_status', 'pending',
    'tags', '', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000","phone":"351-p2","name":"Pack1 Reh"}'::jsonb,
    'line_items', '[{"title":"Natures","variant_title":null,"quantity":1,"price":"40000"}]'::jsonb));
  -- pack = quantity (006), el título "x3" no manda
  perform upsert_order(jsonb_build_object(
    'id', 3003, 'name', '#3003', 'created_at', d - 1, 'financial_status', 'pending',
    'tags', '', 'total_price', '60000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000","phone":"351-p3","name":"Pack3 Ent"}'::jsonb,
    'line_items', '[{"title":"Natures x3","variant_title":null,"quantity":3,"price":"60000"}]'::jsonb));
  -- dos líneas → el pack del pedido no está definido → fuera del corte
  perform upsert_order(jsonb_build_object(
    'id', 3004, 'name', '#3004', 'created_at', d - 1, 'financial_status', 'pending',
    'tags', '', 'total_price', '80000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000","phone":"351-p4","name":"Mixto"}'::jsonb,
    'line_items', '[{"title":"Natures","variant_title":null,"quantity":1,"price":"40000"},{"title":"Natures","variant_title":null,"quantity":1,"price":"40000"}]'::jsonb));

  -- las dos tarifas reales entran ANTES que el rehusado sin tarifa → su estimado ya promedia ambas
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','urbano','tracking','PK1','order_ref','3001','status_raw','MA','occurred_at', d::text || 'T08:00:00Z'),
    jsonb_build_object('courier','urbano','tracking','PK1','order_ref','3001','status_raw','ENTREGADO EN DOMICILIO','occurred_at',(d+2)::text || 'T14:00:00Z','tarifa',10000),
    jsonb_build_object('courier','urbano','tracking','PK3','order_ref','3003','status_raw','MA','occurred_at', d::text || 'T08:00:00Z'),
    jsonb_build_object('courier','urbano','tracking','PK3','order_ref','3003','status_raw','ENTREGADO EN DOMICILIO','occurred_at',(d+2)::text || 'T14:00:00Z','tarifa',9000),
    jsonb_build_object('courier','urbano','tracking','PK2','order_ref','3002','status_raw','MA','occurred_at', d::text || 'T08:00:00Z'),
    jsonb_build_object('courier','urbano','tracking','PK2','order_ref','3002','status_raw','REHUSA RECIBIR','occurred_at',(d+2)::text || 'T14:00:00Z'),
    jsonb_build_object('courier','urbano','tracking','MIX','order_ref','3004','status_raw','MA','occurred_at', d::text || 'T08:00:00Z'),
    jsonb_build_object('courier','urbano','tracking','MIX','order_ref','3004','status_raw','ENTREGADO EN DOMICILIO','occurred_at',(d+3)::text || 'T14:00:00Z')
  ));
  assert (select round(freight_cost, 2) = 12900.00 from shipments where tracking = 'PK1'), 'flete PK1 10000×1.29';
  assert (select round(freight_cost, 2) = 12255.00 from shipments where tracking = 'PK2'), 'flete PK2 estimado 9500×1.29';

  -- default = umbral 40 → ningún bucket llega
  assert (select count(*) from analisis_packs(d, d)) = 0, 'default: buckets < 40 guías ocultos';
  -- p_min explícito 40 == default (misma llamada que hace /analisis hoy)
  assert not exists (
    select * from analisis_packs(d, d) except select * from analisis_packs(d, d, null, null, 40)
  ), 'p_min=40 debe ser idéntico al default';

  -- p_min=1: aparecen los dos buckets, el pedido de dos líneas queda afuera
  assert (select count(*) from analisis_packs(d, d, null, null, 1)) = 2, 'p_min=1: 2 buckets (mixto excluido)';
  assert (select count(*) from analisis_packs(d, d, null, (select id from products where name = 'Pureza'), 1)) = 0,
         'p_producto de otro producto → vacío';

  select * into strict r from analisis_packs(d, d, null, v_nat, 1) where pack = 1;
  assert r.guias = 2 and r.entregadas = 1 and r.devueltas = 1, 'pack1: conteos';
  assert round(r.cod_cobrado, 2) = 40000.00, 'pack1: cod cobrado';
  assert round(r.flete, 2) = 25155.00, 'pack1: flete 12900+12255';
  assert round(r.comisiones, 2) = 2080.00, 'pack1: comisión 5.2% de 40000';
  assert round(r.costo_producto, 2) = 5000.00, 'pack1: costo solo de la entregada';
  assert round(r.margen_bruto, 2) = 14845.00, 'pack1: bruto 40000−25155';
  assert round(r.margen_neto, 2) = 7765.00, 'pack1: neto 14845−2080−5000';

  select * into strict r from analisis_packs(d, d, null, v_nat, 1) where pack = 3;
  assert r.guias = 1 and r.entregadas = 1 and r.devueltas = 0, 'pack3: conteos';
  assert round(r.flete, 2) = 11610.00, 'pack3: flete 9000×1.29';
  assert round(r.margen_bruto, 2) = 48390.00, 'pack3: bruto 60000−11610';
  assert round(r.margen_neto, 2) = 33270.00, 'pack3: neto 48390−3120−12000';

  raise notice 'packs_pmin_check: OK — todos los asserts pasaron';
end $test$;

rollback;

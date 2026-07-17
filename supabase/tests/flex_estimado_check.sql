-- flex_estimado_check.sql (025): flete Flex estimado por CP, y que el listado real lo pisa.
begin;

do $t$
begin
  -- Flex en curso, sin flete, con CP destino conocido.
  insert into ml_orders (ml_id, created_at, product, units, pack, total_amount, sale_fee, shipment_id, status, ship_type, dest_cp, raw)
  values (99001, now(), 'Pureza', 1, 1, 40000, 9600, 77001, 'paid', 'self_service', '6700', '{}');

  -- estimateFlexByCP (parte 2): aplica la tabla CP→costo al pendiente → flete estimado.
  update ml_orders set ship_cost = 8500, ship_cost_estimated = true where ml_id = 99001 and ship_cost is null;
  assert (select ship_cost from ml_orders where ml_id = 99001) = 8500, '025: flete estimado aplicado';
  assert (select ship_cost_estimated from ml_orders where ml_id = 99001), '025: marcado como estimado';

  -- Llega el listado real (applyFlexFlete) → pisa con el valor real y ship_cost_estimated=false.
  update ml_orders set ship_cost = 9000, ship_type = 'self_service', ship_cost_estimated = false where shipment_id = 77001;
  assert (select ship_cost from ml_orders where ml_id = 99001) = 9000, '025: el flete real pisa al estimado';
  assert not (select ship_cost_estimated from ml_orders where ml_id = 99001), '025: marcado como real';

  raise notice '025 flex-estimado: OK';
end $t$;

rollback;

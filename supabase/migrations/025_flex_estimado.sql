-- 025 — Estimación del flete Flex por CP para los pedidos EN CURSO.
-- La logística pasa el listado real 1 vez/semana; entre listados, los envíos Flex (self_service) nuevos
-- quedan con ship_cost null (flete $0, infla el profit). Con la tabla CP→costo (settings.flex_freight_by_cp,
-- que arma el import de DarLogistica) estimamos su flete por el CP destino del shipment, marcado como
-- estimado. Cuando llega el listado real, applyFlexFlete lo pisa con el valor real (ship_cost_estimated=false).
alter table ml_orders add column if not exists dest_cp text;                              -- CP destino (receiver_address.zip_code)
alter table ml_orders add column if not exists ship_cost_estimated boolean not null default false; -- flete estimado por CP (no de un listado)

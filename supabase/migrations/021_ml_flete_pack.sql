-- 021 — ML Fase 1.5: datos para el flete y el COGS exactos (todavía sin tocar el P&L; eso es 022).
-- Dos gaps que la 020 dejó abiertos:
--   · pack: el tamaño del listado ("3 Gotero"→3) vive en el TÍTULO, no en quantity (siempre 1). Sin él
--     el COGS por pack (product_costs(product_id, pack)) no se puede calcular.
--   · flete del vendedor: no viene en /orders. Normal ME → se enriquece del shipment (list_cost − lo que
--     pagó el comprador) a ship_cost. Flex (self_service) → lo cobra el repartidor y llega por xlsx
--     (liquidación de Santiago), que se stagea en ml_flex_flete y se copia a ship_cost por shipment_id.

alter table ml_orders add column if not exists pack int not null default 1;   -- unidades por venta (del título)
alter table ml_orders add column if not exists shipment_id bigint;            -- raw.shipping.id, join del flete
create index if not exists ml_orders_shipment_idx on ml_orders (shipment_id);

-- Staging de la liquidación Flex (xlsx de Santiago). shipment_id = "CODIGO DE VENTA"; price = "PRECIO".
create table if not exists ml_flex_flete (
  shipment_id bigint primary key,
  price       numeric not null,
  fecha       date,
  localidad   text,
  imported_at timestamptz not null default now()
);

alter table ml_flex_flete enable row level security;
drop policy if exists ml_flex_flete_read on ml_flex_flete;
create policy ml_flex_flete_read on ml_flex_flete for select to authenticated using (true);

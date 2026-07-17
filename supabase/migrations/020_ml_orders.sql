-- 020 — MercadoLibre: aterrizaje de órdenes (Fase 1, sin tocar el P&L todavía).
-- Ventas directas de ML (seller 262382468, cuenta del hermano) que Shopify NO ve — hoy sólo se ven
-- de refilón por el lector de etiquetas (/picking). Este primer paso LANDA las órdenes crudas + el
-- mapeo de producto; el canal 'ml' en daily_pnl (comisión sale_fee + flete) es la fase 2.
-- Producto como TEXT (no FK a products): Revival Oil se vende SÓLO por ML y no está en `products`.
create table if not exists ml_orders (
  ml_id        bigint primary key,               -- order id de ML
  created_at   timestamptz not null,             -- order.date_created
  product      text,                             -- matchProduct(títulos); null si no matchea
  units        int not null default 0,           -- Σ order_items[].quantity
  total_amount numeric not null default 0,        -- lo que paga el comprador
  sale_fee     numeric not null default 0,        -- Σ order_items[].sale_fee = comisión ML
  ship_type    text,                             -- logistic_type (self_service/xd/fulfillment)
  ship_cost    numeric,                          -- costo de envío (enrich shipment = fase 2)
  province     text,                             -- idem: vive en el shipment
  status       text not null,                    -- order.status (paid/cancelled/...)
  raw          jsonb not null,                   -- order completa, para no perder nada
  synced_at    timestamptz not null default now()
);
create index if not exists ml_orders_created_idx on ml_orders (created_at);

alter table ml_orders enable row level security;
drop policy if exists ml_orders_read on ml_orders;
create policy ml_orders_read on ml_orders for select to authenticated using (true);

-- El refresh_token de ML rota (single-use) → se persiste en settings.ml_token en cada corrida.
-- El seed inicial (el que generó el hermano) entra por env ML_REFRESH_TOKEN la primera vez.
-- ponytail: settings es legible por el usuario autenticado (RLS settings_read). App single-tenant
-- (ALLOWED_EMAILS = sólo el dueño) → el token es de su propia cuenta ML; si se vuelve multi-user,
-- mover ml_token a una tabla sin policy de select (sólo service role).

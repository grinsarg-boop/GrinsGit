-- 024 — Override manual de producto para órdenes "producto desconocido".
-- Cuando el título de Shopify no matchea ningún keyword, order_items.product_id queda null → la orden
-- cae en v_sin_clasificar (fuera del P&L). Desde /sync el usuario elige el producto correcto.
-- Guardarlo en order_items.product_id a secas NO sirve: upsert_order borra+reinserta los items en cada
-- sync y los pisa con match_product. Solución durable: orders.product_override + un trigger que re-aplica
-- ese producto a los items SIN producto en cada insert. Así la corrección sobrevive al re-sync y quedan
-- bien tanto la atribución (order_primary_product) como el COGS (order_items.product_id real).
alter table orders add column if not exists product_override int references products(id);

-- BEFORE INSERT: si el item no matcheó producto y su orden tiene override, usar el override.
create or replace function apply_order_override() returns trigger
language plpgsql as $$
begin
  if new.product_id is null then
    select product_override into new.product_id from orders where id = new.order_id;
  end if;
  return new;
end $$;

drop trigger if exists order_items_override on order_items;
create trigger order_items_override before insert on order_items
  for each row execute function apply_order_override();

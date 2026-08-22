-- 088 — Las ventas cuyo título no nombra la marca vuelven al P&L.
--
-- `mapMlOrder` sacaba el producto solo de `matchProduct(título)`. "X5 Pack Ahorro Drenaje Linfático
-- Hinchazón Abdomen Piernas Menta" (MLA3030521696, Pureza) no dice la marca en ningún lado, así que
-- desde el 30/07/2026 quedó con product NULL: 68 ventas y $5.830.374 en 60 días que el recompute
-- descarta por el inner join contra products. En daily_pnl no hay bucket "sin producto" — la
-- facturación, su COGS y su pauta simplemente no están.
--
-- El sync ya lo venía contando (`sinProducto` en syncMlOrders), pero eso viaja como warning dentro
-- de sync_runs.warnings y no enciende nada: 3 semanas sin que nadie lo viera.
--
-- De acá en adelante el sync cae a ml_ad_items (publicación → producto) cuando el título no alcanza
-- (lib/ml.ts). Esto es el backfill de lo ya sincronizado, con la misma regla y no a mano: cualquier
-- publicación mapeada en ml_ad_items resuelve su producto.
-- El recompute se acota a lo que REALMENTE cambió (daily_pnl es por fecha de despacho, de ahí los
-- 7 días de aire hacia atrás): recalcular 120 días porque sí es caro y no arregla nada más.
with fix as (
  update ml_orders o
     set product = p.name
    from ml_ad_items i
    join products p on p.id = i.product_id
   where o.product is null
     and o.raw->'order_items'->0->'item'->>'id' = i.item_id
  returning o.created_at
)
select recompute_daily_pnl(coalesce(min(created_at)::date - 7, current_date), current_date) from fix;

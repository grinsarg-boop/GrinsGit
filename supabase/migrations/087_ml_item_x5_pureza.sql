-- 087 — "X5 Pack Ahorro" es Pureza. La publicación que nadie podía nombrar.
--
-- MLA3030521696 se llama "X5 Pack Ahorro Drenaje Linfático Hinchazón Abdomen Piernas Menta": el
-- título no dice la marca en ningún lado, así que `matchProduct` no la reconoce. Consecuencias
-- medidas el 22/08/2026:
--   · en el picking, 48 de las 1.177 ventas de ML de los últimos 10 días salían "sin producto
--     reconocido" — el único agujero que quedaba, y era siempre esta publicación;
--   · en ml_orders quedan con product NULL: 68 ventas y $5.830.374 en 60 días.
-- Que sea Pureza no es una inferencia del título: el sufijo es idéntico al de las otras
-- publicaciones de Pureza y el precio cierra la escalera del producto ($20.914/u el x3,
-- $18.558/u el x4, $16.900/u este x5).
--
-- ml_ad_items se siembra sola en el recompute desde ml_orders.product… que para esta publicación
-- es NULL, así que el seed automático nunca la iba a agarrar. Cargarla a mano es el camino
-- previsto por la 062 ("un item que nunca vendió se carga a mano y el seed no lo pisa").
--
-- Ojo con el alcance: esto resuelve la ETIQUETA (el picking ya la nombra) y la imputación de la
-- pauta de esa publicación. NO arregla `ml_orders.product`, que es lo que deja esas ventas fuera
-- del P&L por producto — eso es un backfill aparte, con su decisión.
insert into ml_ad_items (item_id, product_id)
select 'MLA3030521696', id from products where name = 'Pureza'
on conflict (item_id) do nothing;

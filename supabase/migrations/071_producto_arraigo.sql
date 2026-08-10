-- 071 — Producto nuevo Arraigo (ARRAIGO · Sérum Anticaída de Romero — Sin Minoxidil).
-- Vende por COD desde el 05/08/2026 y no existía en products: las 13 líneas de order_items tenían
-- product_id NULL, o sea 33 unidades fuera del P&L (ni venta atribuida ni COGS).
-- Keyword = la MARCA, no "romero": el espejo TS (lib/product-match.ts) corre matchAllProducts sobre
-- el texto entero de la etiqueta de ML, destinatario incluido, y Romero es un apellido común.

insert into products (name) values ('Arraigo') on conflict (name) do nothing;

create or replace function match_product(p_text text) returns int
language sql stable as $$
  select p.id
  from (values ('nature','Natures'), ('pureza','Pureza'), ('vein','Veinguard'),
               ('bee','BeeVenom'), ('altus','Altus'), ('reafirmante','M3'),
               ('arraigo','Arraigo')) k(kw, name)
  join products p on p.name = k.name
  where p_text ilike '%' || k.kw || '%'
  limit 1
$$;

-- Costos: unit_cost es el TOTAL del pack (ver seed de 006), no el costo por unidad.
--   x1 = $3.817          → sérum solo
--   x2 = $7.634          → 2 × $3.817, sin aplicador
--   x3 = $15.151         → 3 × $3.817 + $3.700 del aplicador de silicona, que va DE REGALO
-- El x3 hay que cargarlo explícito: sin esta fila, recompute_pnl extrapola pack×costo_x1 = $11.451
-- y se come los $3.700 del aplicador. Es el mismo error que el vault ya detectó en el motor
-- "Pack · Llevá N" de Veltron (Serum-Capilar.md:537), que sigue sin arreglar de ese lado.
--
-- Fuente: cotización Genus 30/07/2026, reconfirmada 06/08 (Serum-Capilar.md:56-61,340-345), a 1.000
-- unidades y con Capixyl al 3%; aplicador a $3.700 (Serum-Capilar.md:71).
-- ⚠️ El vault marca esa cotización como "A GRANEL" con una corrección pendiente a $4.717 que Genus
-- nunca respondió (Serum-Capilar.md:67-69). Pancho confirmó el 09/08/2026 tomar $3.817 como
-- terminado, por eso van con is_estimated = false. Si Genus contesta $4.717, hay que rehacer las
-- tres filas (x1 4717 · x2 9434 · x3 17851) y recomputar desde el 05/08.
insert into product_costs (product_id, pack, unit_cost, is_estimated)
select p.id, v.pack, v.cost, false
from products p
join (values (1, 3817), (2, 7634), (3, 15151)) v(pack, cost) on true
where p.name = 'Arraigo'
on conflict (product_id, pack) do update set unit_cost = excluded.unit_cost, is_estimated = false;

-- Backfill de lo ya vendido (05→08/08/2026): 13 líneas, 33 unidades, todas con product_id NULL.
-- Coincide con lo que va a hacer upsert_order de ahora en más, así que un re-sync no lo pisa.
update order_items
   set product_id = (select id from products where name = 'Arraigo')
 where product_id is null
   and title_raw ilike '%arraigo%';

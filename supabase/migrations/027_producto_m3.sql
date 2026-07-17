-- 027 — Producto nuevo M3 (Aceite Reafirmante Anti-celulítico), DISTINTO de Revival Oil (confirmado).
-- Se vende por Shopify (COD/cuotas); título en las órdenes: "...Reafirmante Anti-celulítico M3".
-- Keyword = "reafirmante": distintiva — NO aparece en Revival Oil ("Aceite Anticelulítico") ni en
-- Altus ("reducción de celulitis"), así que no colisiona. El costo real se carga en /config.
insert into products (name) values ('M3') on conflict (name) do nothing;

create or replace function match_product(p_text text) returns int
language sql stable as $$
  select p.id
  from (values ('nature','Natures'), ('pureza','Pureza'), ('vein','Veinguard'),
               ('bee','BeeVenom'), ('altus','Altus'), ('reafirmante','M3')) k(kw, name)
  join products p on p.name = k.name
  where p_text ilike '%' || k.kw || '%'
  limit 1
$$;

-- Costo placeholder (estimado) para que el COGS no sea 0. Ajustar el real en /config.
insert into product_costs (product_id, pack, unit_cost, is_estimated)
select id, 1, 4265, true from products where name = 'M3'
on conflict (product_id, pack) do nothing;

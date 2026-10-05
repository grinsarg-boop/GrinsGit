-- 106 — Producto nuevo Calma (CALMA™ | Serum Facial que Empareja el tono y suaviza las marcas).
-- Vende por COD desde octubre 2026 y no existía en products: el 04/10/2026 sus pedidos (#28465 ×1,
-- #28596 ×2, #28473 ×3, #28620 ×3) salieron sin código de depósito y se estamparon C1/C2/C3 a mano,
-- y la campaña "Calma cbo open test" quedaba sin dueño (product_id NULL).
-- Copia de match_product (071) con UN cambio además de la fila de Calma: ilike '%kw%' → ~* kw.
-- Para las keywords de solo letras es lo mismo; Calma necesita fin de palabra ('calma\M') porque
-- "calmante" es una palabra común en títulos de cosmética y la lista no tiene orden garantizado
-- (limit 1 sin order by): sin el \M un "BeeVenom calmante" podía salir Calma.
-- Espejo TS: lib/product-match.ts ("calma\\b").

insert into products (name) values ('Calma') on conflict (name) do nothing;

create or replace function match_product(p_text text) returns int
language sql stable as $$
  select p.id
  from (values ('nature','Natures'), ('pureza','Pureza'), ('vein','Veinguard'),
               ('bee','BeeVenom'), ('altus','Altus'), ('reafirmante','M3'),
               ('arraigo','Arraigo'), ('calma\M','Calma')) k(kw, name)
  join products p on p.name = k.name
  where p_text ~* k.kw
  limit 1
$$;

-- Sin costos: no los conocemos todavía (Pancho los carga). Mientras tanto el COGS de Calma da 0,
-- igual que antes con product_id NULL — esta migración no lo empeora.

-- Backfill: lo ya vendido y la pauta ya gastada, con la misma regla que upsert_order/upsert_ad_spend
-- usan de ahora en más (un re-sync no lo pisa).
update order_items set product_id = (select id from products where name = 'Calma')
 where product_id is null and title_raw ~* 'calma\M';
update ad_spend set product_id = (select id from products where name = 'Calma')
 where product_id is null and (coalesce(ad_name, '') || ' ' || coalesce(campaign_name, '')) ~* 'calma\M';

do $$ begin
  assert match_product('CALMA™ | Serum Facial que Empareja el tono y suaviza las marcas (3 Unidades)')
         = (select id from products where name = 'Calma'), 'CALMA no matchea Calma';
  assert match_product('calma-video-G1-open Calma cbo open test')
         = (select id from products where name = 'Calma'), 'el anuncio de Calma no matchea';
  assert match_product('crema calmante') is null, '"calmante" no es Calma';
end $$;

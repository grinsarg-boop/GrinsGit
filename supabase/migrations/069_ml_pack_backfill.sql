-- 069 — Backfill de ml_orders.pack. El pack manda el COGS via product_costs(product_id, pack), así
-- que leerlo de menos infla el profit. `parseMlPack` sacaba el número del título con dos patrones
-- ("3 Gotero…", "4 X 30ml") y devolvía 1 para todo lo demás — 455 órdenes de 8 publicaciones caían
-- ahí desde abril: los títulos que dicen "2u", "Promo X4" / "Pack X2", y los títulos de CATÁLOGO de
-- ML, que no dicen la cantidad en ningún lado (ML los impone, no los controlamos).
--   Ejemplo del agujero: "…Menta 2u Menta" (x2) pagaba $2.500 de COGS en vez de $4.500.
-- El parser de TS (lib/ml.ts) ya está arreglado y con tests, así que esto corre UNA vez para las
-- filas viejas; de acá en adelante entran bien del sync. La función SQL es espejo del TS y se dropea
-- al final a propósito: dos implementaciones vivas de la misma regla se desincronizan solas.

create function ml_pack_backfill_069(t text, item_id text) returns int
language sql immutable as $$
  select coalesce(
    -- Títulos de catálogo sin cantidad: no hay regex que los saque, va por publicación.
    case when item_id = 'MLA3692036796' then 2 end,
    (select v.n from (
       select 1 as ord, nullif(substring(coalesce(t, '') from '^\s*(\d{1,2})\s'), '')::int as n        -- "3 Gotero…"
       union all
       select 2, nullif(substring(coalesce(t, '') from '(\d{1,2})\s*[xX]\s*\d'), '')::int             -- "…4 X 30ml"
       union all
       select 3, nullif(substring(coalesce(t, '') from '[xX]\s*(\d{1,2})'), '')::int                  -- "…Promo X4"
       union all
       select 4, nullif(substring(coalesce(t, '') from '(\d{1,2})\s*[uU]\y'), '')::int                -- "…Menta 2u"
     ) v
     -- El tope de 12 es lo que descarta los falsos positivos: "X 30ml" captura 30, no es un pack.
     where v.n between 1 and 12 order by v.ord limit 1),
    1);
$$;

do $$
declare v_desde date; v_filas int;
begin
  create temp table pack_fix on commit drop as
  select o.ml_id,
         ml_pack_backfill_069(o.raw->'order_items'->0->'item'->>'title',
                              o.raw->'order_items'->0->'item'->>'id') as pack_nuevo,
         (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date as d
  from ml_orders o;

  delete from pack_fix f using ml_orders o where o.ml_id = f.ml_id and o.pack = f.pack_nuevo;

  select count(*), min(d) into v_filas, v_desde from pack_fix;
  raise notice '069: % filas a corregir, desde %', v_filas, v_desde;
  if v_filas = 0 then return; end if;

  update ml_orders o set pack = f.pack_nuevo from pack_fix f where f.ml_id = o.ml_id;

  -- El COGS de daily_pnl sale de product_costs(product_id, pack): sin recompute el panel sigue
  -- mostrando el profit inflado aunque la fila ya esté bien.
  perform recompute_daily_pnl(v_desde, current_date);
end $$;

drop function ml_pack_backfill_069(text, text);

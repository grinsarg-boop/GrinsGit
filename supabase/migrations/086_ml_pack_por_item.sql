-- 086 — Con qué pack se viene vendiendo cada publicación de ML.
--
-- Es la red de seguridad del lector de etiquetas. El pack de una venta sale del título
-- (parseMlPack, el mismo que cobra el COGS en el P&L), pero hay títulos que no dicen la cantidad
-- en ningún lado: los de catálogo, que ML impone. Ahí `parseMlPack` devuelve 1 por default, y ese
-- 1 es indistinguible de un x1 de verdad → el depósito despacha de menos y nadie se entera.
--
-- Lo que esta función agrega es el dato que ya estaba en la base y no se usaba: con qué pack se
-- vendió esa MISMA publicación las últimas 90 veces. Si un listado lleva 68 ventas como x5 y hoy
-- el título no dice nada, el que está mal es el título.
--
-- Se toma el pack MÁS RECIENTE, no el más frecuente: los títulos cambian (MLA3030366476 vendió 21
-- veces como x1 hasta el 17/07 y 331 veces como x2 después), y en un cambio así la moda histórica
-- sigue devolviendo el valor viejo durante semanas. Se piden 2 ventas mínimo para no consagrar un
-- pack que salió de una sola orden mal parseada.
create or replace function ml_pack_por_item(p_days int default 90)
returns table (item_id text, pack int, ventas bigint, ultima date)
language sql stable as $fn$
  with x as (
    select o.raw->'order_items'->0->'item'->>'id' as item_id,
           o.pack, o.created_at
      from ml_orders o
     where o.created_at > now() - make_interval(days => p_days)
       and o.pack is not null and o.pack between 1 and 12
       and o.raw->'order_items'->0->'item'->>'id' is not null
  ), ult as (
    -- el pack de la venta más reciente de cada publicación
    select distinct on (item_id) item_id, pack from x order by item_id, created_at desc
  )
  select u.item_id, u.pack, count(*) as ventas, max(x.created_at)::date as ultima
    from ult u join x on x.item_id = u.item_id and x.pack = u.pack
   group by u.item_id, u.pack
  having count(*) >= 2;
$fn$;

grant execute on function ml_pack_por_item(int) to authenticated, service_role;

-- 070 — El código de seguimiento de Urbano cambió: `BLABS<order_number>`, no el shopify_id.
--
-- Medido contra consultaTrackingMasivo el 06/08/2026:
--   7069439328496 (shopify_id del pedido 18942, despachado el 06/08) → codError 5 "Pieza postal inexistente"
--   BLABS18942                                                       → codError 0, CO - Contenerizado
--   7061784592624 (despacho del 03/08)                               → codError 0, DL - entregado
-- Es un corte hacia adelante (04/08), no un re-keyeo: lo despachado hasta el 03/08 sigue respondiendo por
-- shopify_id. En `shipments` se ve el cruce: 03/08 = 50 shopify_id / 0 BLABS · 04/08 = 42/29 · 05/08 = 2/87.
--
-- Qué seguía andando: el alta por tag (013, la regex `guia-([A-Za-z0-9]+)` ya aceptaba letras) y el REFRESH
-- (consulta por shipments.tracking, que ya es el BLABS). Qué se rompió: el DESCUBRIMIENTO (029), que consulta
-- por shopify_id → codError 5 siempre. Todo pedido despachado SIN tag desde el 04/08 quedaba invisible.
--
-- Acá va la mitad SQL: devolver también el order_number para poder armar el código nuevo. La otra mitad está
-- en lib/couriers/sync.ts (consulta los dos códigos) y lib/couriers/urbano.ts (order_ref = el código pelado,
-- porque "BLABS18942" no matchea ni `^\d{10,}$` ni order_number → la guía nueva quedaría huérfana).

drop function if exists urbano_sin_guia(timestamptz, int);

create function urbano_sin_guia(p_since timestamptz, p_limit int default 150)
returns table (shopify_id bigint, order_number text)
language sql stable as $$
  select o.shopify_id, o.order_number
  from orders o
  where o.courier = 'urbano'
    and o.cancelled_at is null
    and o.created_at >= p_since
    -- 'Standby' = nunca se despachó (Urbano las da "Pieza inexistente"): excluirlas evita gastar consultas.
    and (o.tags is null or o.tags !~* 'standby')
    and not exists (select 1 from shipments s where s.order_id = o.id)
  order by o.urbano_discovery_at asc nulls first,   -- nunca intentadas primero, luego las de intento más viejo
           o.created_at
  limit p_limit
$$;

revoke execute on function urbano_sin_guia(timestamptz, int) from anon, authenticated;
grant execute on function urbano_sin_guia(timestamptz, int) to service_role;

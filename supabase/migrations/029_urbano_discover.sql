-- 029 — Descubrimiento de guías Urbano. El sync solo REFRESCA guías ya en `shipments` (consulta la masiva
-- por los trackings existentes); nunca DESCUBRE guías nuevas. Las órdenes que Urbano despacha sin el tag
-- guia-<código> (el mecanismo del 08/07 en adelante) nunca crean su shipment → figuran "sin despachar"
-- aunque Urbano sí las tiene (caso testigo: #16003). Esta función devuelve los shopify_id de órdenes urbano
-- activas SIN guía en una ventana reciente, para que el sync consulte la masiva por ellos y cree los eventos
-- (upsert_shipment_events matchea por shopify_id, 006). Read-only; el descubrimiento en sí lo hace el route.

-- Cursor de descubrimiento: cuándo se consultó por última vez cada orden. El sync marca las que intentó
-- (haya guía o no) y las devuelve ordenadas por este campo → rota por TODO el set sin atascarse en la cabeza
-- (el set real supera el límite por corrida: cientos de COD recientes aún sin despachar conviven con las
-- despachadas-sin-tag que hay que descubrir). Sin este cursor, order by created_at hambrearía a unas u otras.
alter table orders add column if not exists urbano_discovery_at timestamptz;

create or replace function urbano_sin_guia(p_since timestamptz, p_limit int default 150)
returns table (shopify_id bigint)
language sql stable as $$
  select o.shopify_id
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

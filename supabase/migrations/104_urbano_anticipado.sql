-- 104 — Cuenta anticipada de Urbano (BLABSA<order_number>) → courier propio 'urbano_ant'.
--
-- COURIER PROPIO (decidido por Pancho 03/10/2026). El anticipado ya está cobrado: no tiene tasa de
-- entrega COD, ni rendición, ni reclamo. Con courier 'urbano' entraba a ~10 lectores que filtran
-- `courier = 'urbano'` sin mirar cuotas_3 — el peor, recompute_priors (080) + cohort_k (079): un envío
-- prepago entrega ~100% e inflaba el prior y el k de TODO el COD de Urbano; también analisis_*,
-- anuncios_pnl, courier_tiempos, urbano_cobranza y scripts/urbano-reclamo.mjs (lo mandaba como "no
-- figura en ningún resumen"). Separarlo en la escritura los deja afuera a todos sin tocarlos.
-- Lo que sí hace falta: (a) ampliar los checks de courier de las tablas a las que llega — shipments,
-- orders (upsert_order le copia el courier de la guía) y delivery_priors (`_prior_cohort` agrupa por
-- cualquier courier: sin esto recompute_priors fallaba); (b) map_status y v_estados_sin_mapear leen
-- 'urbano_ant' con el mapa de 'urbano' (misma API, mismos códigos) en vez de duplicar el seed.
-- El P&L del anticipado sigue en la rama cuotas de recompute_daily_pnl (por tag, flete = correo_flete).
--
-- Desde el 03/10/2026 el pago anticipado (tag cuotas_3, ya cobrado por MP) no sale por Correo sino por
-- otra cuenta de Urbano: shipper 4565, servicio E, sin contrareembolso, código BLABSA<order_number>
-- (ej. BLABSA27789). Veltron no le pone tag `guia-…` que entre por el 013 (que además excluye cuotas_3),
-- así que la guía nace por el descubrimiento (029/070). Dos cosas lo impedían:
--   1. `o.courier = 'urbano'`: el courier del pedido es la clasificación por CP, y un cuotas_3 de AMBA
--      queda 'fixy' aunque viaje por Urbano anticipado (#28373, 02/10).
--   2. el código: se consultaba BLABS<n> con la cuenta 4362; la guía anticipada sólo existe en la 4565.
-- Acá va la mitad SQL: el flag `anticipado` (cuotas_3 PAGADO) para que lib/couriers/sync.ts arme el
-- BLABSA, y el cuotas_3 pagado entra sin importar el courier por CP. Un cuotas_3 sin pagar sigue como
-- antes (sólo si es urbano, con BLABS): no se despacha anticipado hasta que paga.

drop function if exists urbano_sin_guia(timestamptz, int);

create function urbano_sin_guia(p_since timestamptz, p_limit int default 150)
returns table (shopify_id bigint, order_number text, anticipado boolean)
language sql stable as $$
  select o.shopify_id, o.order_number,
         (o.tags ~* 'cuotas_3' and o.financial_status = 'paid') as anticipado
  from orders o
  where (o.courier = 'urbano' or (o.tags ~* 'cuotas_3' and o.financial_status = 'paid'))
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

-- ============ courier 'urbano_ant' ============
do $$
declare t text; cn text;
begin
  foreach t in array array['shipments','orders','delivery_priors'] loop
    select conname into cn from pg_constraint
     where conrelid = t::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%courier%';
    if cn is not null then execute format('alter table %I drop constraint %I', t, cn); end if;
  end loop;
end $$;
alter table shipments add constraint shipments_courier_check check (courier in ('urbano','urbano_ant','fixy'));
alter table orders add constraint orders_courier_check check (courier in ('urbano','urbano_ant','fixy'));
alter table delivery_priors add constraint delivery_priors_courier_check
  check (courier in ('urbano','urbano_ant','fixy','correo'));

-- Copia de 002 con el alias: la cuenta anticipada usa el mapa de estados de urbano.
create or replace function map_status(p_courier text, p_raw text) returns text
language sql stable as $$
  select coalesce(
    (select status_canonical from courier_status_map
      where courier = case p_courier when 'urbano_ant' then 'urbano' else p_courier end
        and match_type = 'exact'
        and upper(trim(status_raw)) = upper(trim(p_raw)) limit 1),
    (select status_canonical from courier_status_map
      where courier = case p_courier when 'urbano_ant' then 'urbano' else p_courier end
        and match_type = 'keyword'
        and p_raw ilike '%' || status_raw || '%'
      order by length(status_raw) desc limit 1),
    'incidencia')
$$;

create or replace view v_estados_sin_mapear as
select distinct s.courier, se.status_raw
from shipment_events se
join shipments s on s.id = se.shipment_id
where not exists (
  select 1 from courier_status_map m
  where m.courier = case s.courier when 'urbano_ant' then 'urbano' else s.courier end and (
    (m.match_type = 'exact' and upper(trim(m.status_raw)) = upper(trim(se.status_raw))) or
    (m.match_type = 'keyword' and se.status_raw ilike '%' || m.status_raw || '%')));

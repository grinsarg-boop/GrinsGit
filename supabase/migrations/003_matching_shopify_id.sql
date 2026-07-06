-- 003 — Matching por shopify_id para Urbano (Opción A: shipment.tracking = id de pedido Shopify).
-- NO edita 001/002: CREATE OR REPLACE de upsert_shipment_events e import_urbano_freight.
-- El webservice de Urbano y la facturación se cruzan por id de pedido (cli_codigo /
-- rec_numguia_cliente = orders.shopify_id); el nº de guía real (gui_numero) va en raw.
-- La rama shopify_id es un match exacto adicional (primer intento); order_number queda de fallback.
-- No pisa a Fixy: sus refs son #NNNN (numérico corto), esto exige ≥10 dígitos (id Shopify de 13).

-- Estado sintético de despacho (§ ciclo del webservice) → 'despachado' directo, que no ensucie
-- v_estados_sin_mapear ni v_sin_clasificar. El cliente urbano.ts lo emite con occurred_at = ciclo.
insert into courier_status_map (courier, status_raw, status_canonical, match_type) values
  ('urbano', 'CICLO - Despacho', 'despachado', 'exact')
on conflict (courier, status_raw) do nothing;

-- ============ upsert_shipment_events (reemplaza 002) ============
create or replace function upsert_shipment_events(p jsonb) returns int
language plpgsql as $fn$
declare
  e jsonb;
  v_ship bigint; v_canon text; v_ins int; v_count int := 0;
  v_courier text; v_tarifa numeric; v_importe numeric;
  v_mult numeric := (select (value::text)::numeric from settings where key = 'urbano_freight_mult');
begin
  for e in select * from jsonb_array_elements(p) loop
    v_courier := e->>'courier';

    insert into shipments (courier, tracking, order_ref, province, raw)
    values (v_courier, e->>'tracking', e->>'order_ref', e->>'province', coalesce(e->'raw', '{}'::jsonb))
    on conflict (courier, tracking) do update set
      order_ref = coalesce(shipments.order_ref, excluded.order_ref),
      province  = coalesce(shipments.province, excluded.province),
      raw       = shipments.raw || excluded.raw
    returning id into v_ship;

    v_canon := map_status(v_courier, e->>'status_raw');
    insert into shipment_events (shipment_id, status_raw, status_canonical, occurred_at, raw)
    values (v_ship, e->>'status_raw', v_canon, (e->>'occurred_at')::timestamptz, e->'raw')
    on conflict do nothing;
    get diagnostics v_ins = row_count;
    v_count := v_count + v_ins;

    -- Flete real (§4.1): urbano tarifa × mult, fixy importe tal cual
    v_tarifa  := (e->>'tarifa')::numeric;
    v_importe := (e->>'importe')::numeric;
    if v_courier = 'urbano' and v_tarifa is not null then
      update shipments set freight_tarifa = v_tarifa, freight_cost = v_tarifa * v_mult,
             freight_is_estimated = false where id = v_ship;
    elsif v_courier = 'fixy' and v_importe is not null then
      update shipments set freight_tarifa = v_importe, freight_cost = v_importe,
             freight_is_estimated = false where id = v_ship;
    end if;

    -- Estado canónico = último evento; resolved_at solo terminales (§3).
    -- dispatched_at: prioriza el evento 'despachado' (ciclo del WS); si no hay, la fecha ya
    -- seteada (fulfillment); si tampoco, el primer evento (§ regla de cohorte por ciclo).
    update shipments s set
      status_raw = le.status_raw, status_canonical = le.status_canonical, status_at = le.occurred_at,
      resolved_at = case when le.status_canonical in ('entregado','devuelto','siniestro','cancelado')
                         then le.occurred_at end,
      dispatched_at = coalesce(desp.d, s.dispatched_at, fe.d),
      updated_at = now()
    from (select status_raw, status_canonical, occurred_at from shipment_events
           where shipment_id = v_ship order by occurred_at desc limit 1) le,
         (select min(occurred_at)::date as d from shipment_events where shipment_id = v_ship) fe,
         (select min(occurred_at)::date as d from shipment_events
           where shipment_id = v_ship and status_canonical = 'despachado') desp
    where s.id = v_ship;
  end loop;

  -- Match exacto por shopify_id (Urbano Opción A) — PRIMER intento.
  -- CASE (no guard+cast en el mismo WHERE): Postgres no garantiza short-circuit y evaluaría
  -- order_ref::bigint sobre refs no numéricas (ej. Fixy) rompiendo con invalid input syntax.
  update shipments s
     set order_id = o.id, province = coalesce(s.province, o.province), updated_at = now()
  from orders o
  where s.order_id is null
    and o.shopify_id = case when s.order_ref ~ '^\d{10,}$' then s.order_ref::bigint end;

  -- Fallback: order_ref = order_number (#NNNN, Fixy) — sin cambios respecto de 002.
  update shipments s
     set order_id = o.id, province = coalesce(s.province, o.province), updated_at = now()
  from orders o
  where s.order_id is null and s.order_ref is not null
    and replace(s.order_ref, '#', '') = o.order_number;

  -- Flete estimado por provincia para urbano sin facturar (§4.1)
  update shipments
     set freight_cost = estimate_urbano_freight(province), freight_is_estimated = true
  where courier = 'urbano' and freight_tarifa is null
    and (freight_cost is null or freight_is_estimated);

  return v_count;
end $fn$;

-- ============ import_urbano_freight (reemplaza 002) ============
-- p = array {tracking, tarifa}. tracking = rec_numguia_cliente = id de pedido Shopify.
create or replace function import_urbano_freight(p jsonb) returns int
language plpgsql as $fn$
declare
  v_mult numeric := (select (value::text)::numeric from settings where key = 'urbano_freight_mult');
  v_n int; v_from date; v_to date;
begin
  with rows as (
    select x->>'tracking' as tracking,
           case when x->>'tracking' ~ '^\d{10,}$' then (x->>'tracking')::bigint end as tracking_id,
           (x->>'tarifa')::numeric as tarifa
    from jsonb_array_elements(p) x
    where x->>'tracking' is not null and (x->>'tarifa') is not null
  ),
  upd as (
    update shipments s
       set freight_tarifa = r.tarifa, freight_cost = r.tarifa * v_mult,
           freight_is_estimated = false, updated_at = now()
    from rows r
    -- shopify_id (primer intento, vía el pedido linkeado) OR tracking directo (fallback 002)
    left join orders o on o.shopify_id = r.tracking_id
    where s.courier = 'urbano'
      and (s.order_id = o.id or s.tracking = r.tracking)
    returning s.dispatched_at
  )
  select count(*), min(dispatched_at), max(dispatched_at) into v_n, v_from, v_to from upd;

  if v_from is not null then
    perform recompute_daily_pnl(v_from, v_to);
  end if;
  return v_n;
end $fn$;

-- Mutan datos: solo service role (CREATE OR REPLACE preserva ACL; se re-aplica por las dudas).
revoke execute on function upsert_shipment_events(jsonb) from anon, authenticated;
revoke execute on function import_urbano_freight(jsonb) from anon, authenticated;

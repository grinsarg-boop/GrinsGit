-- 097 · resolved_at = el primer evento de la RACHA FINAL, no el último evento.
--
-- La racha final es la cola de eventos que mapean al estado final (mismo orden que `le`:
-- occurred_at, id). resolved_at pasa a ser el occurred_at del primero de esa cola: el momento desde
-- el que la guía quedó cerrada. status_canonical y status_at no cambian.
--
-- Por qué. El sync vivo deja de consultar una guía apenas llega a un estado terminal
-- (lib/couriers/sync.ts, TERMINALES), así que en régimen normal nunca ve lo que pasa después y
-- guarda el primer evento. Pero cuando la historia llega entera de una vez (el backfill de la 073,
-- 13/08/2026) entran también los eventos post-resolución, y el rollup se quedaba con el último:
--   entregadas: 39 "ENTREGADA" y después 39 "RENDICION AL CLIENTE", +1,4 días
--   devueltas:  139 "PLAZO DE REPROGRAMACION VENCIDO" … 184 "RENDICION RECEPCIONADA", hasta +23 días
-- Fixy desde julio: 339 de 947 entregadas y 145 de 426 devueltas. Mayo-julio: ~99% de las guías.
--
-- Cuánto mueve (medido 25/09/2026 contra prod, solo lectura). Curvas de Fixy de la 080 (ventana
-- 21-90 d): Gd al día 2 37,8% → 62,7%, Rexp al día 14 85,6% → 95,8%. Decay y madurez no cambian
-- (la ventana del decay ya es posterior al backfill). El estimado abierto de Fixy sube +$9.192
-- (+1,1%) — hoy es inmaterial, y se limpiaría solo cuando las cohortes del backfill salgan de la
-- ventana (~10/11).
-- El cambio es por el riesgo: con el historial re-importado (re-correr
-- scripts/backfill-fixy-historial.mts) la ventana del decay se contamina igual, y el estimado de
-- Fixy de 0-6 días sube +26,5% (+$212k sobre la masa abierta del 25/09). Backtest al día 7, con lo
-- observado reconstruido de los eventos: MAE 2,09 → 1,23 pp.
--
-- Por qué la racha y no min(): mayo/junio tienen eventos del XLSX (POD-ENTREGADA, CSYDV) fechados
-- el día del despacho y seguidos por la historia de la API. Un min() pelado resolvía ~1.050 guías a
-- edad 0, lo mismo que la 072 ya había visto una vez.
--
-- Urbano también tiene duplicados (movimiento de las 12:00Z y sintético de las 23:59:59Z) pero del
-- mismo día: la fecha cambia en 1 guía.
--
-- Copia de la definición VIVA en prod (074, verificada con pg_get_functiondef) con el cambio en
-- resolved_at.

create or replace function upsert_shipment_events(p jsonb) returns int
language plpgsql as $fn$
declare
  e jsonb;
  v_ship bigint; v_ins int; v_count int := 0;
  v_courier text; v_tarifa numeric; v_importe numeric;
  v_mult numeric := (select (value::text)::numeric from settings where key = 'urbano_freight_mult');
  v_touched bigint[] := '{}';
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
    v_touched := array_append(v_touched, v_ship);

    insert into shipment_events (shipment_id, status_raw, occurred_at, raw)
    values (v_ship, e->>'status_raw', (e->>'occurred_at')::timestamptz, e->'raw')
    on conflict do nothing;
    get diagnostics v_ins = row_count;
    v_count := v_count + v_ins;

    v_tarifa  := (e->>'tarifa')::numeric;
    v_importe := (e->>'importe')::numeric;
    if v_courier = 'urbano' and v_tarifa is not null then
      update shipments set freight_tarifa = v_tarifa, freight_cost = v_tarifa * v_mult,
             freight_is_estimated = false where id = v_ship;
    elsif v_courier = 'fixy' and v_importe is not null then
      update shipments set freight_tarifa = v_importe, freight_cost = v_importe,
             freight_is_estimated = false where id = v_ship;
    end if;

    update shipments s set
      status_raw = le.status_raw, status_canonical = le.status_canonical, status_at = le.occurred_at,
      -- ← 097: el primero de la racha final, no le.occurred_at (ver encabezado).
      resolved_at = case when le.status_canonical in ('entregado','devuelto','siniestro','cancelado')
                         then (select min(z.occurred_at)
                                 from (select occurred_at,
                                              bool_and(map_status(v_courier, status_raw) = le.status_canonical)
                                                over (order by occurred_at desc, id desc
                                                      rows unbounded preceding) as racha
                                         from shipment_events where shipment_id = v_ship) z
                                where z.racha) end,
      dispatched_at = coalesce(desp.d, s.dispatched_at, fe.d),
      updated_at = now()
    from (select status_raw, map_status(v_courier, status_raw) as status_canonical, occurred_at
            from shipment_events where shipment_id = v_ship
           order by occurred_at desc, id desc limit 1) le,     -- ← id desc: el último que informó Urbano
         -- ← 074: el día se corta en ART. Sin el `at time zone`, esto es la fecha UTC.
         (select (min(occurred_at) at time zone 'America/Argentina/Buenos_Aires')::date as d
            from shipment_events where shipment_id = v_ship) fe,
         (select (min(occurred_at) at time zone 'America/Argentina/Buenos_Aires')::date as d
            from shipment_events
           where shipment_id = v_ship and map_status(v_courier, status_raw) = 'despachado') desp
    where s.id = v_ship;
  end loop;

  update shipments s
     set order_id = o.id, province = coalesce(s.province, o.province), updated_at = now()
  from orders o
  where s.order_id is null
    and o.shopify_id = case when s.order_ref ~ '^\d{10,}$' then s.order_ref::bigint end;
  update shipments s
     set order_id = o.id, province = coalesce(s.province, o.province), updated_at = now()
  from orders o
  where s.order_id is null and s.order_ref is not null
    and replace(s.order_ref, '#', '') = o.order_number;

  -- El ::date de acá va sobre el TEXTO del fulfillment ('...T21:00:00-03:00'): Postgres se queda
  -- con la fecha literal e ignora el offset, o sea ya es ART. No tocar (ver encabezado de la 074).
  update shipments s set dispatched_at = (o.raw->'fulfillments'->0->>'created_at')::date, updated_at = now()
  from orders o
  where o.id = s.order_id and s.id = any(v_touched) and s.courier = 'urbano'
    and (o.raw->'fulfillments'->0->>'created_at') is not null
    and not exists (select 1 from shipment_events e
                     where e.shipment_id = s.id and map_status(s.courier, e.status_raw) = 'despachado');

  update shipments
     set freight_cost = estimate_urbano_freight(province), freight_is_estimated = true
  where id = any(v_touched) and courier = 'urbano' and freight_tarifa is null
    and (freight_cost is null or freight_is_estimated);

  return v_count;
end $fn$;

-- Backfill de una pasada: las guías resueltas no se re-sincronizan nunca (ver 074), así que la
-- función sola no las corrige. Solo hacia atrás, y solo donde el estado guardado es el del último
-- evento: las pisadas a mano (rendición manda de la 085, devoluciones viejas de la 057) no tienen
-- racha y quedan como están. Sin updated_at: no es un sync, y el sync ordena por esa columna.
-- Medido 25/09 (solo lectura, ~13 s): 1.571 guías de Fixy (despacho 01/05-11/08; entregadas -1,4 d,
-- devueltas -17,9 d) y 2.111 de Urbano que se corren ~12 h dentro del mismo día.
update shipments s
   set resolved_at = r.t
from (select shipment_id, min(occurred_at) as t
        from (select e.shipment_id, e.occurred_at,
                     bool_and(map_status(s2.courier, e.status_raw) = s2.status_canonical)
                       over (partition by e.shipment_id order by e.occurred_at desc, e.id desc
                             rows unbounded preceding) as racha
                from shipment_events e
                join shipments s2 on s2.id = e.shipment_id
               where s2.status_canonical in ('entregado','devuelto','siniestro','cancelado')) z
       where racha
       group by shipment_id) r
where s.id = r.shipment_id and r.t < s.resolved_at;

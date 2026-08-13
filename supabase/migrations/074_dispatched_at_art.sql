-- 074: dispatched_at corta el día en ART, no en UTC.
--
-- Bug: la sesión de Postgres corre en TimeZone UTC y `min(occurred_at)::date` castea el
-- timestamptz a la fecha UTC. Fixy fecha sus eventos con offset ART (-03:00, lib/couriers/fixy.ts),
-- así que un alta de 21:00-23:59 ART caía al día SIGUIENTE. Medido sobre mayo-agosto: 399 de
-- 1.658 guías Fixy (24,1%) con dispatched_at un día adelantado, con jornadas enteras corridas
-- (20/07: 33 de 33; 27/07: 22 de 22). Misma convención ART que ya declara la 016 para Correo.
--
-- Urbano no estaba afectado: fecha todo a las 12:00Z y el sintético a las 23:59:59Z, que en ART
-- caen el mismo día. Tampoco lo estaba ninguna de las dos ramas que leen el fulfillment de
-- Shopify (el ::date de acá abajo y el .slice(0,10) de lib/shopify.ts): el string trae offset
-- local y ambas se quedan con la fecha literal, que ya es ART. Verificado: 0 de 172 difieren.
-- Por eso ese cast queda como está — tocarlo no cambia nada y sí puede romper.
--
-- Copia de la definición VIVA en prod (post-073) con los dos casts de eventos en ART.

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
      resolved_at = case when le.status_canonical in ('entregado','devuelto','siniestro','cancelado')
                         then le.occurred_at end,
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
  -- con la fecha literal e ignora el offset, o sea ya es ART. No tocar (ver encabezado).
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

-- Backfill de una pasada: la función sola no alcanza porque dispatched_at se recalcula recién
-- cuando el sync vuelve a tocar la guía, y las ya resueltas no se re-sincronizan nunca.
-- Acotado a la rama autoritativa (existe evento 'despachado'); si no existe, el coalesce de arriba
-- deja el valor previo y el fallback `fe` no llega a aplicar.
--
-- Y acotado a fixy y a saltos de exactamente un día, que es el bug medido: las 399 de fixy son
-- todas -1 día. Recalcular Urbano acá también movería 23 guías, pero 19 con saltos de varios días
-- — eso no es zona horaria sino el fulfillment de Shopify discrepando del evento del courier, y
-- es otro problema sin medir. Queda afuera a propósito.
update shipments s
   set dispatched_at = desp.d, updated_at = now()
from (select shipment_id,
             (min(occurred_at) at time zone 'America/Argentina/Buenos_Aires')::date as d
        from shipment_events e
        join shipments s2 on s2.id = e.shipment_id
       where s2.courier = 'fixy' and map_status(s2.courier, e.status_raw) = 'despachado'
       group by shipment_id) desp
where s.id = desp.shipment_id and desp.d = s.dispatched_at - 1;

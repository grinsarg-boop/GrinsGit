-- 019 — Urbano: el `estado` autoritativo de la masiva (item.estado, guardado en
-- shipment_events.raw.estado_actual) manda sobre el último movimiento sincronizado.
-- Bug de madurez: envíos con estado "RM - Rendido a Matriz" / "DL - ..." / "RV - ..." / "DV - ..."
-- quedaban en_transito o incidencia porque el último movimiento era anterior (AR/CO/CA) o empató en
-- fecha (todo a las 12:00Z) y perdió el desempate del "último evento" → no maduraban el día
-- (en el seguimiento de Urbano figuran rendidos, en el panel seguían en tránsito).
-- Root cause en el conector: lib/couriers/urbano.ts ahora emite el estado como evento autoritativo,
-- así el próximo sync mantiene el canónico correcto. Acá re-canonizamos lo YA guardado, sin volver
-- a pegarle a Urbano. Conservador (preferencia del dueño): solo movemos HACIA un estado resuelto,
-- nunca des-resolvemos algo ya cerrado. Idempotente (el guard <> status_canonical lo vuelve no-op).
-- Requiere recompute_daily_pnl del rango afectado para reflejarlo en el panel.

-- El estado autoritativo (raw.estado_actual) es el mismo para todos los eventos de un sync, pero los
-- eventos sintéticos/CICLO lo traen vacío. Tomar el del ÚLTIMO evento que SÍ tenga un código válido
-- (si tomáramos el "último por occurred_at" a secas caería en el empate del mismo día y podría ser el
-- que tiene estado_actual='' → se perdía el caso 51638).
with latest as (
  select distinct on (se.shipment_id) se.shipment_id,
         upper((regexp_match(se.raw->>'estado_actual', '^([A-Za-z0-9]+)\s*-'))[1]) as code
  from shipment_events se
  join shipments s on s.id = se.shipment_id and s.courier = 'urbano'
  where se.raw->>'estado_actual' ~ '^[A-Za-z0-9]+\s*-'
  order by se.shipment_id, se.occurred_at desc
)
update shipments s
   set status_raw = l.code,
       status_canonical = map_status('urbano', l.code),
       resolved_at = case
         when map_status('urbano', l.code) in ('entregado','devuelto','siniestro','cancelado')
         then coalesce(s.resolved_at, s.status_at) else s.resolved_at end,
       updated_at = now()
  from latest l
 where s.id = l.shipment_id
   and l.code <> ''
   and map_status('urbano', l.code) <> s.status_canonical
   and map_status('urbano', l.code) in ('entregado','rehusado','en_devolucion','devuelto','siniestro');

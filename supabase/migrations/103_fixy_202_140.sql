-- 103 · Fixy: mapear 202 y 140, los únicos 2 códigos sin mapear del diccionario armado desde prod
-- (A13-R1-T1, 01/10/2026: shipment_events 05/05→01/10, 31 códigos, docs/fixy-codigos-estado.md).
--   202 "LISTO EN DEPOSITO SAME DAY" → en_transito, como el 129 (EN DEPOSITO LISTO PARA DESPACHO).
--       49 guías desde el 08/09: 34 entregadas, 6 devueltas, 9 vivas. Caía al default 'incidencia'.
--   140 "ENTREGADA CON DEVOLUCION" → incidencia (no terminal). En los 2 casos de prod (1771957,
--       1837831) aparece en el medio del recorrido y la guía sigue: termina en 139 y en 39.
-- Hoy ninguna shipment tiene estado ACTUAL 202 ni 140: cero cambio de P&L, limpia el mapa.

insert into courier_status_map (courier, status_raw, status_canonical, match_type) values
  ('fixy', '202', 'en_transito', 'exact'),   -- LISTO EN DEPOSITO SAME DAY
  ('fixy', '140', 'incidencia',  'exact')    -- ENTREGADA CON DEVOLUCION: no terminal
on conflict (courier, status_raw)
  do update set status_canonical = excluded.status_canonical, match_type = 'exact';

update shipments set status_canonical = map_status(courier, status_raw)
 where courier = 'fixy' and status_raw in ('202', '140');

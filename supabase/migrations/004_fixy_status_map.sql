-- 004 — Estados reales de Fixy (export de guías) → canónico. Aprobado por el dueño.
-- Los estados vienen como "CÓDIGO-DESC"; se mapean por keyword sobre el CÓDIGO- (estable),
-- así el Motivo (que va en raw, no en status_raw) no afecta el mapeo.
-- El seed de 001 tenía keywords genéricas (Entregado, Rehusado…) que NO matchean estos códigos.

insert into courier_status_map (courier, status_raw, status_canonical, match_type) values
  ('fixy', 'POD-',     'entregado',   'keyword'),   -- POD-ENTREGADA (mayoría)
  ('fixy', 'CSYDV-',   'devuelto',    'keyword'),   -- cobro de servicio + devolución (cobra flete igual)
  ('fixy', 'EPR-',     'en_transito', 'keyword'),   -- esperando programación
  ('fixy', 'CANC-',    'cancelado',   'keyword'),
  ('fixy', 'RAD-',     'en_sucursal', 'keyword'),   -- reingreso a depósito: rescatable, no perdido
  ('fixy', 'ROBO-',    'siniestro',   'keyword'),   -- envío robado (pierde costo)
  ('fixy', 'ANULADO-', 'cancelado',   'keyword'),
  ('fixy', 'REPRO-',   'en_transito', 'keyword'),   -- repactado listo para despacho
  ('fixy', '9WVR-',    'incidencia',  'keyword')    -- falla mecánica
on conflict (courier, status_raw) do nothing;

-- 008 — Mapa de estados de la API de Fixy (seguimiento.json) → canónico (FASE 5).
-- La API devuelve codigo_estado NUMÉRICO (distinto de los códigos CSYDV-/POD- del XLSX de 004).
-- lib/couriers/fixy.ts guarda status_raw = codigo_estado (string) → match EXACT por código.
-- Alineado con el canónico que 004 asignó a los mismos estados del XLSX. Descubierto probando
-- guías reales contra la API. Códigos no listados → incidencia + warning (v_estados_sin_mapear),
-- se completan desde /config a medida que aparecen (patrón SPEC §3). El flete/COD sale del XLSX.

insert into courier_status_map (courier, status_raw, status_canonical, match_type) values
  ('fixy', '39',  'entregado',   'exact'),   -- ENTREGADA
  ('fixy', '184', 'devuelto',    'exact'),   -- DEVOLUCIÓN ENTREGADA (rendición recepcionada)
  ('fixy', '139', 'devuelto',    'exact'),   -- COBRO DE SERVICIO Y DEVOLUCION (= CSYDV del XLSX)
  ('fixy', '42',  'en_transito', 'exact'),   -- Esperando Programación (= EPR)
  ('fixy', '135', 'en_sucursal', 'exact'),   -- REINGRESO A DEPOSITO (= RAD; rescatable)
  ('fixy', '52',  'en_transito', 'exact'),   -- Reprogramado por el comprador (sigue viniendo)
  ('fixy', '79',  'siniestro',   'exact')    -- Envío robado (= ROBO)
on conflict (courier, status_raw)
  do update set status_canonical = excluded.status_canonical, match_type = 'exact';

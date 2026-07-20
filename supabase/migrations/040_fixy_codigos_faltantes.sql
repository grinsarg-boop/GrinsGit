-- 040 — Mapear los 6 códigos numéricos de Fixy que faltaban (patrón 008/039: se completan
-- a medida que aparecen). Evidencia de prod (20/07/2026, raw.estado de seguimiento.json):
--   129 "EN DEPOSITO LISTO PARA DESPACHO"  → en_transito  (48 eventos; por salir, como el 42)
--   117 "REPACTADO LISTO PARA DESPACHO"    → en_transito  (repactado y por salir)
--   183 "Envio Reprogramado"               → en_transito  (sigue viniendo, como el 52)
--   48  "DIRECCION INCORRECTA O INCOMPLETA"→ incidencia
--   125 "Sin dinero"                       → incidencia   (COD fallido, puede reintentar)
--   144 "Gestionado Operativa"             → incidencia   (gestión activa de un problema; detalles
--                                                          varían: UBICADO / reprograma — conservador)
-- Impacto al aplicar: 1 sola guía con estado ACTUAL en estos códigos (un 48 → ya era
-- incidencia por default) → cero re-canonización necesaria; esto documenta y limpia el warning.
-- Verificación post-aplicar: select * from v_estados_sin_mapear;  -- debe quedar VACÍA (ya sin urbano ni fixy)

insert into courier_status_map (courier, status_raw, status_canonical, match_type) values
  ('fixy', '129', 'en_transito', 'exact'),
  ('fixy', '117', 'en_transito', 'exact'),
  ('fixy', '183', 'en_transito', 'exact'),
  ('fixy', '48',  'incidencia',  'exact'),
  ('fixy', '125', 'incidencia',  'exact'),
  ('fixy', '144', 'incidencia',  'exact')
on conflict (courier, status_raw)
  do update set status_canonical = excluded.status_canonical, match_type = 'exact';

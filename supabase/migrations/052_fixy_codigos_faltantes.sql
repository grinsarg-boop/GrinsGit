-- 052 — Mapear los 9 códigos numéricos de Fixy sin mapear (patrón 039/040). Doble hallazgo del 22/07:
-- (a) la 040 (que mapeaba 129/117/183/48/125/144) NUNCA se aplicó a prod — courier_status_map no tenía
--     ninguno de esos 6; la bitácora la daba por cerrada pero v_estados_sin_mapear los seguía mostrando.
-- (b) faltaban además 3 códigos que la 040 no cubría, con significado leído del raw.estado en prod:
--       116 "NO RETIRADO"                → incidencia
--       121 "Zona No Atendida"           → incidencia
--       145 "DIRECCION NO GEOLOCALIZADA" → incidencia   (mismo caso que el 48)
-- Esta migración es idempotente (ON CONFLICT DO UPDATE) y supersede a la 040 — cubre sus 6 códigos.
-- en_transito = sigue viniendo; incidencia = problema activo, no terminal (no toca el confirmado).
-- Impacto al aplicar: solo el código 48 tiene guías con estado ACTUAL (3); el resto ya se movió. Los 48
-- ya eran incidencia por el default de map_status → cero cambio de P&L; esto limpia el warning y documenta.
-- Verificación post-aplicar:
--   select * from v_estados_sin_mapear where courier='fixy';  -- debe dar 0 filas

insert into courier_status_map (courier, status_raw, status_canonical, match_type) values
  ('fixy', '129', 'en_transito', 'exact'),   -- EN DEPOSITO LISTO PARA DESPACHO
  ('fixy', '117', 'en_transito', 'exact'),   -- REPACTADO LISTO PARA DESPACHO
  ('fixy', '183', 'en_transito', 'exact'),   -- Envio Reprogramado
  ('fixy', '48',  'incidencia',  'exact'),   -- DIRECCION INCORRECTA O INCOMPLETA
  ('fixy', '125', 'incidencia',  'exact'),   -- Sin dinero
  ('fixy', '144', 'incidencia',  'exact'),   -- Gestionado Operativa
  ('fixy', '116', 'incidencia',  'exact'),   -- NO RETIRADO
  ('fixy', '121', 'incidencia',  'exact'),   -- Zona No Atendida
  ('fixy', '145', 'incidencia',  'exact')    -- DIRECCION NO GEOLOCALIZADA
on conflict (courier, status_raw)
  do update set status_canonical = excluded.status_canonical, match_type = 'exact';

-- Re-canonizar las guías cuyo estado ACTUAL cambia de canon (mismo patrón que 039/010; los eventos
-- históricos los pisa el próximo refresh del sync). Solo tocan las guías vivas: no terminales, no P&L.
update shipments set status_canonical = 'en_transito'
 where courier = 'fixy' and status_raw in ('129', '117', '183') and status_canonical <> 'en_transito';

update shipments set status_canonical = 'incidencia'
 where courier = 'fixy' and status_raw in ('48', '125', '144', '116', '121', '145')
   and status_canonical not in ('incidencia');

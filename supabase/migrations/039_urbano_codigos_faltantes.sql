-- 039 — Mapear los 8 códigos Urbano que faltaban (los 6 diferidos en 010 + XY/XX nuevos).
-- Evidencia de prod (20/07/2026, raw.descripcion del WS + historiales completos de las guías):
--   RD "Redespacho"                                → en_transito   (tras RD siguen CO/MA: vuelve al circuito; 20 eventos)
--   XX "La devolución fue anulada"                 → en_transito   (tras XX vuelve LD salida a ruta; 3 eventos)
--   XY "Será devuelto al remitente por rehúsa..."  → en_devolucion (mismo día le sigue DV; 2 eventos)
--   RS "Retiro Sucursal"                           → incidencia    (4/5 en flujo devolución pero 1/5 post-DL entregada: ambiguo → conservador)
--   PA "Pactó la visita para el día X"             → incidencia    (reintento pactado, misma familia que CA)
--   MR "Mal ruteo"                                 → incidencia
--   MD "Mal despacho"                              → incidencia
--   NC "Bulto Duplicado"                           → incidencia
-- Los 5 a incidencia no cambian comportamiento (era el default de map_status) pero documentan
-- la decisión y sacan el ruido de v_estados_sin_mapear. Impacto al aplicar: 10 guías con estos
-- códigos como estado ACTUAL; 4 cambian de canon (RD×3 + XX×1 → en_transito). El confirmado no
-- se toca (ninguno es terminal). Pendiente aparte: los 6 códigos numéricos de FIXY (129, 48,
-- 144, 125, 183, 117) siguen sin mapear.
-- Verificación post-aplicar:
--   select * from v_estados_sin_mapear where courier = 'urbano';  -- debe dar 0 filas
--   select status_raw, status_canonical, count(*) from shipments
--    where courier='urbano' and status_raw in ('RD','XX','XY') group by 1,2;

insert into courier_status_map (courier, status_raw, status_canonical, match_type) values
  ('urbano', 'RD', 'en_transito',   'exact'),
  ('urbano', 'XX', 'en_transito',   'exact'),
  ('urbano', 'XY', 'en_devolucion', 'exact'),
  ('urbano', 'RS', 'incidencia',    'exact'),
  ('urbano', 'PA', 'incidencia',    'exact'),
  ('urbano', 'MR', 'incidencia',    'exact'),
  ('urbano', 'MD', 'incidencia',    'exact'),
  ('urbano', 'NC', 'incidencia',    'exact')
on conflict (courier, status_raw)
  do update set status_canonical = excluded.status_canonical, match_type = 'exact';

-- Re-canonizar las guías cuyo estado ACTUAL cambia de canon (mismo patrón que 010;
-- los eventos históricos quedan: el próximo refresh del sync los pisa con el map nuevo).
update shipments set status_canonical = 'en_transito'
 where courier = 'urbano' and status_raw in ('RD', 'XX') and status_canonical <> 'en_transito';

update shipments set status_canonical = 'en_devolucion'
 where courier = 'urbano' and status_raw = 'XY' and status_canonical <> 'en_devolucion';

-- 010 — Mapear RA→entregado y RV→en_devolucion (info del Vault, Operaciones-COD 13/07; aprobado Pancho).
-- Eran 2 de los 8 códigos Urbano que caían a 'incidencia' sin mapear (RS, NC, RA, MR, RV, PA, MD, RD).
-- Evidencia verificada contra prod (14/07): RA → 20/20 guías tienen DL (entregada) en el historial →
-- RA es un estado de rendición POST-entrega. RV → 5/5 tienen DV (devolución) en el historial.
-- Los otros 6 (RS, NC, MR, PA, MD, RD) quedan en incidencia hasta que Urbano los aclare.

insert into courier_status_map (courier, status_raw, status_canonical, match_type) values
  ('urbano', 'RA', 'entregado',     'exact'),  -- rendición post-DL (100% con DL en historial)
  ('urbano', 'RV', 'en_devolucion', 'exact')   -- rendición de devolución (100% con DV en historial)
on conflict (courier, status_raw)
  do update set status_canonical = excluded.status_canonical, match_type = 'exact';

-- Re-canonizar las guías ya existentes cuyo último estado es RA/RV (el map solo afecta upserts nuevos).
update shipments
   set status_canonical = 'entregado',
       resolved_at = coalesce(resolved_at, status_at)
 where courier = 'urbano' and status_raw = 'RA' and status_canonical <> 'entregado';

update shipments
   set status_canonical = 'en_devolucion'
 where courier = 'urbano' and status_raw = 'RV' and status_canonical <> 'en_devolucion';

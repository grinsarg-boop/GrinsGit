-- 055 — `EI` de Urbano NO es "en reparto": es ENTREGADO.
--
-- El código venía mapeado a 'en_reparto' desde el seed 005, por el nombre. La descripción que manda
-- el WS lo desmiente sin ambigüedad: **"El chofer informo la entrega de su envio"** (455 eventos, una
-- sola descripción distinta en toda la historia). La evidencia:
--   · 456 envíos pasaron por EI: 334 hoy figuran DL/entregado, 112 quedaron clavados en EI, 9 AR, 1 RM.
--   · De los 112 clavados, **109 tienen además un evento DL** ("Su envio fue entregado") y **NINGUNO**
--     tiene un solo evento de devolución (RC/RV/DV/RM). Los 3 sin DL son entregas de esta semana:
--     Urbano emite EI primero y DL después.
--   · 51 de ellos figuran cobrados en los resúmenes de rendición del 14 y 21/07 — Urbano nos giró la
--     plata de piezas que nuestro panel mostraba "en reparto", y 12 estaban listadas para RECLAMAR.
--
-- Por qué se quedaban clavados y no es un bug de la 019: la 019 hace ganar a `item.estado` (el estado
-- autoritativo) sobre el último movimiento, y funciona. El problema es que cuando ese estado autoritativo
-- ES "EI - ...", ganaba un código mal mapeado. Arreglar el mapa arregla el ingest y el histórico juntos:
-- map_status se consulta en cada upsert, así que esto sobrevive al re-sync sin override manual.
--
-- Impacto: 112 envíos, ~$5,5M de COD que estaban fuera del margen. Sube la tasa de entrega de Urbano
-- de junio-julio y vacía 9 falsos positivos de /trabados.

update courier_status_map
   set status_canonical = 'entregado'
 where courier = 'urbano' and match_type = 'exact' and status_raw = 'EI';

-- Re-canonizar lo ya guardado. Mismo criterio conservador que la 019: sólo movemos HACIA un estado
-- resuelto, nunca des-resolvemos algo cerrado. Idempotente.
update shipments s
   set status_canonical = 'entregado',
       resolved_at = coalesce(s.resolved_at, s.status_at),
       updated_at = now()
 where s.courier = 'urbano'
   and s.status_raw = 'EI'
   and s.status_canonical <> 'entregado';

-- El margen del día sale de daily_pnl: sin esto el panel sigue mostrando el viejo.
select recompute_daily_pnl(
  (select min(dispatched_at) from shipments where courier = 'urbano' and status_raw = 'EI'),
  current_date);

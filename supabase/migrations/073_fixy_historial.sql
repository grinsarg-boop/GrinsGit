-- 073 — Fixy: el historial completo, y el alta como ancla de despacho.
--
-- Causa raíz (lib/couriers/fixy.ts): `seguimiento.json` devuelve TODOS los eventos de la guía en
-- `guia.fechas[]` en CADA llamada, y el conector guardaba `fechas[0]` y tiraba el resto. Efecto: en
-- `shipment_events` quedaba un solo evento por guía — el estado que tenía el día en que el sync la
-- miró — y el evento de alta (41, el que ancla la cohorte de despacho) sobrevivía sólo por
-- coincidencia: 540 de 1660 guías, 32,5%. Medido contra prod el 13/08/2026.
--
-- Lo que NO era: la tasa de entrega por mes NO estaba mal. Anclando por el alta real de la API, la
-- serie da may 65,6% · jun 60,8% · jul 67,1% (sobre cerradas), idéntica a la que ya mostraba el
-- panel: `dispatched_at` venía del XLSX, cuya fecha resultó ser la del alta. De 1565 guías con
-- respuesta, el ancla se mueve en 36 (1-4 días antes) — más las 40 del punto (b). El fix compra
-- trazabilidad (14.184 eventos de mayo a agosto en vez de 1.660) y un ancla que ya no depende de
-- cuándo corrió el sync; no corrige ningún número del panel.
--
-- El backfill lo hace `scripts/backfill-fixy-historial.mts` (la API sigue devolviendo la historia
-- vieja: el fix es retroactivo). Orden: aplicar esta migración PRIMERO, después correr el script en
-- `run` — él re-ancla `dispatched_at` guía por guía vía el RPC y recomputa el P&L.

-- ============ a. Códigos que faltaban en el mapa ============
-- Con un solo evento por guía casi no se veían; con el historial entran los 27 códigos que Fixy usó
-- de mayo a agosto. 104 es el que importa: es una devolución que hoy cae a 'incidencia' por defecto.
insert into courier_status_map (courier, status_raw, status_canonical, match_type) values
  ('fixy', '104', 'devuelto',    'exact'),   -- DEVOLUCION DE MERCADERIA A LA EMPRESA sin cobrar servicio (hermano de 139)
  ('fixy', '182', 'entregado',   'exact'),   -- RETIRA POR DEPOSITO: el cliente lo retira, el COD se cobra
  ('fixy', '126', 'en_transito', 'exact'),   -- Reprogramado por mal clima
  ('fixy', '64',  'incidencia',  'exact'),   -- FALLA MECANICA (= 9WVR- del XLSX)
  ('fixy', '82',  'incidencia',  'exact')    -- Paquete dañado o incompleto
on conflict (courier, status_raw)
  do update set status_canonical = excluded.status_canonical, match_type = 'exact';

-- ============ b. Chau el evento 41 sintético ============
-- `fixy-discover.ts` inventaba un evento 41 con el created_at del PEDIDO para tener un ancla de
-- despacho cuando la API "sólo daba el estado actual". Era el parche de este mismo bug: ahora el 41
-- real viene siempre. Y anclaba mal — el pedido entra antes de que se registre la guía: de las 183
-- guías con evento sintético, 40 quedaron fechadas 1-2 días ANTES del despacho real.
-- El backfill re-ancla: `dispatched_at = min(occurred_at)` de los eventos 'despachado' que queden.
delete from shipment_events e
using shipments s
where s.id = e.shipment_id and s.courier = 'fixy'
  and e.status_raw = '41' and e.raw->>'synth' = 'true';

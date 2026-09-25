-- 098 · Fixy 182 "RETIRA POR DEPOSITO" no es una entrega: es la guía esperando en el depósito.
--
-- La 073 lo mapeó a 'entregado' ("el cliente lo retira, el COD se cobra"), pero el 182 dice que el
-- paquete quedó en el depósito para que el cliente lo vaya a buscar, y puede no ir nunca. Las 3 guías
-- de Fixy que alguna vez tuvieron un 182 terminaron devueltas, ninguna entregada (medido 25/09/2026
-- contra prod, solo lectura):
--   1615636 y 1616609 (mayo): 144 → 182 → 139 "PLAZO DE RETIRO VENCIDO" → 184 "DEVOLUCIÓN ENTREGADA".
--   1775822 (#20246, $59.980): 182 el 25/08 → 139 el 02/09 → 139 "RENDICION AL CLIENTE" el 04/09 →
--   184 el 11/09 según la API. En la base sigue 'entregado' con status_raw 182 desde el 25/08.
--
-- Por qué quedó congelada: el sync deja de consultar una guía apenas llega a un estado terminal
-- (lib/couriers/sync.ts, TERMINALES), así que después del 182 no volvió a leer sus eventos.
--
-- 'en_sucursal' es el canónico del 135 "REINGRESO A DEPOSITO" (008) y de la guarda de Urbano (SP):
-- no terminal, el sync la sigue mirando hasta que llegue la entrega o la devolución.

insert into courier_status_map (courier, status_raw, status_canonical, match_type) values
  ('fixy', '182', 'en_sucursal', 'exact')   -- RETIRA POR DEPOSITO: espera en el depósito a que la retiren
on conflict (courier, status_raw)
  do update set status_canonical = excluded.status_canonical, match_type = 'exact';

-- El canónico de los eventos se calcula al leer (072/077), pero el de shipments se guarda en cada
-- upsert y el sync ya no vuelve sobre las terminales: corregir el mapa no alcanza. Hoy es solo la
-- 1775822, despachada el 18/08: entra en la ventana de 60 d del sync hasta el 17/10. Sin tocar
-- updated_at: es la más stale de la cola, así que la próxima corrida de Fixy la refresca, graba el
-- 139/184 y el recompute del sync corrige el P&L del pedido.
update shipments set status_canonical = map_status(courier, status_raw), resolved_at = null
 where courier = 'fixy' and status_raw = '182';

-- 094 · Índices para estimate_urbano_freight: el estimado de flete tiraba el sync de Urbano y el P&L.
--
-- estimate_urbano_freight corre UNA VEZ POR GUÍA: en recompute_daily_pnl sobre todas las Urbano sin
-- tarifa del rango (5.249 en 60 d) y al final de cada upsert_shipment_events. Sus dos subconsultas
-- (`courier='urbano' and freight_tarifa is not null and dispatched_at >= hoy-60`, con y sin provincia)
-- solo tenían shipments_dispatched_idx: recorrían las ~7k guías de la ventana para descartarlas todas.
-- Medido en prod el 23/09/2026: 6 ms por llamada → ~30 s el recompute de 60 d, ~1,2 s por tanda de
-- 200 guías del upsert. El `statement_timeout` de 8 s de PostgREST (authenticator) los cortaba:
-- el sync de Urbano fallaba en 77-91% de las corridas desde el 20/09 y el recompute de 60 d no
-- terminaba desde el ~16/09, sin que nadie leyera el error (P&L de cohortes congelado).
--
-- Corrige a la 083, que decía que vaciar la ventana (última tarifa real 30/06) "no rompe nada
-- visible": al vaciarse, la primera rama del coalesce vuelve null y se evalúa también la segunda,
-- así que cada llamada pasó a costar el doble.
--
-- Parciales: solo indexan las guías con tarifa real (4.251 hoy, 0 dentro de la ventana), así que
-- cada llamada son dos sondas de índice. (province, dispatched_at) atiende la rama por provincia
-- cuando se importe la facturación; (dispatched_at) atiende la global.
create index if not exists shipments_urbano_tarifa_prov_idx
  on shipments (province, dispatched_at) where courier = 'urbano' and freight_tarifa is not null;
create index if not exists shipments_urbano_tarifa_idx
  on shipments (dispatched_at) where courier = 'urbano' and freight_tarifa is not null;

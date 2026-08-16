-- 076: `shipment_events.status_canonical` se saca del schema — drift que dejaba rojo a test:db.
--
-- La columna NO existe en prod: se dropeó a mano, fuera de migraciones (ninguna la dropea).
-- La 074 está escrita contra ese schema real — inserta sin ella y deriva el canónico con
-- `map_status(courier, status_raw)` — así que prod funciona. Lo desactualizado era la base que
-- arman las migraciones: la 001 todavía declara la columna `not null` sin default, y en el
-- Postgres embebido de test:db el insert de la 074 violaba el not-null. Resultado: el candado
-- que la regla del proyecto exige verde ANTES de aplicar cualquier migración llevaba días
-- inutilizable.
--
-- Verificado antes de dropear: la única función que la leía o escribía era
-- `upsert_shipment_events` (001, 002, 003, 006), y su definición VIVA es la de la 074, que ya
-- no la toca. Ninguna vista, ninguna otra función y ningún código de app o scripts la
-- referencian — todo el resto de los `status_canonical` del repo son de `shipments` o de
-- `courier_status_map`, que sí la tienen y no se tocan acá.
--
-- No-op en prod (`if exists`); en la base del test alinea el schema con la realidad.

alter table shipment_events drop column if exists status_canonical;

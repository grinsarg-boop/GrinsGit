-- 101 · service_role: statement_timeout de 60 s. El recompute de 60 d del P&L no pasaba nunca.
--
-- `authenticator` trae statement_timeout=8s (y lock_timeout=8s) y `service_role` no tiene config
-- propia, así que el backend (syncs, crons, admin) heredaba el techo de 8 s pensado para
-- anon/authenticated. Medido el 25/09/2026 (solo lectura): `recompute_daily_pnl` de 60 d se cortó en
-- el 100% de las corridas de 24 h (93/93 de Fixy, 97/97 de Urbano), y la ventana de 60 d de
-- `daily_pnl` no se recalculaba entera desde el 24/09 15:11 ART. El panel de Ventas no lo sufría
-- para Fixy/Urbano (`sales_rows` lee `shipments` en vivo), pero Correo, ML y el P&L por despacho sí.
--
-- PostgREST aplica en cada request la config del rol que impersona; el notify la recarga sin
-- reiniciar. Solo toca la clave backend: anon (3 s) y authenticated (8 s) quedan igual, y
-- lock_timeout sigue heredado en 8 s. Aprobado por Pancho el 26/09/2026. Para volver atrás:
--   alter role service_role reset statement_timeout; notify pgrst, 'reload config';

alter role service_role set statement_timeout = '60s';
notify pgrst, 'reload config';

-- 058 — Cerrar `schema_migrations`, la única tabla sin RLS del proyecto (alerta CRITICAL de Supabase,
-- "rls_disabled_in_public", 26/07/2026).
--
-- Origen: la creó `scripts/db-apply.mjs` con un `create table if not exists` pelado, y Supabase le da
-- por defecto CRUD completo a `anon` sobre toda tabla nueva de `public`. Verificado contra la API con
-- la anon key (la que viaja en el bundle del navegador): lectura 200 con filas, e INSERT 201 — o sea
-- era un endpoint de ESCRITURA sin autenticar contra la base de producción.
--
-- Alcance real, medido tabla por tabla antes de tocar nada: `orders`, `shipments`, `daily_pnl`,
-- `mp_payments` y `chat_messages` devuelven 0 filas a anon. La exposición era SOLO esta tabla —
-- 52 nombres de archivo y fechas, sin dato de cliente. El riesgo no era la lectura sino la escritura:
-- borrando filas acá, un `db-apply` posterior re-aplicaría migraciones ya aplicadas (y la 001 inserta
-- productos sin `on conflict`, así que duplicaría).
--
-- Nadie necesita esta tabla desde la API: `db-apply.mjs` entra por DATABASE_URL como `postgres`, que
-- es dueño de la tabla y saltea RLS. Por eso se cierra sin política: RLS activa + cero grants.

-- El `create` va acá para que la migración corra sola contra una base limpia (así entra en test:db);
-- en prod la tabla ya existe y esta línea no hace nada.
create table if not exists schema_migrations (
  filename   text primary key,
  applied_at timestamptz not null default now()
);
alter table schema_migrations enable row level security;
revoke all on table schema_migrations from anon, authenticated;

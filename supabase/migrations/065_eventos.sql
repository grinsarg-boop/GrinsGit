-- F1-14 (+ F1-10) · Eventos anotados sobre las series temporales.
--
-- Un pozo en una curva es un misterio dentro de tres meses. Hoy los blackouts viven en el vault
-- (la caída de Shopify del 30/07, la barrida de ANMAT del 11/03) y en la cabeza de quien estaba ese
-- día; el panel los dibuja como si fueran performance. Esto los convierte en dato del panel: marca
-- punteada sobre los gráficos y, cuando el evento es una FRANJA, un aviso arriba de las tablas cuyo
-- rango la cruza.
--
-- F1-10 pedía una franja hardcodeada de "dato no comparable" para el ×3 de `purchases`. Es el mismo
-- mecanismo con una fila más, así que no hay dos features: hay una tabla y un seed. Un período no
-- comparable es un evento con fecha_fin, y el que venga después (otra rotación de cuenta, otro
-- apagón) se carga desde /config sin tocar código.
create table if not exists eventos (
  id bigint generated always as identity primary key,
  fecha date not null,
  fecha_fin date,                          -- null = evento puntual; con fecha_fin es una franja
  texto text not null,
  creado_at timestamptz not null default now(),
  unique (fecha, texto),
  constraint eventos_rango_valido check (fecha_fin is null or fecha_fin >= fecha)
);

create index if not exists eventos_fecha_idx on eventos (fecha);

-- Supabase le da CRUD completo a `anon` sobre cualquier tabla nueva de public: sin esto queda un
-- endpoint de escritura sin autenticar (alerta CRITICAL del 26/07). La app escribe con service_role.
alter table eventos enable row level security;
revoke all on table eventos from anon, authenticated;

-- Seed de lo que ya sabemos y estaba solo en el vault. Idempotente por (fecha, texto).
insert into eventos (fecha, fecha_fin, texto) values
  ('2026-05-01', '2026-07-22',
   'Dato de Meta no comparable: `purchases` venía ×3 (Meta repite el mismo número bajo 8 action_types y se sumaban tres). Se arregló el 22/07 y el histórico NO se backfilleó. El CPA y el ROAS de este panel no están tocados —salen de nuestras propias órdenes, no de purchases— pero cualquier número leído desde Meta o desde AppAds en este período está inflado.'),
  ('2026-07-30', null,
   'Caída de Shopify: pedidos perdidos durante el corte. El día arranca contaminado y no compara contra los de al lado.'),
  ('2026-03-11', null,
   'Barrida de ANMAT: se pausó pauta y despacho.')
on conflict (fecha, texto) do nothing;

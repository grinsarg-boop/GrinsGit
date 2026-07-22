-- 053 — Asistente in-app: historial de chat persistido (multi-sesión, sobrevive al reload).
-- Lo escribe/lee el route /api/chat con service_role (bypassa RLS). RLS igual habilitada como
-- defensa en profundidad: app single-tenant (ALLOWED_EMAILS = sólo el dueño), mismo criterio que
-- ml_orders (020) — el usuario autenticado ve todo; si algún día se vuelve multi-user, cambiar la
-- policy a `using (user_email = auth.jwt()->>'email')`.
create table if not exists chat_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_email text,                                  -- quién la creó (para futuro multi-user)
  title      text,                                  -- primer mensaje recortado; se muestra en la lista
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()     -- se bump-ea en cada mensaje → ordena la lista
);

create table if not exists chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,                         -- texto plano (el reply del modelo, ya sin bloques de tool)
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_session_idx on chat_messages (session_id, created_at);
create index if not exists chat_sessions_updated_idx on chat_sessions (updated_at desc);

alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
drop policy if exists chat_sessions_rw on chat_sessions;
create policy chat_sessions_rw on chat_sessions for all to authenticated using (true) with check (true);
drop policy if exists chat_messages_rw on chat_messages;
create policy chat_messages_rw on chat_messages for all to authenticated using (true) with check (true);

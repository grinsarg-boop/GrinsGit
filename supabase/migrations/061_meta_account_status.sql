-- 061 — Vigía del account_status de las cuentas de Meta. No existía ninguno: los monitores eran
-- /api/monitor/ad-review (ads) y /api/salud/cajas (ML), y enterarse tarde era el default.
--
-- Medido el 30/07 con el conector de Meta Ads: de 54 cuentas visibles, 11 UNSETTLED y 10 DISABLED,
-- y TODA la operación cuelga de una sola ACTIVE (1569698667101520, ~$193k ARS/día). Ya estaba
-- anotado como "la mejora pendiente más útil" en Playbook-Contingencia §6.
--
-- Lo que se alerta es la TRANSICIÓN, no el estado:
--   UNSETTLED — saldo impago. NO es sanción: se paga y vuelve. Quemar una cuenta de respaldo por un
--               UNSETTLED es el error caro del playbook.
--   DISABLED  — baneo de verdad. Ahí sí se rota.
-- Por eso la tabla guarda prev_status/changed_at: alertar por ESTADO mandaría un mail por hora hasta
-- que alguien lo resuelva — justo la fatiga de alerta que 059 vino a apagar.
create table if not exists meta_account_status (
  account_id  text primary key,                      -- act_… tal cual lo devuelve resolveAccounts()
  name        text,
  status      text not null,                         -- ACTIVE | UNSETTLED | DISABLED | …
  status_code int,                                   -- el entero crudo de Meta (1/2/3/…)
  prev_status text,                                  -- null = nunca cambió desde que lo vemos
  changed_at  timestamptz not null default now(),    -- cuándo cambió (NO se mueve si el estado sigue igual)
  seen_at     timestamptz not null default now()     -- último polling
);

alter table meta_account_status enable row level security;
drop policy if exists meta_account_status_rw on meta_account_status;
create policy meta_account_status_rw on meta_account_status for all to authenticated using (true) with check (true);

-- p = jsonb array de {account_id, name, status, status_code}. Idempotente: correrlo dos veces
-- seguidas no inventa un cambio. Devuelve la foto completa — quién alerta lo decide
-- /api/salud/cuentas mirando prev_status + changed_at.
drop function if exists sync_meta_account_status(jsonb);
create or replace function sync_meta_account_status(p jsonb)
returns table (account_id text, name text, status text, prev_status text, changed_at timestamptz)
language plpgsql as $$
#variable_conflict use_column
begin
  insert into meta_account_status as t (account_id, name, status, status_code)
  select x->>'account_id', x->>'name', x->>'status', (x->>'status_code')::int
  from jsonb_array_elements(coalesce(p, '[]'::jsonb)) x
  on conflict (account_id) do update set
    name        = excluded.name,
    status      = excluded.status,
    status_code = excluded.status_code,
    seen_at     = now(),
    prev_status = case when t.status is distinct from excluded.status then t.status else t.prev_status end,
    changed_at  = case when t.status is distinct from excluded.status then now() else t.changed_at end;

  return query
    select t.account_id, t.name, t.status, t.prev_status, t.changed_at
    from meta_account_status t order by t.status, t.account_id;
end $$;

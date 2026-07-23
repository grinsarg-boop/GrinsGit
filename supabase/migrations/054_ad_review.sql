-- 054 — Monitor de estado de revisión de ads (keep-alive R3 + la cuenta principal R2). Polling barato:
-- /api/monitor/ad-review llama fetchAdReviewIssues() por cuenta y vuelca acá los DISAPPROVED/WITH_ISSUES
-- vía sync_ad_review_issues(): upsert de los vigentes + marca resolved los que se recuperaron o se
-- borraron. El panel y el bot leen `where resolved_at is null` = ads con problema AHORA. Sin push: la
-- tabla ES el canal (misma idea que el estado compartido con el bot de WhatsApp). RLS server-only + read auth.
create table if not exists ad_review_issues (
  ad_id            text primary key,                   -- ad_id de Meta (único global)
  account_id       text not null,                      -- act_… donde vive
  ad_name          text,
  adset_name       text,
  campaign_name    text,
  effective_status text not null,                      -- DISAPPROVED | WITH_ISSUES
  first_seen_at    timestamptz not null default now(), -- cuándo apareció el problema
  last_seen_at     timestamptz not null default now(), -- último polling que lo vio con problema
  resolved_at      timestamptz                         -- null = sigue roto; set = aprobado de nuevo o borrado
);
create index if not exists ad_review_open_idx on ad_review_issues (account_id) where resolved_at is null;

alter table ad_review_issues enable row level security;
drop policy if exists ad_review_issues_rw on ad_review_issues;
create policy ad_review_issues_rw on ad_review_issues for all to authenticated using (true) with check (true);

-- Sincroniza los problemas de UNA cuenta contra lo que Meta reporta ahora. p = jsonb array de
-- {ad_id, ad_name, adset_name, campaign_name, effective_status}. Idempotente. Devuelve los abiertos.
drop function if exists sync_ad_review_issues(text, jsonb);
create or replace function sync_ad_review_issues(p_account text, p jsonb)
returns table (ad_id text, ad_name text, campaign_name text, effective_status text, first_seen_at timestamptz)
language plpgsql as $$
#variable_conflict use_column
begin
  -- upsert de los que hoy tienen problema (re-abre si estaba resuelto, conserva first_seen_at)
  insert into ad_review_issues as t
    (ad_id, account_id, ad_name, adset_name, campaign_name, effective_status, last_seen_at, resolved_at)
  select x->>'ad_id', p_account, x->>'ad_name', x->>'adset_name', x->>'campaign_name',
         x->>'effective_status', now(), null
  from jsonb_array_elements(coalesce(p, '[]'::jsonb)) x
  on conflict (ad_id) do update set
    account_id = excluded.account_id, ad_name = excluded.ad_name, adset_name = excluded.adset_name,
    campaign_name = excluded.campaign_name, effective_status = excluded.effective_status,
    last_seen_at = now(), resolved_at = null;

  -- los que estaban abiertos en esta cuenta y ya no aparecen → resueltos
  update ad_review_issues t set resolved_at = now()
  where t.account_id = p_account and t.resolved_at is null
    and not exists (select 1 from jsonb_array_elements(coalesce(p, '[]'::jsonb)) x
                     where x->>'ad_id' = t.ad_id);

  return query
    select t.ad_id, t.ad_name, t.campaign_name, t.effective_status, t.first_seen_at
    from ad_review_issues t
    where t.account_id = p_account and t.resolved_at is null
    order by t.first_seen_at desc;
end $$;

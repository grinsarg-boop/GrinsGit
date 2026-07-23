-- ad_review_check — sync_ad_review_issues: upsert + resolve + reopen (idempotente por cuenta).
begin;

-- run 1: dos ads con problema
select sync_ad_review_issues('act_TEST', '[
  {"ad_id":"1","ad_name":"a","adset_name":"s","campaign_name":"c","effective_status":"DISAPPROVED"},
  {"ad_id":"2","ad_name":"b","adset_name":"s","campaign_name":"c","effective_status":"WITH_ISSUES"}
]'::jsonb);
do $$ begin
  assert (select count(*) from ad_review_issues where resolved_at is null) = 2, 'run1: 2 abiertos';
end $$;

-- run 2: el 1 se recuperó (ya no viene), el 2 sigue, aparece el 3
select sync_ad_review_issues('act_TEST', '[
  {"ad_id":"2","ad_name":"b","adset_name":"s","campaign_name":"c","effective_status":"WITH_ISSUES"},
  {"ad_id":"3","ad_name":"d","adset_name":"s","campaign_name":"c","effective_status":"DISAPPROVED"}
]'::jsonb);
do $$ begin
  assert (select resolved_at is not null from ad_review_issues where ad_id = '1'), 'run2: ad 1 resuelto';
  assert (select count(*) from ad_review_issues where resolved_at is null) = 2, 'run2: 2 abiertos (2 y 3)';
  assert (select count(*) from ad_review_issues) = 3, 'run2: 3 filas totales';
end $$;

-- run 3: forzamos un first_seen_at viejo; el 1 se rompe de nuevo → reabre CONSERVANDO first_seen_at;
-- 2 y 3 ya no vienen → resueltos. (now() es constante dentro de la txn, por eso probamos con un literal.)
update ad_review_issues set first_seen_at = timestamptz '2020-01-01' where ad_id = '1';
select sync_ad_review_issues('act_TEST', '[
  {"ad_id":"1","ad_name":"a","adset_name":"s","campaign_name":"c","effective_status":"DISAPPROVED"}
]'::jsonb);
do $$ begin
  assert (select resolved_at is null from ad_review_issues where ad_id = '1'), 'run3: ad 1 reabierto';
  assert (select resolved_at is not null from ad_review_issues where ad_id = '2'), 'run3: ad 2 resuelto';
  assert (select first_seen_at = timestamptz '2020-01-01' from ad_review_issues where ad_id = '1'), 'run3: conserva first_seen_at';
end $$;

rollback;

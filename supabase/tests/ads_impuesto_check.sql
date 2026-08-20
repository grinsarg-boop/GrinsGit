-- ads_impuesto_check.sql (078): el impuesto de la tarjeta se aplica POR CUENTA y desde su fecha.
-- Si esto se cae, el P&L vuelve a contar la pauta de Meta a valor nominal (margen COD 39,0%
-- reportado cuando es 32,9%) o —peor— se lo cobra a la cuenta equivocada.
begin;

do $t$
declare r record; v_taxed text := 'act_1569698667101520'; v_otra text := 'act_880189106877616';
begin
  insert into ad_spend (date, ad_id, ad_name, campaign_name, spend, purchases, account_id) values
    ('2026-08-10', 'T1', 'x', 'y', 100000, 0, v_taxed),   -- con impuesto
    ('2026-08-06', 'T2', 'x', 'y', 100000, 0, v_taxed),   -- un día antes de la vigencia
    ('2026-08-10', 'T3', 'x', 'y', 100000, 0, v_otra),    -- otra cuenta, sin impuesto
    ('2026-08-10', 'T4', 'x', 'y', 100000, 0, null);      -- sin backfill de cuenta

  select * into r from v_ad_spend where ad_id = 'T1';
  assert r.spend_real = 136400, '078: R3 desde el 07/08 va × 1,364 (dio ' || r.spend_real || ')';

  select * into r from v_ad_spend where ad_id = 'T2';
  assert r.spend_real = 100000, '078: antes del 07/08 NO lleva impuesto';

  select * into r from v_ad_spend where ad_id = 'T3';
  assert r.spend_real = 100000, '078: el impuesto es de R3, no de las otras cuentas';

  select * into r from v_ad_spend where ad_id = 'T4';
  assert r.spend_real = 100000, '078: sin account_id el factor es 1, no se inventa impuesto';

  -- El upsert del sync tiene que persistir la cuenta, si no la vista no puede distinguirlas.
  perform upsert_ad_spend('[{"date":"2026-08-11","ad_id":"T5","ad_name":"x","adset_name":"z",
    "campaign_name":"y","spend":1000,"purchases":0,"account_id":"act_1569698667101520"}]'::jsonb);
  select * into r from v_ad_spend where ad_id = 'T5';
  assert r.account_id = v_taxed, '078: upsert_ad_spend guarda account_id';
  assert r.spend_real = 1364, '078: el spend del sync ya sale con impuesto';

  -- Un re-sync viejo (sin account_id en el payload) no puede borrar la cuenta ya guardada.
  perform upsert_ad_spend('[{"date":"2026-08-11","ad_id":"T5","ad_name":"x","adset_name":"z",
    "campaign_name":"y","spend":1000,"purchases":0}]'::jsonb);
  select * into r from v_ad_spend where ad_id = 'T5';
  assert r.account_id = v_taxed, '078: un payload sin cuenta no pisa la que ya estaba';

  raise notice '078 ads-impuesto: OK';
end $t$;

rollback;

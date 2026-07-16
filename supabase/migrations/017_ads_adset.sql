-- Nivel de conjunto (adset) en Ads: la página del día despliega Campaña → Conjunto → Anuncio.
-- El sync de Meta ahora trae adset_name (level=ad ya lo expone). Columna nullable → los datos
-- viejos quedan sin conjunto hasta el próximo sync, que reescribe los últimos 3 días (§5.3).
alter table ad_spend add column if not exists adset_name text;

-- p = array {date, ad_id, ad_name, adset_name, campaign_name, spend, purchases} (§5.3)
create or replace function upsert_ad_spend(p jsonb) returns int
language plpgsql as $fn$
declare v_count int;
begin
  insert into ad_spend (date, ad_id, ad_name, adset_name, campaign_name, spend, purchases, product_id)
  select (x->>'date')::date, x->>'ad_id', x->>'ad_name', x->>'adset_name', x->>'campaign_name',
         coalesce((x->>'spend')::numeric, 0), coalesce((x->>'purchases')::int, 0),
         match_product(coalesce(x->>'ad_name', '') || ' ' || coalesce(x->>'campaign_name', ''))
  from jsonb_array_elements(p) x
  on conflict (date, ad_id) do update set
    ad_name = excluded.ad_name, adset_name = excluded.adset_name, campaign_name = excluded.campaign_name,
    spend = excluded.spend, purchases = excluded.purchases,
    -- product_locked = override manual, el sync no lo pisa (§5.3)
    product_id = case when ad_spend.product_locked then ad_spend.product_id
                      else excluded.product_id end;
  get diagnostics v_count = row_count;
  return v_count;
end $fn$;

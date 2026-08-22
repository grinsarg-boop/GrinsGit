-- ads_sin_dueno_check.sql (081) — INVARIANTE: sales_rows imputa el 100% de la pauta de Meta.
-- Si esto se cae, hay gasto real que no es costo de nadie y el profit vuelve a inventar plata
-- ($910.338 en 5 días, 17→21/08/2026, por 41 anuncios de un producto que dejó de vender).
begin;

update settings set value = '0' where key = 'ml_ads_iva';
delete from product_costs;
insert into product_costs (product_id, pack, unit_cost, is_estimated)
select id, 1, 5000, false from products where name in ('Natures', 'Pureza');

do $t$
declare
  dv  date := current_date - 9;    -- día de VENTA
  dd  date := current_date - 7;    -- día de DESPACHO
  s_ads numeric; s_sin numeric; total numeric;
  ads_nat numeric; ads_pur numeric; d_ads numeric;
begin
  -- 3 ventas de Natures + 1 de Pureza el día d (todas Córdoba → urbano, todas despachadas).
  for i in 0..2 loop
    perform upsert_order(jsonb_build_object('id', 8100 + i, 'name', '#' || (8100 + i),
      'created_at', dv::text || 'T12:00:00-03:00', 'financial_status', 'pending', 'tags', '',
      'total_price', '40000',
      'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
      'line_items', '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb));
  end loop;
  perform upsert_order(jsonb_build_object('id', 8110, 'name', '#8110',
    'created_at', dv::text || 'T12:00:00-03:00', 'financial_status', 'pending', 'tags', '',
    'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items', '[{"title":"Pureza","quantity":1,"price":"40000"}]'::jsonb));

  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','urbano','tracking','N0','order_ref','8100','status_raw','MA','occurred_at', dd::text || 'T08:00:00Z','tarifa',5000),
    jsonb_build_object('courier','urbano','tracking','N1','order_ref','8101','status_raw','MA','occurred_at', dd::text || 'T08:00:00Z','tarifa',5000),
    jsonb_build_object('courier','urbano','tracking','N2','order_ref','8102','status_raw','MA','occurred_at', dd::text || 'T08:00:00Z','tarifa',5000),
    jsonb_build_object('courier','urbano','tracking','N3','order_ref','8110','status_raw','MA','occurred_at', dd::text || 'T08:00:00Z','tarifa',5000)));

  -- Pauta del día: $20.000 con dueño (Natures vende) + $8.000 de un producto que NO vendió
  -- (el caso Natures→PurezaDrops) + $4.000 que el matcher no pudo etiquetar.
  perform upsert_ad_spend(jsonb_build_array(
    jsonb_build_object('date', dv, 'ad_id','h1','ad_name','Natures - hook','campaign_name','NATURES','spend',20000,'purchases',3),
    jsonb_build_object('date', dv, 'ad_id','h2','ad_name','Veinguard - hook','campaign_name','VEINGUARD','spend',8000,'purchases',0),
    jsonb_build_object('date', dv, 'ad_id','h3','ad_name','remarketing broad','campaign_name','RMKT','spend',4000,'purchases',0)));
  perform recompute_daily_pnl(dv, current_date);

  select sum(spend_real) into total from v_ad_spend where date = dv;
  assert total = 32000, format('081: el fixture gasta 32.000 (got %s)', total);

  select ads, ads_sin_cohorte into s_ads, s_sin from sales_days(dv, null) where sale_date = dv;

  -- (1) El invariante. Antes del fix daba 20.000 y los otros 12.000 no eran costo de nadie.
  assert round(s_ads, 2) = total,
    format('081: sales_rows tiene que imputar TODA la pauta del día (imputó %s de %s)', s_ads, total);
  assert round(s_sin, 2) = 0,
    format('081: con la pauta sin dueño repartida, ads_sin_cohorte es 0 (got %s)', s_sin);

  -- (2) El reparto por default va por pedidos generados: Natures 3 de 4, Pureza 1 de 4.
  --     Natures: 20.000 propios + 3/4 × 12.000 = 29.000. Pureza: 1/4 × 12.000 = 3.000.
  select sum(ads) into ads_nat from sales_rows(dv)
   where d = dv and p = (select id from products where name = 'Natures') and c <> 'ml';
  select sum(ads) into ads_pur from sales_rows(dv)
   where d = dv and p = (select id from products where name = 'Pureza') and c <> 'ml';
  assert round(ads_nat, 2) = 29000,
    format('081: Natures = 20.000 propios + 3/4 de los 12.000 huérfanos = 29.000 (got %s)', ads_nat);
  assert round(ads_pur, 2) = 3000,
    format('081: Pureza no tuvo anuncio propio pero absorbe 1/4 de los huérfanos = 3.000 (got %s)', ads_pur);

  -- (3) Mismo invariante en recompute_daily_pnl, que traía su propia copia del join roto.
  select coalesce(sum(ads), 0) into d_ads from daily_pnl
   where dispatch_date between dv and current_date and courier <> 'ml';
  assert round(d_ads, 2) = total,
    format('081: daily_pnl también imputa toda la pauta del período (imputó %s de %s)', d_ads, total);

  raise notice '081 ads sin dueño (invariante 100%% imputado): OK';
end $t$;

rollback;

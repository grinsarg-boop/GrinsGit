-- anuncios_check.sql (051): la venta cruza con su anuncio por utm_content = ad_spend.ad_id.
-- Prueba las tres ramas: (a) pedido con ad conocido → entregada + gasto; (b) ad_id fuera de ad_spend
-- → cubo sin atribución (ad_id NULL); (c) ad que gastó con 0 pedidos → aparece igual (FULL OUTER JOIN).
begin;

do $t$
declare
  d date := current_date - 300;   -- lejos de cualquier cohorte real: maduración no interfiere
  r_ad1 record; r_bucket record; r_ad2 record;
begin
  insert into ad_spend (date, ad_id, ad_name, adset_name, campaign_name, spend, purchases) values
    (d, 'AD1', 'ad-uno', 'conjunto-uno', 'campania-uno', 10000, 3),
    (d, 'AD2', 'ad-dos', 'conjunto-uno', 'campania-uno',  7000, 0);   -- gasta pero sin pedidos

  -- (a) pedido atribuido a AD1, entregado, COD 50.000
  insert into orders (shopify_id, order_number, created_at, courier, total, cod_amount, raw) values
    (900000001, 'T1', (d::text||'T12:00:00-03:00')::timestamptz, 'urbano', 50000, 50000,
     '{"note_attributes":[{"name":"utm_content","value":"AD1"},{"name":"utm_campaign","value":"C1"}]}');
  insert into shipments (courier, tracking, order_id, order_ref, province, dispatched_at, status_raw, status_canonical, freight_cost)
    select 'urbano', 'TRK1', id, 'T1', 'Córdoba', d + 1, 'D', 'entregado', 3000 from orders where shopify_id = 900000001;

  -- (b) pedido con ad_id que NO está en ad_spend → cubo sin atribución
  insert into orders (shopify_id, order_number, created_at, courier, total, cod_amount, raw) values
    (900000002, 'T2', (d::text||'T12:00:00-03:00')::timestamptz, 'urbano', 40000, 40000,
     '{"note_attributes":[{"name":"utm_content","value":"ZZZ_desconocido"}]}');
  insert into shipments (courier, tracking, order_id, order_ref, province, dispatched_at, status_raw, status_canonical, freight_cost)
    select 'urbano', 'TRK2', id, 'T2', 'Córdoba', d + 1, 'RH', 'devuelto', 3000 from orders where shopify_id = 900000002;

  select * into r_ad1    from anuncios_pnl(d, d) where ad_id = 'AD1';
  select * into r_ad2    from anuncios_pnl(d, d) where ad_id = 'AD2';
  select * into r_bucket from anuncios_pnl(d, d) where ad_id is null;

  assert r_ad1.campaign_name = 'campania-uno', '051: AD1 trae nombre de campaña de ad_spend';
  assert r_ad1.pedidos = 1 and r_ad1.entregadas = 1 and r_ad1.resueltas = 1, '051: AD1 = 1 pedido entregado';
  assert r_ad1.cod_cobrado = 50000, '051: AD1 cobra el COD de la entregada';
  assert r_ad1.spend = 10000, '051: AD1 suma el gasto del período';
  assert r_ad1.flete = 3000, '051: AD1 imputa el flete de la despachada';

  assert r_ad2.pedidos = 0 and r_ad2.spend = 7000, '051: AD2 gastó sin pedidos y aparece igual (full outer join)';

  assert r_bucket.pedidos = 1 and r_bucket.devueltas = 1, '051: el ad_id fuera de ad_spend cae en el cubo sin atribución';
  assert r_bucket.spend = 0, '051: el cubo sin atribución no tiene gasto';

  raise notice '051 anuncios: OK';
end $t$;

rollback;

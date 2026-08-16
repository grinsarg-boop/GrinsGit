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

-- 075: el pedido que entra SIN utm_content (todos desde el 13/07) se cruza por teléfono contra el
-- beacon del form. Prueba lo que puede fallar en silencio: la normalización del teléfono, la ventana,
-- y que note_attributes le siga ganando al beacon cuando están los dos.
do $t$
declare
  d date := current_date - 301;
  ts timestamptz := (d::text||'T12:00:00-03:00')::timestamptz;
  r_ad3 record; r_ad4 record; r_bucket record;
begin
  insert into ad_spend (date, ad_id, ad_name, adset_name, campaign_name, spend, purchases) values
    (d, 'AD3', 'ad-tres', 'conjunto-tres', 'campania-tres', 5000, 1),
    (d, 'AD4', 'ad-cuatro', 'conjunto-tres', 'campania-tres', 5000, 1);

  -- (d) sin note_attributes, teléfono guardado en formato internacional; el beacon lo mandó crudo.
  --     Los últimos 8 dígitos son los mismos: es toda la razón por la que el join va por la cola.
  insert into orders (shopify_id, order_number, created_at, phone, courier, total, cod_amount, raw) values
    (900000003, 'T3', ts, '+54 9 358 483-0882', 'urbano', 60000, 60000, '{}');
  insert into atribucion_form (phone, ad_id, created_at) values ('3584830882', 'AD3', ts - interval '10 min');
  insert into shipments (courier, tracking, order_id, order_ref, province, dispatched_at, status_raw, status_canonical, freight_cost)
    select 'urbano', 'TRK3', id, 'T3', 'Córdoba', d + 1, 'D', 'entregado', 3000 from orders where shopify_id = 900000003;

  -- (e) beacon del mismo teléfono pero 4 h antes: fuera de ventana, no atribuye.
  insert into orders (shopify_id, order_number, created_at, phone, courier, total, cod_amount, raw) values
    (900000004, 'T4', ts, '1155443322', 'urbano', 30000, 30000, '{}');
  insert into atribucion_form (phone, ad_id, created_at) values ('1155443322', 'AD4', ts - interval '4 hours');
  insert into shipments (courier, tracking, order_id, order_ref, province, dispatched_at, status_raw, status_canonical, freight_cost)
    select 'urbano', 'TRK4', id, 'T4', 'Córdoba', d + 1, 'D', 'entregado', 3000 from orders where shopify_id = 900000004;

  -- (f) los dos datos presentes y en desacuerdo: manda note_attributes, que es exacto.
  insert into orders (shopify_id, order_number, created_at, phone, courier, total, cod_amount, raw) values
    (900000005, 'T5', ts, '3584830882', 'urbano', 20000, 20000,
     '{"note_attributes":[{"name":"utm_content","value":"AD4"}]}');
  insert into shipments (courier, tracking, order_id, order_ref, province, dispatched_at, status_raw, status_canonical, freight_cost)
    select 'urbano', 'TRK5', id, 'T5', 'Córdoba', d + 1, 'D', 'entregado', 3000 from orders where shopify_id = 900000005;

  select * into r_ad3    from anuncios_pnl(d, d) where ad_id = 'AD3';
  select * into r_ad4    from anuncios_pnl(d, d) where ad_id = 'AD4';
  select * into r_bucket from anuncios_pnl(d, d) where ad_id is null;

  assert r_ad3.pedidos = 1 and r_ad3.cod_cobrado = 60000,
    '075: el pedido sin utm_content se atribuye por teléfono aunque el formato no coincida';
  assert r_ad4.pedidos = 1 and r_ad4.cod_cobrado = 20000,
    '075: note_attributes le gana al beacon (T5), y el beacon viejo de T4 no suma';
  assert r_bucket.pedidos = 1 and r_bucket.cod_cobrado = 30000,
    '075: el beacon fuera de ventana no atribuye — el pedido queda en el cubo NULL';

  raise notice '075 atribucion_form: OK';
end $t$;

rollback;

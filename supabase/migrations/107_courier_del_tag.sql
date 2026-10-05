-- 107 — El courier del pedido sale del TAG de ruteo (`fixy`/`urbano`), no de classify_courier.
-- Causa raíz (04/10/2026): upsert_order pisaba orders.courier con classify_courier(provincia, CP) en
-- CADA webhook; el tag solo mandaba si venía con `guia-…` (013), y Fixy dejó de usar ese tag el 08/07
-- (la guía se da de alta por API). El ruteo real lo decide el ruleset por CP de Veltron, más amplio que
-- fixy_zips (Luján 6700, La Plata 1900, Zárate 2800…) y que además ignora la provincia (direcciones
-- incoherentes tipo "San Juan / CP 1417"). Resultado: pedidos tag `fixy` quedaban courier='urbano',
-- fuera de v_fixy_sin_guia → el discover de Fixy nunca los consultaba (sin shipment, fuera del panel).
-- 14 COD vivos así en 60 días (27499, 27640, 28191…) + 1 al revés (28600, tag urbano, courier fixy).
-- Fix: tag de ruteo > clasificación por CP; la guía real (shipments) sigue mandando sobre ambos.
-- cuotas_3 queda afuera (prepago: su courier lo resuelve la rama anticipado, 104), igual que en 013.
-- Base = 013 (última definición de upsert_order).

create or replace function upsert_order(p jsonb) returns bigint
language plpgsql as $fn$
declare
  v_id      bigint;
  v_total   numeric := coalesce((p->>'total_price')::numeric, 0);
  v_deposit numeric := 0;
  v_tags    text    := coalesce(p->>'tags', '');
  v_fin     text    := p->>'financial_status';
  v_number  text    := replace(coalesce(p->>'name', p->>'order_number', p->>'id'), '#', '');
  v_addr    jsonb   := coalesce(p->'shipping_address', '{}'::jsonb);
  v_ship_courier text;
  v_guia    text;
  v_courier text;
  v_tag_courier text;
  m text[];
begin
  m := regexp_match(v_tags, '(sena|seña):\s*([0-9]+(?:[.,][0-9]+)?)', 'i');
  if m is not null then v_deposit := replace(m[2], ',', '.')::numeric; end if;
  if v_fin = 'paid' then v_deposit := v_total; end if;

  -- 107: el tag de ruteo manda sobre el CP (fixy primero, como 013, si vinieran los dos).
  if v_tags not ilike '%cuotas_3%' then
    v_tag_courier := case when v_tags ~* '(^|,|\s)fixy(,|\s|$)'   then 'fixy'
                          when v_tags ~* '(^|,|\s)urbano(,|\s|$)' then 'urbano' end;
  end if;

  insert into orders (shopify_id, order_number, created_at, cancelled_at, financial_status,
                      customer_name, phone, province, city, zip, courier,
                      total, cod_amount, deposit_amount, tags, raw, updated_at)
  values ((p->>'id')::bigint, v_number, (p->>'created_at')::timestamptz,
          (p->>'cancelled_at')::timestamptz, v_fin,
          v_addr->>'name', v_addr->>'phone', v_addr->>'province', v_addr->>'city', v_addr->>'zip',
          coalesce(v_tag_courier, classify_courier(v_addr->>'province', v_addr->>'zip')),
          v_total, greatest(v_total - v_deposit, 0), v_deposit, v_tags, p, now())
  on conflict (shopify_id) do update set
    order_number = excluded.order_number, created_at = excluded.created_at,
    cancelled_at = excluded.cancelled_at, financial_status = excluded.financial_status,
    customer_name = excluded.customer_name, phone = excluded.phone,
    province = excluded.province, city = excluded.city, zip = excluded.zip,
    courier = excluded.courier, total = excluded.total, cod_amount = excluded.cod_amount,
    deposit_amount = excluded.deposit_amount, tags = excluded.tags, raw = excluded.raw,
    updated_at = now()
  returning id into v_id;

  select courier into v_ship_courier from shipments where order_id = v_id limit 1;
  if v_ship_courier is not null then
    update orders set courier = v_ship_courier where id = v_id;
  end if;

  -- Ítems: producto por keyword; PACK = quantity (unidades compradas), qty = 1 (006).
  delete from order_items where order_id = v_id;
  insert into order_items (order_id, product_id, pack, qty, unit_price, title_raw)
  select v_id,
         match_product(coalesce(li->>'title', '')),
         coalesce((li->>'quantity')::int, 1),
         1,
         coalesce((li->>'price')::numeric, 0),
         li->>'title'
  from jsonb_array_elements(coalesce(p->'line_items', '[]'::jsonb)) li;

  -- Guías huérfanas que referencian este pedido quedan linkeadas (R4)
  update shipments set order_id = v_id, updated_at = now()
  where order_id is null and order_ref is not null
    and replace(order_ref, '#', '') = v_number;

  -- ── Despacho por TAG (013): la guía viaja en el tag `guia-<código>`. ──
  -- Excluye cuotas_3 (van por la rama Correo/prepago, sin guía COD).
  v_guia := (regexp_match(v_tags, 'guia-([A-Za-z0-9]+)', 'i'))[1];
  if v_guia is not null and v_tags not ilike '%cuotas_3%' then
    v_courier := coalesce(v_tag_courier, (select courier from orders where id = v_id));
    -- updated_at viejo → el sync (ordena por updated_at asc) la agarra en la próxima tanda.
    insert into shipments (courier, tracking, order_id, order_ref, province, raw, updated_at)
    values (v_courier, v_guia, v_id, v_number, v_addr->>'province',
            jsonb_build_object('via', 'tag'), now() - interval '90 days')
    on conflict (courier, tracking) do update set
      order_id  = excluded.order_id,
      order_ref = coalesce(shipments.order_ref, excluded.order_ref),
      province  = coalesce(shipments.province, excluded.province);
    -- el courier real de la guía manda sobre la clasificación por CP (§5.1)
    update orders set courier = v_courier where id = v_id;
  end if;

  return v_id;
end $fn$;

revoke execute on function upsert_order(jsonb) from anon, authenticated;

-- Backfill: mismo criterio sobre lo ya cargado. Solo pedidos SIN guía (con guía, manda la guía).
-- ponytail: 60 días (lo que el discover todavía puede levantar); lo viejo se corrige solo si Shopify
-- vuelve a mandar el pedido. Ampliar si hiciera falta para el histórico de priors.
update orders o set courier = t.c, updated_at = now()
from (select id, case when tags ~* '(^|,|\s)fixy(,|\s|$)' then 'fixy' else 'urbano' end c
      from orders
      where tags ~* '(^|,|\s)(fixy|urbano)(,|\s|$)' and tags not ilike '%cuotas_3%') t
where o.id = t.id and o.courier is distinct from t.c and o.created_at >= now() - interval '60 days'
  and not exists (select 1 from shipments s where s.order_id = o.id);

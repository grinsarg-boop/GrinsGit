-- 013 — Despacho por TAG (proceso nuevo desde ~08/07/2026).
-- Cambió el tool de despacho: ya NO fulfillea en Shopify con tracking. Ahora la guía se inserta
-- como TAG del pedido: `guia-<código>` + `despachado` + courier (`urbano`/`fixy`).
--   · Urbano: el código de guía = el ID de pedido de Shopify (la API lo poletea por codigoSeguimiento).
--   · Fixy:   el código es la guía Fixy; el sync la resuelve por order_ref=remito (=order_number).
-- Sin esto, desde el 08 no entra ninguna guía COD (el dashboard quedó ciego al grueso de la plata).
-- Root-cause fix en el único lugar por donde pasan TODOS los pedidos (webhook + backfill): upsert_order.
-- Aditivo: no toca fórmulas de P&L. La guía nace acá; el sync de courier la enriquece (fecha de
-- despacho vía CICLO, estado, flete) igual que pre-08. Base = versión post-006 (pack = quantity).

-- ============ 1. upsert_order: + crear guía desde el tag `guia-<código>` ============
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
  m text[];
begin
  m := regexp_match(v_tags, '(sena|seña):\s*([0-9]+(?:[.,][0-9]+)?)', 'i');
  if m is not null then v_deposit := replace(m[2], ',', '.')::numeric; end if;
  if v_fin = 'paid' then v_deposit := v_total; end if;

  insert into orders (shopify_id, order_number, created_at, cancelled_at, financial_status,
                      customer_name, phone, province, city, zip, courier,
                      total, cod_amount, deposit_amount, tags, raw, updated_at)
  values ((p->>'id')::bigint, v_number, (p->>'created_at')::timestamptz,
          (p->>'cancelled_at')::timestamptz, v_fin,
          v_addr->>'name', v_addr->>'phone', v_addr->>'province', v_addr->>'city', v_addr->>'zip',
          classify_courier(v_addr->>'province', v_addr->>'zip'),
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
    v_courier := case when v_tags ~* '(^|,|\s)fixy(,|\s|$)'   then 'fixy'
                      when v_tags ~* '(^|,|\s)urbano(,|\s|$)' then 'urbano'
                      else (select courier from orders where id = v_id) end;
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

-- ============ 2. Backfill una vez: crear las guías del gap (pedidos ya tageados, sin shipment) ============
-- Recupera todo lo despachado desde ~08/07 que quedó invisible. Idempotente (on conflict do nothing).
-- dispatched_at queda null → el sync de urbano/fixy lo completa (CICLO/estado/flete) en su próxima
-- corrida; updated_at viejo las pone al frente de la cola stalest para que dren rápido.
insert into shipments (courier, tracking, order_id, order_ref, province, raw, updated_at)
select case when o.tags ~* '(^|,|\s)fixy(,|\s|$)' then 'fixy' else 'urbano' end,
       (regexp_match(o.tags, 'guia-([A-Za-z0-9]+)', 'i'))[1],
       o.id, o.order_number, o.province,
       jsonb_build_object('via', 'tag-backfill'), now() - interval '90 days'
from orders o
where o.tags ~* 'guia-'
  and o.cancelled_at is null
  and o.tags not ilike '%cuotas_3%'
  and not exists (select 1 from shipments s where s.order_id = o.id)
on conflict (courier, tracking) do nothing;

-- 075 — Cruce venta ↔ anuncio sin pasar por n8n.
--
-- El 06/07/2026 el form COD dejó de ser la app de Shopify (source_name 4310925) y pasó a ser el form
-- propio del theme (sections/veltron-cod-checkout-form.liquid), que postea a n8n y n8n crea la orden.
-- La app vieja estampaba utm_content en note_attributes (~92% de cobertura); el form propio no manda
-- UTM, y n8n no reenvía el payload crudo sino que lee una lista fija de campos —la prueba es el `note`
-- que escribe, "Canal: … | Pago: … | Oferta: …", compuesto de carrier/payment_method/bundle_label—.
-- Resultado: desde el 13/07 el 100% de los pedidos entra sin atribución y anuncios_pnl (051) los tira
-- todos al cubo ad_id NULL. Arreglarlo en n8n sería un campo, pero la API key da 401 desde acá.
--
-- Camino: el form manda {phone, ad_id} a /api/atribucion cuando se completa el teléfono —colgado del
-- campo, NO del submit, para que el camino de la venta quede intacto— y el cruce se hace acá.
--
-- El teléfono NO es identidad: dos pedidos del mismo número dentro de la ventana son ambiguos y se
-- toma el beacon más reciente anterior al pedido. Falla hacia "sin atribución", nunca hacia
-- atribución equivocada — es el lado barato del error, porque un ad_id mal puesto ensucia la decisión
-- de escalar y la ausencia solo la deja en el cubo NULL, que ya está a la vista en el panel.
--
-- Se compara por los ÚLTIMOS 8 DÍGITOS a propósito. El form normaliza el teléfono antes de mandarlo
-- (saca +54, el 9 de celular, convierte el 15 — línea 560 de la sección) y todas esas
-- transformaciones tocan el PREFIJO: los últimos 8 son invariantes. Así el beacon manda el teléfono
-- crudo y no quedan dos normalizaciones que mantener sincronizadas, que es exactamente el tipo de
-- par que se desincroniza en silencio.

create table if not exists atribucion_form (
  id          bigserial primary key,
  phone       text not null,
  -- generada: el join va por acá, y así no hay forma de insertar una fila cuya cola no derive del
  -- teléfono guardado.
  phone_tail  text generated always as (right(regexp_replace(phone, '\D', '', 'g'), 8)) stored,
  ad_id       text not null,
  handle      text,
  created_at  timestamptz not null default now()
);

create index if not exists atribucion_form_tail_idx on atribucion_form (phone_tail, created_at desc);

-- Tiene teléfonos: cerrada por defecto. La escritura entra por service_role (bypassa RLS) desde
-- /api/atribucion; el select es para que anuncios_pnl —que corre como el usuario que la llama, no es
-- security definer— pueda leerla desde el panel.
alter table atribucion_form enable row level security;
drop policy if exists atribucion_form_lectura on atribucion_form;
create policy atribucion_form_lectura on atribucion_form for select to authenticated using (true);

-- anuncios_pnl: idéntica a 051 salvo raw_ad_id, que ahora cae a atribucion_form cuando el pedido no
-- trae utm_content. El orden importa — note_attributes primero: para los pedidos viejos (hasta el
-- 05/07) ese dato es exacto y no se toca.
drop function if exists anuncios_pnl(date, date);

create or replace function anuncios_pnl(p_from date, p_to date)
returns table (
  ad_id text, ad_name text, adset_name text, campaign_name text, product text,
  pedidos int, despachadas int, entregadas int, devueltas int, resueltas int,
  cod_cobrado numeric, flete numeric, spend numeric
) language sql stable as $$
  with ord as (
    select
      o.id,
      coalesce(o.cod_amount, 0) as cod,
      coalesce(
        (select v.value->>'value'
           from jsonb_array_elements(
                  case when jsonb_typeof(o.raw->'note_attributes') = 'array'
                       then o.raw->'note_attributes' else '[]'::jsonb end) v
          where v.value->>'name' = 'utm_content' limit 1),
        (select a.ad_id
           from atribucion_form a
          where a.phone_tail = right(regexp_replace(
                  coalesce(o.phone, o.raw->'shipping_address'->>'phone', ''), '\D', '', 'g'), 8)
            and right(regexp_replace(
                  coalesce(o.phone, o.raw->'shipping_address'->>'phone', ''), '\D', '', 'g'), 8) <> ''
            -- ventana: el beacon sale cuando se completa el teléfono y el pedido se crea después.
            -- 60 min de holgura porque entre un dato y el otro la compradora elige el pack; los 5 min
            -- de después cubren que n8n tarde en dar de alta la orden.
            and a.created_at between o.created_at - interval '60 min'
                                and o.created_at + interval '5 min'
          order by a.created_at desc limit 1)
      ) as raw_ad_id,
      s.st, s.fc
    from orders o
    left join lateral (
      select
        case when ((s2.courier = 'urbano' and s2.status_raw = 'PI')
                or (s2.courier = 'fixy' and (s2.status_raw = '41'
                     or lower(coalesce(s2.status_raw, '')) like '%pendiente de retiro%')))
                  and current_date - s2.dispatched_at > 7
               then 'no_despachado' else s2.status_canonical end as st,
        case when ((s2.courier = 'urbano' and s2.status_raw = 'PI')
                or (s2.courier = 'fixy' and (s2.status_raw = '41'
                     or lower(coalesce(s2.status_raw, '')) like '%pendiente de retiro%')))
                  and current_date - s2.dispatched_at > 7
               then 0
             when s2.courier = 'urbano' and s2.freight_tarifa is null and s2.freight_cost is null
               then estimate_urbano_freight(s2.province)
             else coalesce(s2.freight_cost, 0) end as fc
      from shipments s2
      where s2.order_id = o.id and s2.status_canonical <> 'cancelado'
      order by s2.dispatched_at desc limit 1
    ) s on true
    where o.created_at::date between p_from and p_to
      and o.cancelled_at is null
  ),
  known as (select distinct ad_spend.ad_id from ad_spend),
  oagg as (
    select
      case when ord.raw_ad_id in (select known.ad_id from known) then ord.raw_ad_id end as ad_id,
      count(*)::int as pedidos,
      count(*) filter (where st is not null and st <> 'no_despachado')::int as despachadas,
      count(*) filter (where st = 'entregado')::int as entregadas,
      count(*) filter (where st in ('devuelto','rehusado','en_devolucion'))::int as devueltas,
      count(*) filter (where st in ('entregado','devuelto','rehusado','en_devolucion','siniestro'))::int as resueltas,
      coalesce(sum(cod) filter (where st = 'entregado'), 0) as cod_cobrado,
      coalesce(sum(fc) filter (where st is not null and st <> 'no_despachado'), 0) as flete
    from ord
    group by 1
  ),
  ospend as (
    select ad_spend.ad_id, sum(ad_spend.spend) as spend
    from ad_spend where ad_spend.date between p_from and p_to
    group by ad_spend.ad_id
  ),
  adim as (
    select distinct on (ad_spend.ad_id)
      ad_spend.ad_id, ad_spend.ad_name, ad_spend.adset_name, ad_spend.campaign_name, ad_spend.product_id
    from ad_spend order by ad_spend.ad_id, ad_spend.date desc
  )
  select
    coalesce(oagg.ad_id, ospend.ad_id) as ad_id,
    adim.ad_name, adim.adset_name, adim.campaign_name, pr.name as product,
    coalesce(oagg.pedidos, 0), coalesce(oagg.despachadas, 0), coalesce(oagg.entregadas, 0),
    coalesce(oagg.devueltas, 0), coalesce(oagg.resueltas, 0),
    coalesce(oagg.cod_cobrado, 0), coalesce(oagg.flete, 0), coalesce(ospend.spend, 0)
  from oagg
  full outer join ospend on ospend.ad_id = oagg.ad_id
  left join adim on adim.ad_id = coalesce(oagg.ad_id, ospend.ad_id)
  left join products pr on pr.id = adim.product_id
$$;

revoke execute on function anuncios_pnl(date, date) from anon;
grant execute on function anuncios_pnl(date, date) to authenticated, service_role;

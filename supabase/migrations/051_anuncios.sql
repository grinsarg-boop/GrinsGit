-- 051 — Cruce venta ↔ anuncio de Meta. El form COD (source_name cod-form / app 4310925) guarda la
-- atribución en orders.raw->note_attributes como IDs numéricos de Meta:
--   utm_content = ad_id · utm_campaign = utm_id = campaign_id · utm_term = adset_id
-- (el full_url lo confirma explícito: &campaign_id=…&ad_id=…). La llave real es utm_content = ad_id,
-- que une DIRECTO con ad_spend.ad_id (ese sí lo trae el sync de Meta con nombre de ad/adset/campaña).
--
-- anuncios_pnl cohortea por día de VENTA (created_at del pedido) — no de despacho: la atribución es del
-- pedido, y el gasto de ad_spend se suma sobre el MISMO rango, así el CPA queda peso-con-peso. La tasa
-- de entrega recién madura (~21 días), por eso se devuelven las dos bases: entregadas/despachadas
-- (bruta, subestima en cohortes nuevas) y entregadas/resueltas (robusta a maduración). Estados y flete
-- con las MISMAS reglas del resto de /analisis (no_despachado = PI/41 pendiente >7d; flete estimado en
-- urbano sin tarifa). Los pedidos cuyo ad_id no está en ad_spend (ads viejos/borrados u orgánico sin
-- utm) caen en un único cubo con ad_id NULL: se cuentan pero sin gasto ni nombre — es la fuga, a la
-- vista. Un FULL OUTER JOIN contra el gasto agrega también los ads que gastaron con 0 pedidos.

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
      (select v.value->>'value'
         from jsonb_array_elements(
                case when jsonb_typeof(o.raw->'note_attributes') = 'array'
                     then o.raw->'note_attributes' else '[]'::jsonb end) v
        where v.value->>'name' = 'utm_content' limit 1) as raw_ad_id,
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

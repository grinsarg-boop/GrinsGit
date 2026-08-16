-- 076 — La regla de atribución vive en UN solo lugar, y salud_sistema() mide lo que de verdad pasa.
--
-- La 075 dejó el cruce por teléfono adentro del cuerpo de anuncios_pnl. Con el canary abierto a todas
-- las landings quedan dos consumidores de la misma regla —el panel y la alerta— y dos copias de una
-- regla es una que se desactualiza sin que nadie se entere. Se extrae a ad_id_atribuido().
--
-- Y la alerta de atribución (068, bloque 4) contaba utm_content en note_attributes: con el arreglo
-- vivo eso da 0% para siempre y grita todos los días aunque el cruce funcione perfecto. Una alerta
-- que grita siempre es una alerta apagada. Ahora mide la cobertura REAL: pedidos a los que se les
-- puede poner un anuncio, por cualquiera de los dos caminos.

-- La regla, una sola vez. note_attributes primero: hasta el 05/07 ese dato es exacto (lo estampaba la
-- app vieja) y no se toca. Después cae al beacon del form → /api/atribucion (ver docs/atribucion-utm.md).
create or replace function ad_id_atribuido(p_raw jsonb, p_phone text, p_created timestamptz)
returns text language sql stable as $$
  select coalesce(
    (select v.value->>'value'
       from jsonb_array_elements(
              case when jsonb_typeof(p_raw->'note_attributes') = 'array'
                   then p_raw->'note_attributes' else '[]'::jsonb end) v
      where v.value->>'name' = 'utm_content' limit 1),
    (select a.ad_id
       from atribucion_form a
      where a.phone_tail = nullif(right(regexp_replace(
              coalesce(p_phone, p_raw->'shipping_address'->>'phone', ''), '\D', '', 'g'), 8), '')
        and a.created_at between p_created - interval '60 min'
                             and p_created + interval '5 min'
      order by a.created_at desc limit 1)
  )
$$;

grant execute on function ad_id_atribuido(jsonb, text, timestamptz) to authenticated, service_role;

-- anuncios_pnl: idéntica a la 075 salvo que raw_ad_id ahora sale de la función.
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
      ad_id_atribuido(o.raw, o.phone, o.created_at) as raw_ad_id,
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

-- salud_sistema: copia de la 068 con el bloque 4 midiendo la cobertura real. El resto va idéntico.
create or replace function salud_sistema()
returns table (severidad text, area text, detalle text)
language sql stable as $fn$
  with esperado(connector, max_min) as (
    values ('urbano', 45), ('fixy', 30), ('meta', 90), ('stock-espejo', 90),
           ('ml', 300), ('ad-review', 1560)
  ),
  ultima as (
    select e.connector, e.max_min,
           (select max(s.started_at) from sync_runs s where s.connector = e.connector) as ts
    from esperado e
  )

  select 'ROJO', 'sync:' || u.connector,
         case when u.ts is null then 'nunca corrió'
              else 'sin corridas hace ' || round(extract(epoch from (now() - u.ts)) / 60)
                   || ' min (esperado < ' || u.max_min || ')' end
  from ultima u
  where u.ts is null or u.ts < now() - (u.max_min || ' minutes')::interval

  union all

  select 'ROJO', 'sync:' || s.connector,
         'la última corrida falló (' ||
         to_char(s.started_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') ||
         ' ART) · ' || left(coalesce(nullif(s.error, ''), nullif(s.warnings::text, '[]'), '?'), 140)
  from (
    select distinct on (connector) connector, status, error, warnings, started_at
    from sync_runs
    where started_at > now() - interval '24 hours'
    order by connector, started_at desc
  ) s
  where s.status <> 'ok'

  union all

  select 'ROJO', 'ads', 'ad_spend de ayer = $0 — ¿rotaron la cuenta de Meta y el token no ve la nueva?'
  from (select coalesce(sum(spend), 0) as g from ad_spend where date = current_date - 1) z
  where z.g = 0

  union all

  -- 4. Atribución. Antes contaba utm_content en note_attributes; desde el 16/08/2026 mide la
  --    cobertura REAL —note_attributes O el beacon del form— porque el camino viejo está muerto
  --    desde el 06/07 y esa versión gritaba todos los días. Si esto se enciende ahora, lo que se
  --    rompió es el beacon: el theme, /api/atribucion o la tabla.
  --    Umbral 40% (histórico sano ~90%); pide >20 pedidos para no gritar por un día flojo.
  select 'AMARILLO', 'atribución',
         'solo ' || round(100.0 * a.con / a.tot, 1) || '% de los ' || a.tot
         || ' pedidos de ayer se pueden atribuir a un anuncio — /anuncios está ciego'
  from (
    select count(*) as tot,
           count(*) filter (
             where ad_id_atribuido(o.raw, o.phone, o.created_at) is not null) as con
    from orders o
    where o.created_at::date = current_date - 1 and o.cancelled_at is null
  ) a
  where a.tot > 20 and 100.0 * a.con / a.tot < 40

  union all

  select 'AMARILLO', 'ads', z.c || ' anuncios DISAPPROVED/WITH_ISSUES sin resolver'
  from (select count(*) as c from ad_review_issues where resolved_at is null) z
  where z.c > 0
$fn$;

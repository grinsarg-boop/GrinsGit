-- 081 · La pauta que no matchea con ningún pedido deja de evaporarse.
--
-- PROBLEMA (medido 22/08/2026). `ads_alloc` reparte el gasto de Meta uniendo por producto:
-- `sp.product_id = w.p`. Si el producto que trae el anuncio no tiene pedidos, el join no encuentra
-- a quién cobrarle y el gasto DESAPARECE del P&L — no queda como costo de nadie.
--
-- Es lo que pasa con Natures: 41 anuncios siguen etiquetados con ese producto (el matcher lee el
-- nombre del anuncio) pero Natures no tiene un pedido desde el 30/07 — esa landing hoy sirve
-- PurezaDrops. Del 17 al 21/08, v_ad_spend suma $3.370.341 y sales_rows imputaba $2.460.003:
-- $910.338 de pauta real cobrada a nadie. En lo que va de agosto son $2.277.928 ($2.170.807 de
-- Natures + $107.121 de anuncios que el matcher no pudo etiquetar), y el profit COD del mes los
-- contaba como ganancia.
--
-- POR QUÉ NO ES UN REMAPEO. Cambiar Natures→Pureza tapa este caso y deja el agujero abierto para la
-- próxima campaña que cambie de producto sin cambiar de nombre. La regla nueva no depende de qué
-- producto diga el anuncio: la pauta que no encuentra dueño se reparte entre los que SÍ vendieron,
-- con el mismo peso que ya usa el reparto normal. Peor caso: se le cobra al producto equivocado.
-- Antes el peor caso era no cobrársela a nadie, que es plata inventada.
--
-- QUIÉN ES "DUEÑO" lo define el peso de cada reparto, y por eso la regla NO se extrae a una función
-- compartida: los dos repartos corren sobre ejes distintos —sales_rows por día de VENTA, daily_pnl
-- por día de DESPACHO sobre todo el período— y un helper con un solo criterio le sacaba a daily_pnl
-- gasto que sí tenía dueño (lo cazó pnl_check R10). Ocho líneas repetidas, cada una correcta en su
-- eje, contra una abstracción que tiene que estar mal en uno de los dos.
--
-- EL INVARIANTE que deja atrás: la suma de `ads` de sales_rows es el 100% de v_ad_spend del período.
-- Es exactamente lo que ya calcula `sales_days.ads_sin_cohorte`, que a partir de ahora da 0 y sirve
-- de alarma viva: si vuelve a dar distinto de 0, algo volvió a perder pauta. Los paneles que la
-- restaban del profit (/caja, /tendencias, /ventas/[fecha]) no cambian de total: ahora restan 0 y la
-- misma plata ya está adentro de `ads`. El que cambia es /ventas por mes, que nunca la restó.
-- `v_ads_sin_cohorte` queda igual: es el diagnóstico que dice QUÉ producto está mal etiquetado.

-- ── Copia de recompute_daily_pnl (079) con el único cambio del reparto de ads ────────────────
create or replace function recompute_daily_pnl(p_from date, p_to date) returns void
language plpgsql as $fn$
declare
  v_comm  jsonb   := (select value from settings where key = 'commission_pct');
  v_mp    numeric := (select (value::text)::numeric from settings where key = 'mp_fee_pct');
  v_fw    numeric := (select (value::text)::numeric from settings where key = 'fixy_cpa_multiplier');
  v_mat   jsonb   := (select value from settings where key = 'maturity_days');
  v_ccomm numeric := (select (value::text)::numeric from settings where key = 'cuotas_commission');
  v_flete numeric := (select (value::text)::numeric from settings where key = 'correo_flete');
  v_adsiva numeric := coalesce((select (value::text)::numeric from settings where key = 'ml_ads_iva'), 0);
  v_dec   jsonb   := (select value from settings where key = 'delivery_decay');   -- 072
begin
  insert into product_costs (product_id, pack, unit_cost, is_estimated)
  select distinct oi.product_id, oi.pack, pc1.unit_cost * oi.pack, true
  from order_items oi
  join shipments s on s.order_id = oi.order_id
       and s.dispatched_at between p_from and p_to
  join product_costs pc1 on pc1.product_id = oi.product_id and pc1.pack = 1
  where oi.product_id is not null and oi.pack <> 1
    and not exists (select 1 from product_costs pc
                     where pc.product_id = oi.product_id and pc.pack = oi.pack)
  on conflict do nothing;

  -- packs de ML sin fila de costo → extrapolar pack1 × pack (is_estimated). Revival y cualquier pack nuevo.
  insert into product_costs (product_id, pack, unit_cost, is_estimated)
  select distinct p.id, o.pack, pc1.unit_cost * o.pack, true
  from ml_orders o
  join products p on p.name = o.product
  join product_costs pc1 on pc1.product_id = p.id and pc1.pack = 1
  where o.status = 'paid' and o.pack <> 1
    and not exists (select 1 from product_costs pc where pc.product_id = p.id and pc.pack = o.pack)
  on conflict do nothing;

  -- mapeo publicación → producto, sembrado desde las ventas: raw.order_items[].item.id ya viene
  -- con el producto matcheado por el sync, así que no hay que matchear títulos en SQL. Cubre el
  -- 99,9% del gasto (julio: quedaron $5.920 de $5,65M en items que nunca vendieron).
  insert into ml_ad_items (item_id, product_id)
  select distinct oi->'item'->>'id', p.id
  from ml_orders o
  cross join lateral jsonb_array_elements(o.raw->'order_items') oi
  join products p on p.name = o.product
  where o.status = 'paid' and oi->'item'->>'id' is not null
  on conflict (item_id) do nothing;

  update shipments
     set freight_cost = estimate_urbano_freight(province), freight_is_estimated = true
  where courier = 'urbano' and freight_tarifa is null
    and dispatched_at between p_from and p_to;

  delete from daily_pnl where dispatch_date between p_from and p_to;

  insert into daily_pnl (dispatch_date, courier, product_id,
    despachadas, entregadas, rehusadas, en_devolucion, devueltas, siniestros, en_transito,
    pct_resuelto, tasa_actual, tasa_proyectada,
    revenue_confirmado, revenue_estimado, senas_netas, flete, flete_estimado_pct,
    costo_producto, comisiones, percepciones, ads, profit_confirmado, profit_estimado, computed_at)
  with ship as (
    select s.dispatched_at as d, s.courier as c, order_primary_product(o.id) as p,
           case
             when ((s.courier = 'urbano' and s.status_raw = 'PI')
                or (s.courier = 'fixy' and (s.status_raw = '41'
                     or lower(coalesce(s.status_raw, '')) like '%pendiente de retiro%')))
                  and current_date - s.dispatched_at > 7
               then 'no_despachado'
             else s.status_canonical
           end as st,
           case
             when ((s.courier = 'urbano' and s.status_raw = 'PI')
                or (s.courier = 'fixy' and (s.status_raw = '41'
                     or lower(coalesce(s.status_raw, '')) like '%pendiente de retiro%')))
                  and current_date - s.dispatched_at > 7
               then 0
             else coalesce(s.freight_cost, 0)
           end as fc,
           s.freight_is_estimated as fe,
           o.cod_amount as cod,
           case when row_number() over (partition by o.id order by s.dispatched_at, s.id) = 1
                then o.deposit_amount else 0 end as dep,
           coalesce((select sum(oi.qty * coalesce(pc.unit_cost, 0))
                       from order_items oi
                       left join product_costs pc
                              on pc.product_id = oi.product_id and pc.pack = oi.pack
                      where oi.order_id = o.id), 0) as ucost,
           coalesce(
             (select dp.p_delivery from delivery_priors dp
                where dp.courier = s.courier and dp.province = coalesce(s.province, o.province)
                  and dp.product_id = order_primary_product(o.id)),
             (select dp.p_delivery from delivery_priors dp
                where dp.courier = s.courier and dp.province = coalesce(s.province, o.province)
                  and dp.product_id is null),
             (select dp.p_delivery from delivery_priors dp
                where dp.courier = s.courier and dp.province is null and dp.product_id is null),
             0)
           -- 072: P(entrega | sigue abierta a la edad t) = prior_celda × decay(courier, t). El prior
           -- solo es válido a t=0; sin esto una guía de 10 días cobraba lo mismo que una de hoy.
           * coalesce((v_dec -> s.courier ->> least(greatest(current_date - s.dispatched_at, 0), 30))::numeric, 1)
           -- 079: corrección de NIVEL por cohorte. El decay ajusta la forma (edad); esto ajusta
           -- cuánto entrega la cohorte, leído de su propia maduración. k=1 antes del día 7.
           * cohort_k(s.courier, s.dispatched_at)
           as prior
    from shipments s
    join orders o on o.id = s.order_id
    where s.dispatched_at between p_from and p_to
      and s.status_canonical <> 'cancelado'
      and order_primary_product(o.id) is not null
      and (o.tags is null or lower(o.tags) not like '%cuotas_3%')
  ),
  agg as (
    select d, c, p,
      count(*) filter (where st <> 'no_despachado')::int as despachadas,
      count(*) filter (where st = 'no_despachado')::int as no_despachadas,
      count(*) filter (where st = 'entregado')::int as entregadas,
      count(*) filter (where st = 'rehusado')::int as rehusadas,
      count(*) filter (where st = 'en_devolucion')::int as en_devolucion,
      count(*) filter (where st = 'devuelto')::int as devueltas,
      count(*) filter (where st = 'siniestro')::int as siniestros,
      count(*) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro','no_despachado'))::int as en_transito,
      sum(fc) as flete,
      case when sum(fc) > 0
           then coalesce(sum(fc) filter (where fe), 0) / sum(fc) else 0 end as flete_est_pct,
      sum(dep) * (1 - v_mp) as senas_netas,
      coalesce(sum(cod) filter (where st = 'entregado'), 0) as cod_entregado,
      coalesce(sum(ucost) filter (where st in ('entregado','siniestro')), 0) as costo,
      coalesce(sum(prior * cod) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro','no_despachado')), 0) as est_cod,
      coalesce(sum(prior * ucost) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro','no_despachado')), 0) as est_cost,
      coalesce(sum(prior) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro','no_despachado')), 0) as est_deliv
    from ship
    group by 1, 2, 3
  ),
  cuotas as (
    select (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date as d,
           order_primary_product(o.id) as p,
           o.financial_status as fin,
           o.deposit_amount as dep, o.cod_amount as cod,
           case when o.financial_status = 'paid'
                then coalesce(mp.fee, o.deposit_amount * v_ccomm) else 0 end as feer,
           ((o.created_at at time zone 'America/Argentina/Buenos_Aires')::date
              <= current_date - ((v_mat->>'correo')::int)) as matured,
           coalesce((select sum(oi.qty * coalesce(pc.unit_cost, 0))
                       from order_items oi
                       left join product_costs pc
                              on pc.product_id = oi.product_id and pc.pack = oi.pack
                      where oi.order_id = o.id), 0) as ucost,
           coalesce(
             (select dp.p_delivery from delivery_priors dp
                where dp.courier = 'correo' and dp.province is null
                  and dp.product_id = order_primary_product(o.id)),
             (select dp.p_delivery from delivery_priors dp
                where dp.courier = 'correo' and dp.province is null and dp.product_id is null),
             0) as prior
    from orders o
    left join (select order_number, sum(fee) as fee from mp_payments group by 1) mp
           on mp.order_number = o.order_number
    where o.cancelled_at is null and lower(o.tags) like '%cuotas_3%'
      and o.financial_status in ('paid','pending')
      and (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date between p_from and p_to
      and order_primary_product(o.id) is not null
  ),
  cagg as (
    select d, p,
      count(*)::int as generados,
      count(*) filter (where fin = 'paid')::int as pagados,
      count(*) filter (where fin = 'pending' and matured)::int as perdidos,
      count(*) filter (where fin = 'pending' and not matured)::int as en_transito,
      coalesce(sum(dep) filter (where fin = 'paid'), 0) as revenue,
      coalesce(sum(feer), 0) as comision,
      coalesce(sum(ucost) filter (where fin = 'paid'), 0) as costo,
      coalesce(sum(prior * cod) filter (where fin = 'pending' and not matured), 0) as est_cod,
      coalesce(sum(prior * ucost) filter (where fin = 'pending' and not matured), 0) as est_cost,
      coalesce(sum(prior) filter (where fin = 'pending' and not matured), 0) as est_conf
    from cuotas group by 1, 2
  ),
  ml as (
    -- Ventas ML pagadas. Cohorte por date_created en día Argentina (igual que correo).
    select (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date as d,
           pr.id as p, o.units, o.total_amount, o.sale_fee,
           coalesce(o.tax_withheld, 0) as retencion,
           coalesce(o.ship_cost, 0) as flete,
           (o.ship_cost is null) as flete_pend,
           o.units * coalesce(pc.unit_cost, 0) as ucost
    from ml_orders o
    join products pr on pr.name = o.product
    left join product_costs pc on pc.product_id = pr.id and pc.pack = o.pack
    where o.status = 'paid'
      and (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date between p_from and p_to
  ),
  magg as (
    select d, p,
      count(*)::int as vendidas,
      sum(total_amount) as revenue,
      sum(sale_fee) as comision,
      sum(retencion) as retencion,
      sum(flete) as flete,
      count(*) filter (where flete_pend)::int as flete_pend,
      sum(ucost) as costo
    from ml group by 1, 2
  ),
  ads_weights as (
    select a.d, a.c, a.p, ((a.despachadas + a.no_despachadas) * case when a.c = 'fixy' then v_fw else 1 end)::numeric as w from agg a
    union all
    select c.d, 'correo'::text, c.p, c.generados::numeric as w from cagg c
  ),
  ads_periodo as (
    select product_id as p, sum(spend_real) as spend from v_ad_spend
     where date between p_from and p_to group by 1
  ),
  -- 081: pauta sin dueño = producto que no despachó nada en el período, o anuncio que el matcher no
  -- pudo etiquetar (p null). Antes el join la dejaba afuera y no era costo de nadie.
  ads_huerfana as (
    select coalesce(sum(a.spend), 0) as spend from ads_periodo a
    where a.p is null or not exists (select 1 from ads_weights w where w.p = a.p)
  ),
  ads_alloc as (
    select w.d, w.c, w.p,
           coalesce(a.spend, 0) * w.w / nullif(sum(w.w) over (partition by w.p), 0)
         + (select spend from ads_huerfana) * w.w / nullif(sum(w.w) over (), 0) as ads
    from ads_weights w
    left join ads_periodo a on a.p = w.p
  ),
  mlads as (
    select date, cost * (1 + v_adsiva) as cost from ml_ad_spend where date between p_from and p_to
  ),
  mlbonif as (
    select date, amount from ml_flex_bonif where date between p_from and p_to
  ),
  mlpercep as (
    select date, amount from ml_percepciones where date between p_from and p_to
  ),
  mlads_item as (
    -- gasto REAL de cada publicación imputado a su producto (el sync ya dedupló por item_id)
    select i.date as d, mi.product_id as p, sum(i.cost) * (1 + v_adsiva) as cost
    from ml_ad_spend_item i
    join ml_ad_items mi on mi.item_id = i.item_id
    where i.date between p_from and p_to
    group by 1, 2
  ),
  mlads_resto as (
    -- lo que no se pudo imputar: items sin mapeo + desvío entre el total del día (el que factura ML)
    -- y la suma por publicación. Se reparte por revenue como antes. Puede ser negativo si la suma por
    -- item se pasa; se reparte igual para que el total del día del P&L sea exactamente ml_ad_spend.
    select a.date as d,
           a.cost - coalesce((select sum(x.cost) from mlads_item x where x.d = a.date), 0) as cost
    from mlads a
  ),
  ml_dias as (
    -- días×producto con venta O con gasto propio: un producto que gastó y no vendió ese día tiene
    -- que entrar igual, si no su costo real desaparecería del P&L.
    select d, p from magg
    union
    select d, p from mlads_item
  ),
  ml_alloc as (
    -- ads = gasto real de las publicaciones del producto + su parte del resto sin imputar.
    select x.d, x.p,
      coalesce(m.vendidas, 0) as vendidas, coalesce(m.revenue, 0) as revenue,
      coalesce(m.comision, 0) as comision, coalesce(m.retencion, 0) as retencion,
      coalesce(m.flete, 0) as flete, coalesce(m.flete_pend, 0) as flete_pend,
      coalesce(m.costo, 0) as costo,
      coalesce((select ii.cost from mlads_item ii where ii.d = x.d and ii.p = x.p), 0)
        + coalesce((select rr.cost from mlads_resto rr where rr.d = x.d) * coalesce(m.revenue, 0)
                 / nullif(sum(coalesce(m.revenue, 0)) over (partition by x.d), 0), 0) as ads,
      coalesce((select b.amount from mlbonif b where b.date = x.d) * coalesce(m.revenue, 0)
               / nullif(sum(coalesce(m.revenue, 0)) over (partition by x.d), 0), 0) as bonif,
      coalesce((select pp.amount from mlpercep pp where pp.date = x.d) * coalesce(m.revenue, 0)
               / nullif(sum(coalesce(m.revenue, 0)) over (partition by x.d), 0), 0) as percep
    from ml_dias x
    left join magg m on m.d = x.d and m.p = x.p
  )
  select a.d, a.c, a.p,
    a.despachadas, a.entregadas, a.rehusadas, a.en_devolucion, a.devueltas, a.siniestros, a.en_transito,
    coalesce((a.entregadas + a.rehusadas + a.en_devolucion + a.devueltas + a.siniestros)::numeric / nullif(a.despachadas, 0), 0),
    coalesce(a.entregadas::numeric / nullif(a.despachadas, 0), 0),
    coalesce((a.entregadas + a.est_deliv)::numeric / nullif(a.despachadas, 0), 0),
    a.cod_entregado + a.senas_netas,
    a.cod_entregado + a.senas_netas + a.est_cod,
    a.senas_netas, a.flete, a.flete_est_pct,
    a.costo,
    (v_comm->>a.c)::numeric * a.cod_entregado,
    0,
    coalesce(al.ads, 0),
    a.cod_entregado + a.senas_netas - a.flete
      - (v_comm->>a.c)::numeric * a.cod_entregado - a.costo - coalesce(al.ads, 0),
    a.cod_entregado + a.senas_netas - a.flete
      - (v_comm->>a.c)::numeric * a.cod_entregado - a.costo - coalesce(al.ads, 0)
      + a.est_cod * (1 - (v_comm->>a.c)::numeric) - a.est_cost,
    now()
  from agg a
  left join ads_alloc al on al.d = a.d and al.c = a.c and al.p = a.p
  union all
  select c.d, 'correo', c.p,
    c.generados, c.pagados, 0, 0, 0, 0, c.en_transito,
    (c.pagados + c.perdidos)::numeric / c.generados,
    c.pagados::numeric / c.generados,
    c.pagados::numeric / c.generados,
    c.revenue,
    c.revenue,
    0, v_flete * c.pagados, 0,
    c.costo,
    c.comision,
    0,
    coalesce(cal.ads, 0),
    c.revenue - c.comision - v_flete * c.pagados - c.costo - coalesce(cal.ads, 0),
    c.revenue - c.comision - v_flete * c.pagados - c.costo - coalesce(cal.ads, 0),
    now()
  from cagg c
  left join ads_alloc cal on cal.d = c.d and cal.c = 'correo' and cal.p = c.p
  union all
  -- filas ML: ya pagadas y entregadas por ML → sin proyección, sin priors. ads = gasto real de las
  -- publicaciones del producto. flete_estimado_pct = fracción con flete pendiente/estimado.
  -- Una fila con vendidas=0 y ads>0 es un producto que gastó pauta sin vender ese día: profit negativo.
  select a.d, 'ml', a.p,
    a.vendidas, a.vendidas, 0, 0, 0, 0, 0,
    1, 1, 1,
    a.revenue, a.revenue,
    0, a.flete - a.bonif,
    case when a.vendidas > 0 then a.flete_pend::numeric / a.vendidas else 0 end,
    a.costo,
    a.comision + a.retencion,
    a.percep,
    a.ads,
    a.revenue - a.comision - a.retencion - a.percep - (a.flete - a.bonif) - a.costo - a.ads,
    a.revenue - a.comision - a.retencion - a.percep - (a.flete - a.bonif) - a.costo - a.ads,
    now()
  from ml_alloc a;
end $fn$;

-- ── Copia de sales_rows (080) con el único cambio del reparto de ads ─────────────────────────
create or replace function sales_rows(p_from date)
returns table (
  d date, c text, p int, generadas int, despachadas int, entregadas int, resueltas int, trabadas int,
  revenue_conf numeric, revenue_est numeric, profit_conf numeric, profit_est numeric,
  flete numeric, comisiones numeric, ads numeric, percepciones numeric
) language plpgsql stable as $fn$
#variable_conflict use_column
declare
  v_comm jsonb   := (select value from settings where key = 'commission_pct');
  v_mp   numeric := (select (value::text)::numeric from settings where key = 'mp_fee_pct');
  v_fw   numeric := (select (value::text)::numeric from settings where key = 'fixy_cpa_multiplier');
  v_dec  jsonb   := (select value from settings where key = 'delivery_decay');   -- 072
  v_dsp  jsonb   := (select value from settings where key = 'dispatch_curve');       -- 080
  v_flp  jsonb   := (select value from settings where key = 'flete_prom_courier');   -- 080
begin
return query
with
  cod_orders as (
    select o.id,
           (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date as d,
           order_primary_product(o.id) as p,
           coalesce(o.courier,
             (select s2.courier from shipments s2 where s2.order_id = o.id
               order by s2.dispatched_at, s2.id limit 1)) as c,
           o.cod_amount as cod, o.deposit_amount as dep, o.province as prov
    from orders o
    where o.cancelled_at is null
      and (o.tags is null or lower(o.tags) not like '%cuotas_3%')
      and order_primary_product(o.id) is not null
      and (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date >= p_from
  ),
  cod_gen as (
    select d, c, p, count(*)::int as generadas from cod_orders group by 1,2,3
  ),
  cod_ship as (
    select co.d, s.courier as c, co.p,
           case when ((s.courier = 'urbano' and s.status_raw = 'PI')
                   or (s.courier = 'fixy' and (s.status_raw = '41'
                        or lower(coalesce(s.status_raw, '')) like '%pendiente de retiro%')))
                     and current_date - s.dispatched_at > 7
                  then 'no_despachado' else s.status_canonical end as st,
           case when ((s.courier = 'urbano' and s.status_raw = 'PI')
                   or (s.courier = 'fixy' and (s.status_raw = '41'
                        or lower(coalesce(s.status_raw, '')) like '%pendiente de retiro%')))
                     and current_date - s.dispatched_at > 7
                  then 0
                when s.courier = 'urbano' and s.freight_tarifa is null and s.freight_cost is null
                  then estimate_urbano_freight(s.province)
                else coalesce(s.freight_cost, 0) end as fc,
           co.cod as cod,
           coalesce(s.status_at, s.dispatched_at::timestamptz) as mov,
           case when row_number() over (partition by co.id order by s.dispatched_at, s.id) = 1
                then co.dep else 0 end as dep,
           coalesce((select sum(oi.qty * coalesce(pc.unit_cost, 0))
                       from order_items oi
                       left join product_costs pc
                              on pc.product_id = oi.product_id and pc.pack = oi.pack
                      where oi.order_id = co.id), 0) as ucost,
           -- 072: × decay(courier, edad). Ver el encabezado de esta migración; el prior solo vale a t=0.
           coalesce(
             (select dp.p_delivery from delivery_priors dp
                where dp.courier = s.courier and dp.province = coalesce(s.province, co.prov)
                  and dp.product_id = co.p),
             (select dp.p_delivery from delivery_priors dp
                where dp.courier = s.courier and dp.province = coalesce(s.province, co.prov)
                  and dp.product_id is null),
             (select dp.p_delivery from delivery_priors dp
                where dp.courier = s.courier and dp.province is null and dp.product_id is null),
             0)
           * coalesce((v_dec -> s.courier ->> least(greatest(current_date - s.dispatched_at, 0), 30))::numeric, 1)
           -- 079: corrección de NIVEL por cohorte. El decay ajusta la forma (edad); esto ajusta
           -- cuánto entrega la cohorte, leído de su propia maduración. k=1 antes del día 7.
           * cohort_k(s.courier, s.dispatched_at)
           as prior
    from cod_orders co
    join shipments s on s.order_id = co.id
    where s.status_canonical <> 'cancelado'
      and s.dispatched_at is not null
  ),
  cod_agg as (
    select d, c, p,
      count(*) filter (where st <> 'no_despachado')::int as despachadas,
      count(*) filter (where st = 'entregado')::int as entregadas,
      count(*) filter (where st in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro'))::int as resueltas,
      count(*) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro','no_despachado')
        and mov < now() - interval '14 days')::int as trabadas,
      coalesce(sum(dep) * (1 - v_mp), 0) as senas_netas,
      coalesce(sum(cod) filter (where st = 'entregado'), 0) as cod_entregado,
      coalesce(sum(fc), 0) as flete,
      coalesce(sum(ucost) filter (where st in ('entregado','siniestro')), 0) as costo,
      coalesce(sum(prior * cod) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro','no_despachado')), 0) as est_cod,
      coalesce(sum(prior * ucost) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro','no_despachado')), 0) as est_cost
    from cod_ship group by 1,2,3
  ),
  -- 080 · Los generados que todavía NO tienen guía. Su pauta ya se les cobra (ads_alloc reparte
  -- por `generadas`), así que sin esto el día de venta reconoce el costo y ninguna de la venta.
  -- Se valúan a δ(edad) × prior: δ es P(despacho | sin guía todavía) y decae con la edad, así que
  -- un pedido de hace 6 días sin guía vale casi nada y uno de hoy vale casi todo.
  cod_sin_guia as (
    select co.d, co.c, co.p,
           count(*)::int as sin_guia,
           coalesce(sum(co.dl * co.pr * co.cod), 0)   as sg_cod,
           coalesce(sum(co.dl * co.pr * co.ucost), 0) as sg_cost,
           coalesce(sum(co.dl * co.fl), 0)            as sg_flete
    from (
      select co.d, co.c, co.p, co.cod,
             coalesce((v_dsp -> co.c ->> least(greatest(current_date - co.d, 0), 30))::numeric, 0) as dl,
             coalesce(
               (select dp.p_delivery from delivery_priors dp where dp.courier = co.c
                 and dp.province = co.prov and dp.product_id = co.p),
               (select dp.p_delivery from delivery_priors dp where dp.courier = co.c
                 and dp.province = co.prov and dp.product_id is null),
               (select dp.p_delivery from delivery_priors dp where dp.courier = co.c
                 and dp.province is null and dp.product_id is null), 0) as pr,
             coalesce((v_flp ->> co.c)::numeric, 0) as fl,
             coalesce((select sum(oi.qty * coalesce(pc.unit_cost, 0))
                         from order_items oi
                         left join product_costs pc
                                on pc.product_id = oi.product_id and pc.pack = oi.pack
                        where oi.order_id = co.id), 0) as ucost
      from cod_orders co
      where co.c in ('urbano','fixy')
        and not exists (select 1 from shipments s
                         where s.order_id = co.id and s.status_canonical <> 'cancelado')
    ) co
    group by 1,2,3
  ),
  gen_weights as (
    select d, c, p, (generadas * case when c = 'fixy' then v_fw else 1 end)::numeric as w
      from cod_gen
    union all
    select dispatch_date, 'correo'::text, product_id, despachadas::numeric
      from daily_pnl where courier = 'correo'
  ),
  ads_dia as (
    select date as d, product_id as p, sum(spend_real) as spend from v_ad_spend
     where date >= p_from group by 1, 2
  ),
  -- 081: pauta sin dueño = producto que no generó pedidos ESE día, o anuncio sin etiquetar. Se
  -- reparte entre los pesos del día (todos los productos y couriers), que es el default a prueba de
  -- la próxima campaña que cambie de producto sin cambiar de nombre.
  ads_huerfana as (
    select a.d, sum(a.spend) as spend from ads_dia a
    where a.p is null or not exists (select 1 from gen_weights w where w.d = a.d and w.p = a.p)
    group by 1
  ),
  ads_alloc as (
    select w.d, w.c, w.p,
           coalesce(a.spend, 0) * w.w / nullif(sum(w.w) over (partition by w.d, w.p), 0)
         + coalesce(h.spend, 0) * w.w / nullif(sum(w.w) over (partition by w.d), 0) as ads
    from gen_weights w
    left join ads_dia a on a.d = w.d and a.p = w.p
    left join ads_huerfana h on h.d = w.d
  ),
  cod_rows as (
    select coalesce(g.d, a.d) as d, coalesce(g.c, a.c) as c, coalesce(g.p, a.p) as p,
           coalesce(g.generadas, 0) as generadas,
           coalesce(a.despachadas, 0) as despachadas,
           coalesce(a.entregadas, 0) as entregadas,
           coalesce(a.resueltas, 0) as resueltas,
           coalesce(a.trabadas, 0) as trabadas,
           coalesce(a.cod_entregado + a.senas_netas, 0) as revenue_conf,
           coalesce(a.cod_entregado + a.senas_netas + a.est_cod, 0) as revenue_est,
           coalesce(a.cod_entregado + a.senas_netas - a.flete
             - (v_comm->>a.c)::numeric * a.cod_entregado - a.costo, 0) as profit_conf_x,
           coalesce(a.cod_entregado + a.senas_netas - a.flete
             - (v_comm->>a.c)::numeric * a.cod_entregado - a.costo
             + a.est_cod * (1 - (v_comm->>a.c)::numeric) - a.est_cost, 0) as profit_est_x,
           -- Los dos son costos FINALES (plata ya comprometida), no proyecciones:
           -- flete: hundido, se paga por TODA guía despachada, entregue o no (§4.1).
           coalesce(a.flete, 0) as flete_x,
           -- comisiones: solo sobre COD efectivamente cobrado en puerta (§4.2). La comisión de lo que
           -- sigue en la calle NO se cuenta acá — vive implícita en est_cod × (1 − comm) del profit
           -- estimado. Misma definición que daily_pnl.comisiones, así los dos paneles coinciden.
           coalesce((v_comm->>a.c)::numeric * a.cod_entregado, 0) as comisiones_x
    from cod_gen g full outer join cod_agg a on a.d = g.d and a.c = g.c and a.p = g.p
  ),
  -- 080 · Se suman al estimado (nunca al confirmado: no hay nada confirmado en un pedido sin guía).
  -- El flete entra por δ y no por δ×prior: se paga al despachar, entregue o no (§4.1).
  cod_rows_sg as (
    select r.d, r.c, r.p, r.generadas, r.despachadas, r.entregadas, r.resueltas, r.trabadas,
           r.revenue_conf,
           r.revenue_est + coalesce(sg.sg_cod, 0) as revenue_est,
           r.profit_conf_x,
           r.profit_est_x + coalesce(sg.sg_cod, 0) * (1 - (v_comm->>r.c)::numeric)
                          - coalesce(sg.sg_cost, 0) - coalesce(sg.sg_flete, 0) as profit_est_x,
           r.flete_x, r.comisiones_x
    from cod_rows r
    left join cod_sin_guia sg on sg.d = r.d and sg.c = r.c and sg.p = r.p
  ),
  correo_rows as (
    select dispatch_date as d, 'correo'::text as c, product_id as p,
           despachadas as generadas, despachadas, entregadas,
           (despachadas - en_transito) as resueltas,   -- 067: en correo, pagados + perdidos
           0 as trabadas,
           revenue_confirmado as revenue_conf, revenue_estimado as revenue_est,
           profit_confirmado + ads as profit_conf_x, profit_estimado + ads as profit_est_x,
           flete as flete_x, comisiones as comisiones_x
    from daily_pnl where courier = 'correo'
  ),
  meta_rows as (
    select r.d, r.c, r.p, r.generadas, r.despachadas, r.entregadas, r.resueltas, r.trabadas,
           r.revenue_conf, r.revenue_est,
           r.profit_conf_x - coalesce(al.ads, 0) as profit_conf,
           r.profit_est_x  - coalesce(al.ads, 0) as profit_est,
           r.flete_x as flete, r.comisiones_x as comisiones,
           coalesce(al.ads, 0) as ads,
           0 as percepciones
    from (select * from cod_rows_sg union all select * from correo_rows) r
    left join ads_alloc al on al.d = r.d and al.c = r.c and al.p = r.p
  ),
  ml_rows as (
    select dispatch_date as d, 'ml'::text as c, product_id as p,
           despachadas as generadas, despachadas, entregadas,
           (despachadas - en_transito) as resueltas,   -- 067: en correo, pagados + perdidos
           0 as trabadas,
           revenue_confirmado as revenue_conf, revenue_estimado as revenue_est,
           profit_confirmado as profit_conf, profit_estimado as profit_est,
           flete, comisiones, ads, percepciones
    from daily_pnl where courier = 'ml'
  )
  select x.d, x.c, x.p, x.generadas, x.despachadas, x.entregadas, x.resueltas, x.trabadas,
         x.revenue_conf, x.revenue_est, x.profit_conf, x.profit_est,
         x.flete, x.comisiones, x.ads, x.percepciones
  from (select * from meta_rows union all select * from ml_rows) x
  where x.d >= p_from;
end $fn$;

revoke execute on function recompute_daily_pnl(date, date) from anon, authenticated;
revoke execute on function sales_rows(date) from anon;
grant execute on function sales_rows(date) to authenticated, service_role;

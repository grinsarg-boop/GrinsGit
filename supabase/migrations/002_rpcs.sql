-- BioLabs Finanzas COD — 002_rpcs
-- Reemplaza los stubs de 001 según SPEC §4 (fórmulas LOCKED) y §5.1 (contratos).
-- Toda la lógica de negocio vive acá; los route handlers solo normalizan y llaman.

-- Fallback de tarifa Urbano cuando no hay ni facturación ni promedio rolling (§4.1).
insert into settings (key, value) values ('urbano_freight_fallback', '10200')
on conflict (key) do nothing;

-- ============ HELPERS ============

-- Keyword → producto (§5.1). Usado por upsert_order y upsert_ad_spend.
-- lib/product-match.ts es el espejo TS de estas mismas reglas (test en vitest, R2).
create or replace function match_product(p_text text) returns int
language sql stable as $$
  select p.id
  from (values ('nature','Natures'), ('pureza','Pureza'), ('vein','Veinguard'),
               ('bee','BeeVenom'), ('altus','Altus')) k(kw, name)
  join products p on p.name = k.name
  where p_text ilike '%' || k.kw || '%'
  limit 1
$$;

-- Pack por regex sobre title+variant_title (§5.1). Default 1.
create or replace function match_pack(p_text text) returns int
language sql immutable as $$
  select coalesce(
    (regexp_match(p_text, 'x\s*(\d)', 'i'))[1]::int,
    (regexp_match(p_text, '(\d)\s*(unid|frascos?|pack|u\M)', 'i'))[1]::int,
    1)
$$;

-- Mapeo estado crudo → canónico: exact → keyword (más específico primero) → incidencia (§3).
create or replace function map_status(p_courier text, p_raw text) returns text
language sql stable as $$
  select coalesce(
    (select status_canonical from courier_status_map
      where courier = p_courier and match_type = 'exact'
        and upper(trim(status_raw)) = upper(trim(p_raw)) limit 1),
    (select status_canonical from courier_status_map
      where courier = p_courier and match_type = 'keyword'
        and p_raw ilike '%' || status_raw || '%'
      order by length(status_raw) desc limit 1),
    'incidencia')
$$;

-- Producto principal de un pedido: el ítem de mayor facturación (desempate: id menor).
-- ponytail: un pedido con 2 productos distintos atribuye toda la guía al principal;
-- en la práctica COD es 1 producto por pedido.
create or replace function order_primary_product(p_order_id bigint) returns int
language sql stable as $$
  select oi.product_id from order_items oi
  where oi.order_id = p_order_id and oi.product_id is not null
  order by oi.qty * oi.unit_price desc, oi.product_id
  limit 1
$$;

-- Tarifa estimada Urbano (§4.1): promedio real por provincia (rolling) → global → fallback.
create or replace function estimate_urbano_tarifa(p_province text) returns numeric
language sql stable as $$
  with w as (select (value::text)::int days from settings where key = 'freight_avg_window_days')
  select coalesce(
    (select avg(freight_tarifa) from shipments, w
      where courier = 'urbano' and freight_tarifa is not null
        and province = p_province and dispatched_at >= current_date - w.days),
    (select avg(freight_tarifa) from shipments, w
      where courier = 'urbano' and freight_tarifa is not null
        and dispatched_at >= current_date - w.days),
    (select (value::text)::numeric from settings where key = 'urbano_freight_fallback'))
$$;

-- ============ RPCs (§5.1) ============

-- p = order de Shopify tal cual (raw). Idempotente por shopify_id.
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
  m text[];
begin
  -- Seña por tag / prepago total (§4.3, §5.1)
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

  -- Si ya hay shipment con courier real, manda eso sobre la clasificación (§5.1)
  select courier into v_ship_courier from shipments where order_id = v_id limit 1;
  if v_ship_courier is not null then
    update orders set courier = v_ship_courier where id = v_id;
  end if;

  -- Ítems: producto·pack por keyword/regex (§5.1)
  delete from order_items where order_id = v_id;
  insert into order_items (order_id, product_id, pack, qty, unit_price, title_raw)
  select v_id,
         match_product(coalesce(li->>'title', '')),
         match_pack(coalesce(li->>'title', '') || ' ' || coalesce(li->>'variant_title', '')),
         coalesce((li->>'quantity')::int, 1),
         coalesce((li->>'price')::numeric, 0),
         li->>'title'
  from jsonb_array_elements(coalesce(p->'line_items', '[]'::jsonb)) li;

  -- Guías huérfanas que referencian este pedido quedan linkeadas (R4)
  update shipments set order_id = v_id, updated_at = now()
  where order_id is null and order_ref is not null
    and replace(order_ref, '#', '') = v_number;

  return v_id;
end $fn$;

-- p = array de CourierEvent (§5.4). Devuelve eventos nuevos insertados.
create or replace function upsert_shipment_events(p jsonb) returns int
language plpgsql as $fn$
declare
  e jsonb;
  v_ship bigint; v_canon text; v_ins int; v_count int := 0;
  v_courier text; v_tarifa numeric; v_importe numeric;
  v_mult numeric := (select (value::text)::numeric from settings where key = 'urbano_freight_mult');
begin
  for e in select * from jsonb_array_elements(p) loop
    v_courier := e->>'courier';

    insert into shipments (courier, tracking, order_ref, province, raw)
    values (v_courier, e->>'tracking', e->>'order_ref', e->>'province', coalesce(e->'raw', '{}'::jsonb))
    on conflict (courier, tracking) do update set
      order_ref = coalesce(shipments.order_ref, excluded.order_ref),
      province  = coalesce(shipments.province, excluded.province)
    returning id into v_ship;

    v_canon := map_status(v_courier, e->>'status_raw');
    insert into shipment_events (shipment_id, status_raw, status_canonical, occurred_at, raw)
    values (v_ship, e->>'status_raw', v_canon, (e->>'occurred_at')::timestamptz, e->'raw')
    on conflict do nothing;
    get diagnostics v_ins = row_count;
    v_count := v_count + v_ins;

    -- Flete real (§4.1): urbano tarifa × mult, fixy importe tal cual
    v_tarifa  := (e->>'tarifa')::numeric;
    v_importe := (e->>'importe')::numeric;
    if v_courier = 'urbano' and v_tarifa is not null then
      update shipments set freight_tarifa = v_tarifa, freight_cost = v_tarifa * v_mult,
             freight_is_estimated = false where id = v_ship;
    elsif v_courier = 'fixy' and v_importe is not null then
      update shipments set freight_tarifa = v_importe, freight_cost = v_importe,
             freight_is_estimated = false where id = v_ship;
    end if;

    -- Estado canónico = último evento; resolved_at solo terminales (§3)
    update shipments s set
      status_raw = le.status_raw, status_canonical = le.status_canonical, status_at = le.occurred_at,
      resolved_at = case when le.status_canonical in ('entregado','devuelto','siniestro','cancelado')
                         then le.occurred_at end,
      dispatched_at = coalesce(s.dispatched_at, fe.d),
      updated_at = now()
    from (select status_raw, status_canonical, occurred_at from shipment_events
           where shipment_id = v_ship order by occurred_at desc limit 1) le,
         (select min(occurred_at)::date as d from shipment_events where shipment_id = v_ship) fe
    where s.id = v_ship;
  end loop;

  -- Matching guía↔pedido por order_ref; reintenta en cada sync (§5.4, R4)
  update shipments s
     set order_id = o.id, province = coalesce(s.province, o.province), updated_at = now()
  from orders o
  where s.order_id is null and s.order_ref is not null
    and replace(s.order_ref, '#', '') = o.order_number;

  -- Flete estimado por provincia para urbano sin facturar (§4.1)
  update shipments
     set freight_cost = estimate_urbano_tarifa(province) * v_mult, freight_is_estimated = true
  where courier = 'urbano' and freight_tarifa is null
    and (freight_cost is null or freight_is_estimated);

  return v_count;
end $fn$;

-- p = array {date, ad_id, ad_name, campaign_name, spend, purchases} (§5.3)
create or replace function upsert_ad_spend(p jsonb) returns int
language plpgsql as $fn$
declare v_count int;
begin
  insert into ad_spend (date, ad_id, ad_name, campaign_name, spend, purchases, product_id)
  select (x->>'date')::date, x->>'ad_id', x->>'ad_name', x->>'campaign_name',
         coalesce((x->>'spend')::numeric, 0), coalesce((x->>'purchases')::int, 0),
         match_product(coalesce(x->>'ad_name', '') || ' ' || coalesce(x->>'campaign_name', ''))
  from jsonb_array_elements(p) x
  on conflict (date, ad_id) do update set
    ad_name = excluded.ad_name, campaign_name = excluded.campaign_name,
    spend = excluded.spend, purchases = excluded.purchases,
    -- product_locked = override manual, el sync no lo pisa (§5.3)
    product_id = case when ad_spend.product_locked then ad_spend.product_id
                      else excluded.product_id end;
  get diagnostics v_count = row_count;
  return v_count;
end $fn$;

-- Facturación Urbano (§5.5): pisa el flete estimado y recalcula el rango afectado.
-- p = array {tracking, tarifa}
create or replace function import_urbano_freight(p jsonb) returns int
language plpgsql as $fn$
declare
  v_mult numeric := (select (value::text)::numeric from settings where key = 'urbano_freight_mult');
  v_n int; v_from date; v_to date;
begin
  with rows as (
    select x->>'tracking' as tracking, (x->>'tarifa')::numeric as tarifa
    from jsonb_array_elements(p) x
    where x->>'tracking' is not null and (x->>'tarifa') is not null
  ),
  upd as (
    update shipments s
       set freight_tarifa = r.tarifa, freight_cost = r.tarifa * v_mult,
           freight_is_estimated = false, updated_at = now()
    from rows r
    where s.courier = 'urbano' and s.tracking = r.tracking
    returning s.dispatched_at
  )
  select count(*), min(dispatched_at), max(dispatched_at) into v_n, v_from, v_to from upd;

  if v_from is not null then
    perform recompute_daily_pnl(v_from, v_to);
  end if;
  return v_n;
end $fn$;

-- P&L por (fecha_despacho, courier, producto) — §4.7.
-- Fase 1: SOLO confirmado (R10). estimado = confirmado hasta R16; tasa_proyectada null.
create or replace function recompute_daily_pnl(p_from date, p_to date) returns void
language plpgsql as $fn$
declare
  v_comm jsonb   := (select value from settings where key = 'commission_pct');
  v_mp   numeric := (select (value::text)::numeric from settings where key = 'mp_fee_pct');
  v_mult numeric := (select (value::text)::numeric from settings where key = 'urbano_freight_mult');
  v_fw   numeric := (select (value::text)::numeric from settings where key = 'fixy_cpa_multiplier');
begin
  -- Pack sin fila en product_costs → extrapolar del pack 1 × unidades, is_estimated (§4.4)
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

  -- Refrescar flete estimado urbano sin facturar (§4.1)
  update shipments
     set freight_cost = estimate_urbano_tarifa(province) * v_mult, freight_is_estimated = true
  where courier = 'urbano' and freight_tarifa is null
    and dispatched_at between p_from and p_to;

  delete from daily_pnl where dispatch_date between p_from and p_to;

  insert into daily_pnl (dispatch_date, courier, product_id,
    despachadas, entregadas, rehusadas, en_devolucion, devueltas, siniestros, en_transito,
    pct_resuelto, tasa_actual, tasa_proyectada,
    revenue_confirmado, revenue_estimado, senas_netas, flete, flete_estimado_pct,
    costo_producto, comisiones, ads, profit_confirmado, profit_estimado, computed_at)
  with ship as (
    -- Cohorte: guías con pedido y producto conocidos; el resto va a v_sin_clasificar (§2).
    -- ponytail: cancelado queda fuera de despachadas (se anuló antes de viajar).
    select s.dispatched_at as d, s.courier as c, order_primary_product(o.id) as p,
           s.status_canonical as st,
           coalesce(s.freight_cost, 0) as fc, s.freight_is_estimated as fe,
           o.cod_amount as cod, o.deposit_amount as dep,
           coalesce((select sum(oi.qty * coalesce(pc.unit_cost, 0))
                       from order_items oi
                       left join product_costs pc
                              on pc.product_id = oi.product_id and pc.pack = oi.pack
                      where oi.order_id = o.id), 0) as ucost
    from shipments s
    join orders o on o.id = s.order_id
    where s.dispatched_at between p_from and p_to
      and s.status_canonical <> 'cancelado'
      and order_primary_product(o.id) is not null
  ),
  agg as (
    select d, c, p,
      count(*)::int as despachadas,
      count(*) filter (where st = 'entregado')::int as entregadas,
      count(*) filter (where st = 'rehusado')::int as rehusadas,
      count(*) filter (where st = 'en_devolucion')::int as en_devolucion,
      count(*) filter (where st = 'devuelto')::int as devueltas,
      count(*) filter (where st = 'siniestro')::int as siniestros,
      count(*) filter (where st not in
        ('entregado','rehusado','en_devolucion','devuelto','siniestro'))::int as en_transito,
      sum(fc) as flete,
      case when sum(fc) > 0
           then coalesce(sum(fc) filter (where fe), 0) / sum(fc) else 0 end as flete_est_pct,
      sum(dep) * (1 - v_mp) as senas_netas,                          -- §4.3
      coalesce(sum(cod) filter (where st = 'entregado'), 0) as cod_entregado,
      coalesce(sum(ucost) filter (where st in ('entregado','siniestro')), 0) as costo  -- §4.4
    from ship
    group by 1, 2, 3
  ),
  -- Pauta §4.6: spend(producto, día) repartido por despachos ponderados entre couriers
  ads_alloc as (
    select sp.date as d, sp.product_id as p, a.c,
           sp.spend_total * (a.despachadas * case when a.c = 'fixy' then v_fw else 1 end)
             / sum(a.despachadas * case when a.c = 'fixy' then v_fw else 1 end)
               over (partition by sp.date, sp.product_id) as ads
    from (select date, product_id, sum(spend) as spend_total
            from ad_spend
           where date between p_from and p_to and product_id is not null
           group by 1, 2) sp
    join agg a on a.d = sp.date and a.p = sp.product_id
  )
  select a.d, a.c, a.p,
    a.despachadas, a.entregadas, a.rehusadas, a.en_devolucion, a.devueltas, a.siniestros, a.en_transito,
    (a.entregadas + a.rehusadas + a.en_devolucion + a.devueltas + a.siniestros)::numeric
      / a.despachadas as pct_resuelto,
    a.entregadas::numeric / a.despachadas as tasa_actual,
    null::numeric as tasa_proyectada,                                 -- Fase 2 (R16)
    a.cod_entregado + a.senas_netas as revenue_confirmado,            -- §4.7
    a.cod_entregado + a.senas_netas as revenue_estimado,              -- = confirmado hasta R16
    a.senas_netas, a.flete, a.flete_est_pct,
    a.costo,
    (v_comm->>a.c)::numeric * a.cod_entregado as comisiones,          -- §4.2
    coalesce(al.ads, 0) as ads,
    a.cod_entregado + a.senas_netas - a.flete
      - (v_comm->>a.c)::numeric * a.cod_entregado - a.costo - coalesce(al.ads, 0)
      as profit_confirmado,
    a.cod_entregado + a.senas_netas - a.flete
      - (v_comm->>a.c)::numeric * a.cod_entregado - a.costo - coalesce(al.ads, 0)
      as profit_estimado,                                             -- = confirmado hasta R16
    now()
  from agg a
  left join ads_alloc al on al.d = a.d and al.c = a.c and al.p = a.p;
end $fn$;

-- Priors P(entrega) §4.5: cohortes maduras, rolling, fallback por nivel.
create or replace function recompute_priors() returns void
language plpgsql as $fn$
declare
  v_mat jsonb := (select value from settings where key = 'maturity_days');
  v_win int   := (select (value::text)::int from settings where key = 'prior_window_days');
  v_min int   := (select (value::text)::int from settings where key = 'prior_min_n');
begin
  create temp table _prior_cohort on commit drop as
  select s.courier as c, coalesce(s.province, o.province) as prov,
         order_primary_product(o.id) as p,
         (s.status_canonical = 'entregado')::int as deliv
  from shipments s
  join orders o on o.id = s.order_id
  where s.status_canonical <> 'cancelado'
    and s.dispatched_at <= current_date - ((v_mat->>s.courier)::int)
    and s.dispatched_at >= greatest(current_date - 45,
                                    current_date - ((v_mat->>s.courier)::int) - v_win);

  -- Nivel 3: courier (pisa los seeds level 9)
  insert into delivery_priors (courier, province, product_id, p_delivery, n, level, computed_at)
  select c, null, null, avg(deliv), count(*), 3, now()
  from _prior_cohort group by c
  on conflict (courier, (coalesce(province, '*')), (coalesce(product_id, 0)))
  do update set p_delivery = excluded.p_delivery, n = excluded.n, level = 3, computed_at = now();

  -- Nivel 2: courier + provincia (fallback a courier si n < prior_min_n)
  insert into delivery_priors (courier, province, product_id, p_delivery, n, level, computed_at)
  select l2.c, l2.prov, null,
         case when l2.n >= v_min then l2.pd else l3.pd end,
         case when l2.n >= v_min then l2.n  else l3.n  end,
         case when l2.n >= v_min then 2 else 3 end, now()
  from (select c, prov, count(*) n, avg(deliv) pd from _prior_cohort
         where prov is not null group by c, prov) l2
  join (select c, count(*) n, avg(deliv) pd from _prior_cohort group by c) l3 on l3.c = l2.c
  on conflict (courier, (coalesce(province, '*')), (coalesce(product_id, 0)))
  do update set p_delivery = excluded.p_delivery, n = excluded.n,
                level = excluded.level, computed_at = now();

  -- Nivel 1: courier + provincia + producto (fallback → nivel 2 → nivel 3)
  insert into delivery_priors (courier, province, product_id, p_delivery, n, level, computed_at)
  select l1.c, l1.prov, l1.p,
         case when l1.n >= v_min then l1.pd when l2.n >= v_min then l2.pd else l3.pd end,
         case when l1.n >= v_min then l1.n  when l2.n >= v_min then l2.n  else l3.n  end,
         case when l1.n >= v_min then 1 when l2.n >= v_min then 2 else 3 end, now()
  from (select c, prov, p, count(*) n, avg(deliv) pd from _prior_cohort
         where prov is not null and p is not null group by c, prov, p) l1
  join (select c, prov, count(*) n, avg(deliv) pd from _prior_cohort
         where prov is not null group by c, prov) l2 on l2.c = l1.c and l2.prov = l1.prov
  join (select c, count(*) n, avg(deliv) pd from _prior_cohort group by c) l3 on l3.c = l1.c
  on conflict (courier, (coalesce(province, '*')), (coalesce(product_id, 0)))
  do update set p_delivery = excluded.p_delivery, n = excluded.n,
                level = excluded.level, computed_at = now();

  drop table _prior_cohort;
end $fn$;

-- ============ VISTAS (§2, §4.6, §6.3/6.4) ============

-- Guías fuera de daily_pnl: sin pedido o con producto desconocido. No inventar atribuciones.
create or replace view v_sin_clasificar as
select s.id, s.courier, s.tracking, s.order_ref, s.dispatched_at,
       s.status_canonical, s.status_raw,
       case when s.order_id is null then 'sin pedido' else 'producto desconocido' end as motivo
from shipments s
where s.order_id is null
   or order_primary_product(s.order_id) is null;

-- Estados crudos vistos que hoy no matchean ningún mapeo → completar desde /config (§3).
create or replace view v_estados_sin_mapear as
select distinct s.courier, se.status_raw
from shipment_events se
join shipments s on s.id = se.shipment_id
where not exists (
  select 1 from courier_status_map m
  where m.courier = s.courier and (
    (m.match_type = 'exact' and upper(trim(m.status_raw)) = upper(trim(se.status_raw))) or
    (m.match_type = 'keyword' and se.status_raw ilike '%' || m.status_raw || '%')));

-- Spend sin despachos ese día para ese producto: línea aparte en el total del día (§4.6).
create or replace view v_ads_sin_cohorte as
select a.date, a.product_id, p.name as product, sum(a.spend) as spend
from ad_spend a
left join products p on p.id = a.product_id
where a.product_id is null
   or not exists (
     select 1 from shipments s
     join orders o on o.id = s.order_id
     where s.dispatched_at = a.date and s.status_canonical <> 'cancelado'
       and order_primary_product(o.id) = a.product_id)
group by a.date, a.product_id, p.name;

-- ============ PERMISOS ============
-- Las RPCs mutan datos: solo el service role (server-side) puede ejecutarlas.
revoke execute on function upsert_order(jsonb) from anon, authenticated;
revoke execute on function upsert_shipment_events(jsonb) from anon, authenticated;
revoke execute on function upsert_ad_spend(jsonb) from anon, authenticated;
revoke execute on function import_urbano_freight(jsonb) from anon, authenticated;
revoke execute on function recompute_daily_pnl(date, date) from anon, authenticated;
revoke execute on function recompute_priors() from anon, authenticated;
revoke execute on function log_sync_run(text, text, int, jsonb, text) from anon, authenticated;

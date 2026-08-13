-- 072 · El "estimado" estaba inflado ~30%: le aplicaba una probabilidad TERMINAL a guías viejas.
--
-- Síntoma (medido 13/08/2026): el pipeline COD abierto de agosto valuado en $9.987.675 contra
-- $7.674.202 reales → +$2,31 M (+30,1%). No se arregla subiendo la tasa de entrega: aun poniendo
-- Urbano al 60% el estimado seguía inflado 14,9%.
--
-- Causa 1 — el prior terminal se aplicaba PLANO a toda guía abierta, sin término de edad.
--   `delivery_priors.p_delivery` es P(entrega) *incondicional*, desde el día 0. Pero una guía que
--   sigue abierta al día 10 ya no es un caso promedio: las entregas resuelven rápido y lo que queda
--   abierto es mayoritariamente devolución. Lo que corresponde es P(entrega | sigue abierta a la
--   edad t), que decae con t. Había una constante donde va una curva.
--   Medido en Urbano: a una guía de 10 días le asignaba 52,8% cuando vale 13,7%.
--
-- Causa 2 — el filtro de madurez de la cohorte era un contador de días fijo, no un % resuelto.
--   `settings.maturity_days` = {urbano: 10, fixy: 7}. A los 10 días una cohorte de Urbano está al
--   44,5% resuelto: el prior se calculaba sobre cohortes que todavía no maduraron. El canon fijado
--   por Pancho el 13/08/2026 es **≥90% resuelto**; medido hoy eso son 25 días en Urbano y 13 en Fixy.
--
-- Fix: `recompute_priors` mide las dos curvas sobre la misma cohorte y guarda el factor de decaimiento
-- en `settings.delivery_decay` (jsonb, un array de 31 posiciones por courier: t=0..30). Los dos
-- consumidores del prior multiplican por él:
--     P(entrega | abierta a edad t, celda) = prior_celda × decay(courier, t)
-- El decay es un RATIO (h(t)/h(0)), así que preserva intacta la granularidad courier×provincia×producto
-- del prior y solo le agrega el eje que faltaba. A t=0 vale 1 → sin cambio respecto de hoy.
--
-- Backtest (cohorte Urbano 01-15/07, hoy cerrada, 605 entregas reales; al método viejo se le REGALA la
-- tasa terminal verdadera de la propia cohorte para aislar la causa 1):
--     corte    día 3     día 5     día 7     día 10    día 14
--     viejo    +11,5%    +21,7%    +33,9%    +39,4%    +34,6%
--     nuevo    -11,6%    -10,7%     -6,5%     -2,8%     -0,4%
-- El método viejo se aleja de la verdad a medida que la cohorte envejece, que es al revés de lo que
-- tiene que hacer una proyección. El nuevo converge.
--
-- OJO — la fecha de resolución de Fixy anterior a julio/2026 no existe: el histórico se importó con
-- `occurred_at` = fecha de despacho (540/540 guías de mayo y 519/566 de junio con edad 0, verificado
-- también contra `shipment_events`, que da lo mismo). Una curva medida sobre esa ventana sale
-- degenerada (decay ≡ 0). De ahí la guarda `>50% con edad 0 → decay ≡ 1`: ante fechas rotas el courier
-- vuelve al comportamiento de hoy en vez de proyectar cero. La ventana viva (últimos 45 días) ya es
-- toda julio+, así que hoy la guarda no se activa; está para que no se active sola en silencio.
--
-- NO toca la rama correo/cuotas: ahí el prior es P(confirmación) y la cohorte ya se filtra por
-- `not matured`, que hace de término de edad (burdo, pero existe). Su hazard es otro problema.

create or replace function recompute_priors() returns void
language plpgsql as $fn$
declare
  v_mat  jsonb := (select value from settings where key = 'maturity_days');
  v_win  int   := (select (value::text)::int from settings where key = 'prior_window_days');
  v_min  int   := (select (value::text)::int from settings where key = 'prior_min_n');
  v_decay jsonb;
begin
  -- ---- Base COD: edad de hoy + edad a la que resolvió (0 si resolvió el día del despacho) ----
  create temp table _base on commit drop as
  select s.id, s.courier, s.dispatched_at,
         (current_date - s.dispatched_at) as edad_hoy,
         (s.status_canonical = 'entregado')::int as deliv,
         case when s.status_canonical in ('entregado','rehusado','en_devolucion','devuelto','siniestro')
              then greatest(coalesce(s.resolved_at, s.status_at)::date - s.dispatched_at, 0) end as edad_res
  from shipments s
  where s.courier in ('urbano','fixy')
    and s.status_canonical <> 'cancelado'
    and s.dispatched_at >= current_date - 120;

  -- ---- Madurez = primer t con ≥90% resuelto (canon 13/08/2026), sobre los últimos 60 días ----
  -- Exacto para cualquier t sin circularidad: para saber si una guía estaba resuelta a la edad t
  -- alcanza con que hayan pasado t días desde su despacho (`edad_hoy >= t`), no hace falta que la
  -- cohorte esté cerrada. Tope 30 días: más allá el prior se quedaría sin ventana.
  create temp table _madurez on commit drop as
  select courier, coalesce(min(t) filter (where pct >= 0.90), 30)::int as dias
  from (
    select b.courier, t.t, avg((b.edad_res is not null and b.edad_res <= t.t)::int) as pct
    from (select generate_series(0, 30) as t) t
    join _base b on b.edad_hoy >= t.t and b.edad_hoy <= 60
    group by 1, 2
  ) x
  group by courier;

  -- La madurez medida pisa `settings.maturity_days` (correo queda como está: es P(confirmación),
  -- otra cohorte y otro desenlace). Así los demás lectores ven el valor real y no el fijo viejo.
  update settings set value = value || (select jsonb_object_agg(courier, dias) from _madurez)
   where key = 'maturity_days';
  v_mat := (select value from settings where key = 'maturity_days');

  -- ---- Curva de decaimiento: decay(c,t) = P(entrega | abierta a edad t) / P(entrega) ----
  -- Se mide sobre la MISMA ventana de cohortes maduras que el prior, así las dos piezas no pueden
  -- desincronizarse. Monótona no creciente por construcción (`min() over`), que es lo que dice la
  -- teoría: sobrevivir un día más nunca mejora las chances. Los puntos con menos de 20 guías abiertas
  -- no se estiman: heredan el último valor confiable (el min() over ignora los nulls).
  create temp table _cohd on commit drop as
  select b.courier, b.deliv, b.edad_res
  from _base b join _madurez m on m.courier = b.courier
  where b.edad_hoy >= m.dias
    and b.dispatched_at >= greatest(current_date - 45, current_date - m.dias - v_win);

  select jsonb_object_agg(courier, arr) into v_decay from (
    select courier, jsonb_agg(round(decay, 4) order by t) as arr
    from (
      select h.courier, h.t,
             coalesce(min(case when h.n_ab >= 20 then least(h.p / h0.p0, 1) end)
                        over (partition by h.courier order by h.t
                              rows between unbounded preceding and current row), 1) as decay
      from (
        select c.courier, t.t,
               count(*) filter (where c.edad_res is null or c.edad_res > t.t) as n_ab,
               avg(c.deliv) filter (where c.edad_res is null or c.edad_res > t.t) as p
        from (select generate_series(0, 30) as t) t
        cross join _cohd c
        group by 1, 2
      ) h
      join (
        -- Guarda: cohorte chica, o fechas de resolución rotas (>50% resolviendo el mismo día del
        -- despacho, que es la firma del histórico importado sin fechas) ⇒ el courier queda afuera del
        -- jsonb y sus consumidores caen a decay = 1, o sea el comportamiento anterior a esta migración.
        select courier, avg(deliv) as p0 from _cohd
        group by courier
        having count(*) >= 100 and avg((edad_res = 0)::int) <= 0.5
      ) h0 on h0.courier = h.courier
    ) d group by courier
  ) z;

  insert into settings (key, value) values ('delivery_decay', coalesce(v_decay, '{}'::jsonb))
  on conflict (key) do update set value = excluded.value;

  -- ---- COD: P(entrega) por courier/provincia/producto (igual que antes, pero con cohorte madura) ----
  create temp table _prior_cohort on commit drop as
  select s.courier as c, coalesce(s.province, o.province) as prov,
         order_primary_product(o.id) as p,
         (s.status_canonical = 'entregado')::int as deliv
  from shipments s
  join orders o on o.id = s.order_id
  join _madurez m on m.courier = s.courier
  where s.status_canonical <> 'cancelado'
    and s.dispatched_at <= current_date - m.dias
    and s.dispatched_at >= greatest(current_date - 45, current_date - m.dias - v_win);

  insert into delivery_priors (courier, province, product_id, p_delivery, n, level, computed_at)
  select c, null, null, avg(deliv), count(*), 3, now()
  from _prior_cohort group by c
  on conflict (courier, (coalesce(province, '*')), (coalesce(product_id, 0)))
  do update set p_delivery = excluded.p_delivery, n = excluded.n, level = 3, computed_at = now();

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
  drop table _prior_cohort; drop table _cohd; drop table _madurez; drop table _base;

  -- ---- CORREO/cuotas: P(confirmación) = pagados/generados sobre cuotas MADURAS (sin cambios) ----
  create temp table _cuotas_cohort on commit drop as
  select order_primary_product(o.id) as p, (o.financial_status = 'paid')::int as conf
  from orders o
  where o.cancelled_at is null and lower(o.tags) like '%cuotas_3%'
    and order_primary_product(o.id) is not null
    and o.created_at::date <= current_date - ((v_mat->>'correo')::int)
    and o.created_at::date >= greatest(current_date - 45,
                                       current_date - ((v_mat->>'correo')::int) - v_win);

  insert into delivery_priors (courier, province, product_id, p_delivery, n, level, computed_at)
  select 'correo', null, null, avg(conf), count(*), 3, now()
  from _cuotas_cohort having count(*) > 0
  on conflict (courier, (coalesce(province, '*')), (coalesce(product_id, 0)))
  do update set p_delivery = excluded.p_delivery, n = excluded.n, level = 3, computed_at = now();

  insert into delivery_priors (courier, province, product_id, p_delivery, n, level, computed_at)
  select 'correo', null, l1.p,
         case when l1.n >= v_min then l1.pd else l3.pd end,
         case when l1.n >= v_min then l1.n  else l3.n  end,
         case when l1.n >= v_min then 1 else 3 end, now()
  from (select p, count(*) n, avg(conf) pd from _cuotas_cohort where p is not null group by p) l1
  cross join (select count(*) n, avg(conf) pd from _cuotas_cohort) l3
  where l3.n > 0
  on conflict (courier, (coalesce(province, '*')), (coalesce(product_id, 0)))
  do update set p_delivery = excluded.p_delivery, n = excluded.n,
                level = excluded.level, computed_at = now();
  drop table _cuotas_cohort;
end $fn$;

revoke execute on function recompute_priors() from anon, authenticated;



-- ============================================================================
-- Consumo del decay. El prior plano se aplicaba en DOS lugares, no uno:
--   · `recompute_daily_pnl` → daily_pnl.profit_estimado / revenue_estimado / tasa_proyectada, que es
--      lo que leen el Resumen (`dashboard_days`) y /tendencias.
--   · `sales_rows` → la columna "Profit estimado" y la vela gris de /ventas.
-- Arreglar uno solo dejaba el otro inflado. Las dos funciones van enteras porque así se redefinen en
-- este repo; lo ÚNICO que cambia respecto de su última versión (062 y 067) es el término × decay.
-- La rama correo/cuotas no lleva decay: su prior es P(confirmación) y su cohorte ya se filtra por
-- `not matured`, que hace de término de edad.
-- ============================================================================

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
  ads_alloc as (
    select w.d, w.c, w.p,
           sp.spend_total * w.w / nullif(sum(w.w) over (partition by w.p), 0) as ads
    from ads_weights w
    join (select product_id, sum(spend) as spend_total from ad_spend
           where date between p_from and p_to and product_id is not null group by 1) sp
      on sp.product_id = w.p
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

revoke execute on function recompute_daily_pnl(date, date) from anon, authenticated;
drop function if exists sales_rows(date);
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
  gen_weights as (
    select d, c, p, (generadas * case when c = 'fixy' then v_fw else 1 end)::numeric as w
      from cod_gen
    union all
    select dispatch_date, 'correo'::text, product_id, despachadas::numeric
      from daily_pnl where courier = 'correo'
  ),
  ads_alloc as (
    select w.d, w.c, w.p,
           sp.spend * w.w / nullif(sum(w.w) over (partition by w.d, w.p), 0) as ads
    from gen_weights w
    join (select date, product_id, sum(spend) as spend from ad_spend
           where date >= p_from and product_id is not null group by 1,2) sp
      on sp.date = w.d and sp.product_id = w.p
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
    from (select * from cod_rows union all select * from correo_rows) r
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

revoke execute on function sales_rows(date) from anon;
grant execute on function sales_rows(date) to authenticated, service_role;

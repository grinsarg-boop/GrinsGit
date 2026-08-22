-- 080 · El día de venta deja de cobrar la pauta sin reconocer la venta.
--
-- PROBLEMA (medido 21/08/2026). El P&L cohortiza por fecha de DESPACHO. Un pedido generado que
-- todavía no tiene guía no está mal estimado: no existe. Pero su pauta SÍ se le cobra al día de
-- venta, porque `ads_alloc` reparte el gasto por `generadas` — que los cuenta. Resultado: cada día
-- de venta arranca reconociendo el costo completo y nada de la venta.
--
-- Cuánto: ~$6,8 M de revenue bruto de los últimos 3 días (21/08). Se cierra solo al día 4.
--     días desde generado:   0      1       2      3     4+
--     revenue sin guía:   $110k  $5,62M  $958k  $149k  ~$0
--
-- Y se ve en el sesgo del estimado, out-of-sample sobre semanas de venta cerradas:
--     edad     0d      2d      3d      5d      7d     10d     14d
--     sesgo  -6,36   -1,97   +2,38   +4,39   +2,46   +1,56   +0,81
--     MAE     6,98    7,52    7,55    7,12    3,60    2,48    0,81
-- El día 0 subestima 6,4 pp. Un estimador calibrado no debería derivar: el valor esperado de
-- mañana tiene que ser el de hoy. Que suba 6 puntos entre el día 0 y el 5 es el termómetro.
--
-- CAUSA DEL SESGO, y por qué la ventana de δ importa. δ medido sobre 75 días da 90,3%; el δ de las
-- últimas semanas es 96-99,5%. El δ que hace cuadrar el día 0 es 97,4%. O sea: casi todo el sesgo
-- inicial es haber medido δ sobre una ventana larga que arrastra las semanas malas de julio. Por
-- eso `dispatch_curve` se mide sobre generados de 21 a 7 días atrás — dos semanas de cohortes con
-- el despacho maduro (el 99% de los despachos que van a ocurrir ocurren antes del día 7).
--
-- FALSO POSITIVO que hay que no repetir: sin filtrar `cuotas_3`, δ parece caer de 92% a 70% entre
-- junio y agosto. Es artefacto — `orders.courier` viene seteado en pedidos de link MP que nunca
-- llevan guía de Urbano/Fixy. Cero guías huérfanas: no había falla de matching.
--
-- QUÉ HACE. Valúa cada pedido sin guía a δ(edad) × prior_celda, con δ = P(despacho | todavía sin
-- guía a esa edad), que decae: un pedido de hoy vale casi todo, uno de hace 6 días sin guía vale
-- casi nada. Suma solo al ESTIMADO, nunca al confirmado. El flete entra por δ y no por δ×prior,
-- porque se paga al despachar entregue o no (§4.1).
--
-- LO QUE NO HACE. No toca la joroba de los días 3-5 (+4,4 pp de sobrerreacción): esa es de la
-- cadena de entrega corriendo demasiado temprano, y la 079 ya la acota arrancando en el día 7.

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
  where s.status_canonical <> 'cancelado'
    -- 079: ventana FIJA 21-35 días (canon Pancho 21/08/2026), igual para todos los couriers.
    -- Antes: `m.dias` medido por courier + v_win con piso de -45, que daba ventanas distintas
    -- (urbano [-45,-24], fixy [-45,-30]) y se movía sola sin que nadie se enterara.
    and s.dispatched_at between current_date - 35 and current_date - 21;

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
  -- ---- 079 · Curvas de maduración por courier, sobre cohortes CERRADAS (>=21 d) ----------
  -- Gd(u)  = fracción de las entregas finales ya realizada a la edad u.  → método B (cadena)
  -- Rexp(u)= fracción de la cohorte resuelta a la edad u.                → método C (edad efectiva)
  -- Las dos se miden sobre la MISMA base para que no se desincronicen. Se excluyen las guías que
  -- nunca entraron al sistema de entrega (PI/41 con +7 d): infladas en el denominador aplastan
  -- Rexp y hacen ver lento a un courier que no lo es.
  create temp table _curva on commit drop as
  select s.courier,
         (s.status_canonical = 'entregado')::int as deliv,
         case when s.status_canonical in ('entregado','rehusado','en_devolucion','devuelto','siniestro')
              then greatest(coalesce(s.resolved_at, s.status_at)::date - s.dispatched_at, 0) end as er
  from shipments s
  where s.courier in ('urbano','fixy')
    and s.status_canonical <> 'cancelado'
    and s.dispatched_at between current_date - 90 and current_date - 21
    and not (((s.courier = 'urbano' and s.status_raw = 'PI')
           or (s.courier = 'fixy' and (s.status_raw = '41'
                or lower(coalesce(s.status_raw,'')) like '%pendiente de retiro%')))
          and current_date - s.dispatched_at > 7);

  -- Guarda: cohorte chica, o fechas de resolución rotas (>50% resolviendo el mismo día del
  -- despacho — la firma del histórico de Fixy importado sin fechas, ver 072). El courier queda
  -- afuera del jsonb y `cohort_k` cae a 1, o sea el comportamiento previo a esta migración.
  insert into settings (key, value)
  select 'delivery_curve_gd', coalesce(jsonb_object_agg(courier, arr), '{}'::jsonb) from (
    select c.courier, jsonb_agg(round(v, 4) order by u) as arr
    from (select generate_series(0, 30) as u) t
    cross join (select distinct courier from _curva) c
    cross join lateral (
      select case when sum(deliv) = 0 then 0
                  else least(sum(case when deliv = 1 and er <= t.u then 1 else 0 end)::numeric
                             / sum(deliv), 1) end as v
      from _curva x where x.courier = c.courier
    ) g
    where exists (select 1 from _curva y where y.courier = c.courier
                  group by y.courier
                  having count(*) >= 100 and avg((y.er = 0)::int) <= 0.5)
    group by c.courier
  ) z
  on conflict (key) do update set value = excluded.value;

  insert into settings (key, value)
  select 'delivery_curve_res', coalesce(jsonb_object_agg(courier, arr), '{}'::jsonb) from (
    select c.courier, jsonb_agg(round(v, 4) order by u) as arr
    from (select generate_series(0, 30) as u) t
    cross join (select distinct courier from _curva) c
    cross join lateral (
      select avg((x.er is not null and x.er <= t.u)::int) as v
      from _curva x where x.courier = c.courier
    ) g
    where exists (select 1 from _curva y where y.courier = c.courier
                  group by y.courier
                  having count(*) >= 100 and avg((y.er = 0)::int) <= 0.5)
    group by c.courier
  ) z
  on conflict (key) do update set value = excluded.value;

  -- ---- 080 · Curva de DESPACHO: P(despacho eventual | sin guía todavía a la edad u) ----------
  -- El P&L cohortiza por fecha de despacho, así que un pedido generado y todavía sin guía no está
  -- mal estimado: NO EXISTE. Pero su pauta sí se le cobra al día de venta (ads_alloc reparte por
  -- `generadas`), así que el día arranca pesimista por construcción. Medido 21/08/2026: el sesgo
  -- del estimado al día 0 es -6,4 pp y se cierra solo hacia el día 7.
  --
  -- Ventana RECIENTE, por la misma razón que el prior (canon 21/08): δ medido sobre 75 días da
  -- 90,3% cuando el δ de las últimas semanas es 96-99,5%. Ese solo error explica casi todo el
  -- sesgo del día 0 — el δ que hace cuadrar el día 0 es 97,4%. Madurez del despacho: el 99% de los
  -- despachos que van a ocurrir ocurren antes del día 7, así que "cohorte madura" son 7 días.
  --
  -- OJO cuotas_3: `orders.courier` viene seteado en pedidos de link MP que NUNCA llevan guía de
  -- Urbano/Fixy. Sin este filtro δ se hunde ~20 pp (medido: 92% → 70% aparente, era artefacto).
  create temp table _desp on commit drop as
  select coalesce(o.courier, 'urbano') as courier,
         (current_date - o.created_at::date) as edad_gen,
         (select min(s.dispatched_at) from shipments s
           where s.order_id = o.id and s.status_canonical <> 'cancelado') as disp,
         o.created_at::date as gen
  from orders o
  where o.cancelled_at is null
    and o.courier in ('urbano','fixy')
    and (o.tags is null or lower(o.tags) not like '%cuotas_3%')
    and o.created_at::date between current_date - 21 and current_date - 7;

  insert into settings (key, value)
  select 'dispatch_curve', coalesce(jsonb_object_agg(courier, arr), '{}'::jsonb) from (
    select c.courier, jsonb_agg(round(v, 4) order by u) as arr
    from (select generate_series(0, 30) as u) t
    cross join (select distinct courier from _desp) c
    cross join lateral (
      -- entre los que a la edad u seguían SIN guía, ¿qué fracción terminó despachando?
      select case when count(*) = 0 then 0
                  else avg((x.disp is not null)::int) end as v
      from _desp x
      where x.courier = c.courier
        and (x.disp is null or x.disp - x.gen > t.u)
    ) g
    where exists (select 1 from _desp y where y.courier = c.courier
                  group by y.courier having count(*) >= 100)
    group by c.courier
  ) z
  on conflict (key) do update set value = excluded.value;

  -- Flete esperado de un pedido que todavía no despachó: promedio real de los últimos 30 días.
  insert into settings (key, value)
  select 'flete_prom_courier', coalesce(jsonb_object_agg(courier, round(f)), '{}'::jsonb) from (
    select s.courier, avg(coalesce(s.freight_cost, estimate_urbano_freight(s.province), 0)) f
    from shipments s
    where s.courier in ('urbano','fixy') and s.status_canonical <> 'cancelado'
      and s.dispatched_at >= current_date - 30
    group by 1 having count(*) >= 50
  ) z
  on conflict (key) do update set value = excluded.value;

  drop table _desp;

  drop table _curva;

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
  ads_alloc as (
    select w.d, w.c, w.p,
           sp.spend * w.w / nullif(sum(w.w) over (partition by w.d, w.p), 0) as ads
    from gen_weights w
    join (select date, product_id, sum(spend_real) as spend from v_ad_spend
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

revoke execute on function recompute_priors() from anon, authenticated;
revoke execute on function sales_rows(date) from anon;
grant execute on function sales_rows(date) to authenticated, service_role;

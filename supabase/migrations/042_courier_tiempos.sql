-- 042 — courier_tiempos(): cuánto tarda cada courier en la vida real, medido del historial propio
-- (dispatched_at / resolved_at / orders.created_at). Para la franja "ritmos normales" del Resumen
-- y /ventas: que las barras rojas de los últimos días de despacho no asusten — a los 7 días de
-- despacho Urbano solo ~1/3 de la cohorte tiene desenlace (las devoluciones tardan semanas), y
-- Fixy resuelve el mismo día. Se calcula EN VIVO: mejora solo a medida que el sync limpia la
-- contaminación del freeze de julio. Correo/ML no aplican (prepago / sin guía en calle).
--   · entrega: entregas despachadas en los últimos 45 días
--   · devolución: desenlaces devuelto/rehusado de cohortes de los últimos 80 días
--   · % resuelto a N días: cohortes maduras (despachadas hace 25-80 días, todas con tiempo de sobra)

create or replace function courier_tiempos()
returns table (
  courier text, muestra int,
  venta_despacho_med numeric,
  entrega_med numeric, entrega_p80 numeric, entrega_p90 numeric,
  devolucion_med numeric,
  res_7d numeric, res_14d numeric, res_21d numeric
) language sql stable as $$
  with base as (
    select s.courier as c, s.dispatched_at, s.status_canonical as st,
           (s.resolved_at at time zone 'America/Argentina/Buenos_Aires')::date as res,
           (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date as creada
    from shipments s
    join orders o on o.id = s.order_id
    where s.courier in ('urbano', 'fixy')
      and s.status_canonical <> 'cancelado'
      and s.dispatched_at is not null
  ),
  entregas as (
    select c,
           percentile_cont(0.5) within group (order by res - dispatched_at) as med,
           percentile_cont(0.8) within group (order by res - dispatched_at) as p80,
           percentile_cont(0.9) within group (order by res - dispatched_at) as p90
    from base
    where st = 'entregado' and res is not null and dispatched_at >= current_date - 45
    group by c
  ),
  despacho as (
    select c, percentile_cont(0.5) within group (order by dispatched_at - creada) as med
    from base where dispatched_at >= current_date - 45
    group by c
  ),
  devol as (
    select c, percentile_cont(0.5) within group (order by res - dispatched_at) as med
    from base
    where st in ('devuelto', 'rehusado') and res is not null and dispatched_at >= current_date - 80
    group by c
  ),
  maduras as (
    select c, count(*)::int as n,
           avg(case when res is not null and res - dispatched_at <= 7  then 1.0 else 0 end) as r7,
           avg(case when res is not null and res - dispatched_at <= 14 then 1.0 else 0 end) as r14,
           avg(case when res is not null and res - dispatched_at <= 21 then 1.0 else 0 end) as r21
    from base
    where dispatched_at between current_date - 80 and current_date - 25
    group by c
  )
  select m.c, m.n, d.med, e.med, e.p80, e.p90, v.med, m.r7, m.r14, m.r21
  from maduras m
  left join entregas e on e.c = m.c
  left join despacho d on d.c = m.c
  left join devol v on v.c = m.c
  order by m.c
$$;

revoke execute on function courier_tiempos() from anon;
grant execute on function courier_tiempos() to authenticated, service_role;

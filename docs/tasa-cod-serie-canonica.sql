-- Tasa de entrega COD: serie canonica SEMANAL por semana de venta (lun-dom, ART) + baseline.
-- Solo lectura. Correr: node scripts/_q.mjs < este_archivo.sql   (o pegar en el SQL editor)
-- Parametros (unico lugar a tocar):
--   desde      = lunes de la primera semana de la serie
--   base_desde / base_hasta = lunes de la primera y la ultima semana del baseline
with params as (
  select date '2026-06-29' as desde,
         date '2026-08-10' as base_desde,
         date '2026-08-31' as base_hasta,
         (now() at time zone 'America/Argentina/Buenos_Aires')::date as hoy
),
base as (
  select s.id, s.courier, s.status_canonical as st, s.resolved_at,
         date_trunc('week', o.created_at at time zone 'America/Argentina/Buenos_Aires')::date as semana,
         o.created_at + interval '20 days' as h20
  from shipments s
  join orders o on o.id = s.order_id
  cross join params p
  where s.courier in ('urbano','fixy')
    and (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date >= p.desde
    and s.status_canonical <> 'cancelado'                       -- etiqueta anulada antes de salir
    and s.dispatched_at is not null
    and s.tracking !~ '^0001494211'                              -- prepago mal clasificado (tracking formato Correo)
    and (o.tags is null or lower(o.tags) not like '%cuotas_3%')  -- prepago (link MP): no es COD
    -- fantasma solo-PI: etiqueta emitida que el courier nunca recibio (mismo criterio que sales_rows)
    and not (((s.courier = 'urbano' and s.status_raw = 'PI')
           or (s.courier = 'fixy' and (s.status_raw = '41'
                or lower(coalesce(s.status_raw,'')) like '%pendiente de retiro%')))
          and current_date - s.dispatched_at > 7)
    -- NO se excluyen las ordenes canceladas en Shopify despues de despachar: son devoluciones reales
    -- (sales_rows si las excluye y por eso infla Urbano ~+2 pp).
),
r as (
  select b.*,
         b.st in ('entregado','rehusado','en_devolucion','devuelto','siniestro') as resuelta,
         -- momento de entrega = resolved_at (097: primer evento de la racha final)
         (b.st = 'entregado' and b.resolved_at <= b.h20) as ent20,
         (b.h20 <= now()) as mad20
  from base b
),
agg as (
  select r.semana, coalesce(r.courier, 'blend') as courier,
         (r.semana + 27 <= p.hoy) as madura20,             -- todo pedido de la semana ya tiene >= 20 d
         count(*) as despachadas,
         count(*) filter (where resuelta) as resueltas,
         count(*) filter (where st = 'entregado') as entregadas,
         count(*) filter (where mad20) as desp_mad20,
         count(*) filter (where mad20 and ent20) as ent20
  from r cross join params p
  group by grouping sets ((r.semana, r.courier), (r.semana)), p.hoy
),
tot as (
  select a.semana::text as periodo, a.* from agg a
  union all
  select 'BASELINE ' || to_char(p.base_desde,'DD/MM') || '-' || to_char(p.base_hasta + 6,'DD/MM'),
         null, courier, bool_and(madura20),
         sum(despachadas), sum(resueltas), sum(entregadas), sum(desp_mad20), sum(ent20)
  from agg cross join params p
  where semana between p.base_desde and p.base_hasta
  group by courier, p.base_desde, p.base_hasta
)
select periodo, courier, madura20,
       round(100.0*resueltas/nullif(despachadas,0),1) as pct_resuelto,
       (madura20 and resueltas >= 0.9*despachadas) as oficial,   -- canon 13/08: >=90% resuelto
       despachadas, resueltas, entregadas,
       -- TASA CANON: entregadas / resueltas (migr 067, canon 13/08 y 29/09/2026), IC95 Wilson
       round(100.0*entregadas/nullif(resueltas,0),1) as tasa,
       round(100*(ph + z*z/(2*n) - z*sqrt(ph*(1-ph)/n + z*z/(4*n*n)))/(1+z*z/n),1) as ic_lo,
       round(100*(ph + z*z/(2*n) + z*sqrt(ph*(1-ph)/n + z*z/(4*n*n)))/(1+z*z/n),1) as ic_hi,
       -- AL LADO: entregadas dentro de 20 d de la venta / despachadas con >= 20 d (congelada, piso)
       desp_mad20, ent20,
       round(100.0*ent20/nullif(desp_mad20,0),1) as tasa_20d_desp
from tot,
lateral (select entregadas::numeric/nullif(resueltas,0) as ph,
                nullif(resueltas,0)::numeric as n, 1.96::numeric as z) w
order by periodo, courier;

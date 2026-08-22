-- 089 · salud_sistema() avisa cuando una venta de ML no tiene producto.
--
-- MLA3030521696 ("X5 Pack Ahorro Drenaje Linfático…", que es Pureza pero no lo dice) estuvo desde
-- el 30/07/2026 hasta el 22/08 con product NULL: 68 ventas y $5.830.374 que el recompute descarta
-- por el inner join contra products. En daily_pnl no hay bucket "sin producto" — no aparece como
-- un número raro, directamente no está.
--
-- El dato ya se venía calculando: syncMlOrders devuelve `sinProducto` y la ruta lo mete en
-- sync_runs.warnings. Pero el bloque 2 de salud_sistema solo mira `status <> 'ok'`, y un warning
-- no cambia el status → 3 semanas mudo. La 088 arregló el caso y el sync ahora cae a ml_ad_items;
-- esto es el candado para el próximo listado que ML titule sin la marca.
--
-- ROJO y no AMARILLO: no es una métrica que empeora, es facturación que no está en el P&L.
-- Copia de la 083 (última versión de salud_sistema) con el bloque 7 agregado; el resto va idéntico.

-- salud_sistema: copia de la 076 (bloque 4 = cobertura real de atribución) + el bloque 6 nuevo.
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
  union all

  -- 6 (083). Tarifa real de Urbano vencida: sin filas en la ventana, estimate_urbano_freight cae al
  --    fallback plano para TODAS las provincias (ver cabecera de la 083).
  select case when z.dias >= z.win then 'ROJO' else 'AMARILLO' end, 'flete',
         case when z.ult is null then 'nunca se importó una tarifa real de Urbano'
              else 'la última tarifa real de Urbano es del ' || to_char(z.ult, 'DD/MM')
                   || ' (' || z.dias || ' días)' end
         || ' y la ventana del promedio es de ' || z.win || ' días'
         || case when z.dias >= z.win
                 then ': la ventana ya se vació y el flete de TODAS las provincias está saliendo por '
                      || 'el fallback plano'
                 else ': cuando se vacíe, el flete de todas las provincias cae al fallback plano' end
         || '. Importar la facturación de Urbano en /config'
  from (
    select u.ult, w.win, current_date - coalesce(u.ult, date '1900-01-01') as dias
    from (select max(dispatched_at) as ult from shipments
           where courier = 'urbano' and freight_tarifa is not null) u
    cross join (select (value::text)::int as win from settings
                 where key = 'freight_avg_window_days') w
  ) z
  where z.dias > 45

  union all

  -- 7 (089). Ventas de ML sin producto: se caen enteras del P&L (ver cabecera). El arreglo es
  --    mapear la publicación en ml_ad_items — el sync ya la resuelve por ahí desde la 088.
  select 'ROJO', 'ml',
         z.n || ' venta(s) de ML de los últimos 7 días sin producto ($' || round(z.monto)
         || ') — no están en el P&L. Publicaciones: ' || z.items
         || '. Mapearlas en ml_ad_items'
  from (
    select count(*) as n, coalesce(sum(total_amount), 0) as monto,
           string_agg(distinct raw->'order_items'->0->'item'->>'id', ', ') as items
    from ml_orders
    where product is null and status <> 'cancelled'
      and created_at > now() - interval '7 days'
  ) z
  where z.n > 0
$fn$;

revoke execute on function salud_sistema() from anon;
grant execute on function salud_sistema() to authenticated;

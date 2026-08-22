-- 083 · salud_sistema() avisa antes de que el flete de Urbano se caiga al fallback plano.
--
-- estimate_urbano_freight promedia las tarifas REALES de los últimos `freight_avg_window_days` (60).
-- La última tarifa real es del 30/06/2026 — 53 días al 22/08. Cuando la ventana se vacíe (30/08), el
-- promedio por provincia y el global se quedan sin filas y las DOS ramas del coalesce caen al
-- fallback plano de $10.200 para todas las provincias, sobre el 84% del volumen COD. No se rompe
-- nada visible: el P&L simplemente empieza a mentir el flete, parejo, en silencio.
--
-- El arreglo NO es subir la ventana a 90: eso posterga el aviso y encima promedia tarifas más viejas.
-- Es importar la facturación de Urbano. Esto solo pone el despertador, a los 45 días (2 semanas de
-- aire antes del corte), y lo sube a ROJO cuando la ventana ya se vació y el fallback está actuando.
--
-- Copia de la 076 (última versión de salud_sistema) con el bloque 6 agregado; el resto va idéntico.

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
$fn$;

revoke execute on function salud_sistema() from anon;
grant execute on function salud_sistema() to authenticated;

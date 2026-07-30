-- 059 — el chequeo 2 de salud_sistema() se apaga cuando el sync se arregla.
--
-- Miraba CUALQUIER error de las últimas 6 h: un conector que falló, se arregló y volvió a correr ok
-- seguía ROJO hasta que el error saliera de la ventana. Con el workflow `salud` corriendo cada hora
-- eso son ~6 mails rojos por un problema ya resuelto — justo la fatiga de alerta que 056 evitaba al
-- no fallar por los AMARILLO. Ahora es rojo solo si la ÚLTIMA corrida del conector falló: un sync
-- que flapea sigue cayendo (la mitad de las veces la última es error) y uno arreglado se apaga en la
-- corrida siguiente.
--
-- De paso, el detalle sale de error O warnings: el caso que lo destapó (ad-review pidiendo
-- act_undefined desde el 28/07) tenía error NULL y el mensaje real en warnings, así que la alerta
-- decía "· ?" y no servía para diagnosticar.
--
-- Copia de 056 con el bloque 2 reemplazado; el resto va idéntico.

create or replace function salud_sistema()
returns table (severidad text, area text, detalle text)
language sql stable as $fn$
  -- Cadencia real de los jobs de pg_cron + margen. Los de Vercel (ml, ad-review) son diarios.
  with esperado(connector, max_min) as (
    values ('urbano', 45), ('fixy', 30), ('meta', 90), ('stock-espejo', 90),
           ('ml', 1560), ('ad-review', 1560)
  ),
  ultima as (
    select e.connector, e.max_min,
           (select max(s.started_at) from sync_runs s where s.connector = e.connector) as ts
    from esperado e
  )

  -- 1. Sync frenado. Es el caso del freeze de julio: profit 30d mostraba $2,2M contra $6,97M real
  --    porque los estados quedaron congelados y nadie miró el scheduler.
  select 'ROJO', 'sync:' || u.connector,
         case when u.ts is null then 'nunca corrió'
              else 'sin corridas hace ' || round(extract(epoch from (now() - u.ts)) / 60)
                   || ' min (esperado < ' || u.max_min || ')' end
  from ultima u
  where u.ts is null or u.ts < now() - (u.max_min || ' minutes')::interval

  union all

  -- 2. Sync cuya ÚLTIMA corrida falló (antes: cualquier error en 6 h — ver cabecera).
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

  -- 3. Gasto de ads en cero: exactamente el agujero de R3 (23→26/07 a $0 mientras gastaba $726k).
  select 'ROJO', 'ads', 'ad_spend de ayer = $0 — ¿rotaron la cuenta de Meta y el token no ve la nueva?'
  from (select coalesce(sum(spend), 0) as g from ad_spend where date = current_date - 1) z
  where z.g = 0

  union all

  -- 4. Atribución del form COD. Rota desde el 08/07 y descubierta recién el 27/07: 19 días.
  --    Umbral 40% (histórico sano ~90%); pide >20 pedidos para no gritar por un día flojo.
  select 'AMARILLO', 'atribución',
         'solo ' || round(100.0 * a.con / a.tot, 1) || '% de los ' || a.tot
         || ' pedidos de ayer traen utm_content — /anuncios está ciego (fix upstream: form COD)'
  from (
    select count(*) as tot,
           count(*) filter (where exists (
             select 1 from jsonb_array_elements(
               case when jsonb_typeof(o.raw->'note_attributes') = 'array'
                    then o.raw->'note_attributes' else '[]'::jsonb end) v
             where v.value->>'name' = 'utm_content')) as con
    from orders o
    where o.created_at::date = current_date - 1 and o.cancelled_at is null
  ) a
  where a.tot > 20 and 100.0 * a.con / a.tot < 40

  union all

  -- 5. Ads rechazados sin resolver. Los 12 creativos de BeeVenom comparten cuerpo: un rechazo por
  --    claim los tumba juntos.
  select 'AMARILLO', 'ads', z.c || ' anuncios DISAPPROVED/WITH_ISSUES sin resolver'
  from (select count(*) as c from ad_review_issues where resolved_at is null) z
  where z.c > 0
$fn$;

revoke execute on function salud_sistema() from anon;
grant execute on function salud_sistema() to authenticated;

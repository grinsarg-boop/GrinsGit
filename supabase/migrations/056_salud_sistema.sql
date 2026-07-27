-- 055 — `salud_sistema()`: dead-man's switch de todo lo que se rompe EN SILENCIO.
--
-- Por qué existe: el 27/07 aparecieron tres sistemas rotos que nadie había notado — el sync de ads
-- ciego 4 días (rotó la cuenta de Meta y ad_spend quedó en $0), la atribución del form COD ciega 19
-- días (note_attributes vacío → /anuncios sin un solo pedido atribuido) y CERO backups de la base.
-- Ninguno de los tres dio error: todos "funcionaban" devolviendo números plausibles. El modo de falla
-- del sistema no es explotar, es mentir callado. Cada chequeo de acá corresponde a UNA falla real
-- que ya pasó — no a un riesgo imaginado.
--
-- Devuelve UNA FILA POR PROBLEMA; sin filas = todo sano. La consume el workflow `salud` de GitHub
-- Actions cada hora: si hay filas ROJAS, falla la corrida y GitHub manda el mail. Sin infra nueva.

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

  -- 2. Sync que corre pero falla.
  select 'ROJO', 'sync:' || s.connector,
         count(*) || ' corridas con error en 6 h · ' || left(coalesce(max(s.error), '?'), 140)
  from sync_runs s
  where s.status <> 'ok' and s.started_at > now() - interval '6 hours'
  group by s.connector

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

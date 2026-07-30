-- 060 — el monitor de rechazos dice de QUÉ FAMILIA es cada rechazo, sin que nadie toque el Graph API.
--
-- Hay dos familias (Learnings 28/07) y se distinguen por un solo campo:
--   CONTENIDO — Meta manda `issues_info` citando la política violada → hay que reescribir el creativo.
--   ENTIDAD   — sin `issues_info`: el MISMO creativo está ACTIVE en otro adset. No hay nada que
--               arreglar, se recrea como entidad nueva.
-- 054 no pedía ninguno de los dos campos (ni issues_info ni ad_review_feedback), así que la alerta
-- decía "hay 20 problemas" y alguien tenía que pegarle a mano al Graph API para saber cuál era cuál
-- (pasó el 27/07). Con la familia adentro, el mail del workflow ya trae el veredicto.
--
-- La clasificación va como columna GENERADA: cualquiera que lea la tabla la tiene, sin repetir el
-- mismo case en el TS, en el RPC y en el workflow.

alter table ad_review_issues
  add column if not exists issues_info        jsonb,  -- array de la política citada (familia CONTENIDO)
  add column if not exists ad_review_feedback jsonb;  -- detalle por ubicación cuando Meta lo da

-- ALTER aparte: una columna generada no puede referenciar columnas creadas en el mismo statement.
alter table ad_review_issues
  add column if not exists familia text generated always as (
    case when jsonb_typeof(issues_info) = 'array' and jsonb_array_length(issues_info) > 0
         then 'CONTENIDO' else 'ENTIDAD' end) stored,
  add column if not exists motivo text generated always as (
    case when jsonb_typeof(issues_info) = 'array' and jsonb_array_length(issues_info) > 0
         then left(coalesce(issues_info->0->>'error_summary', issues_info->0->>'error_message', ''), 200)
    end) stored;

-- Mismo sync que 054 + los dos campos nuevos; devuelve familia/motivo con los abiertos.
drop function if exists sync_ad_review_issues(text, jsonb);
create or replace function sync_ad_review_issues(p_account text, p jsonb)
returns table (ad_id text, ad_name text, campaign_name text, effective_status text,
               familia text, motivo text, first_seen_at timestamptz)
language plpgsql as $$
#variable_conflict use_column
begin
  -- upsert de los que hoy tienen problema (re-abre si estaba resuelto, conserva first_seen_at)
  insert into ad_review_issues as t
    (ad_id, account_id, ad_name, adset_name, campaign_name, effective_status,
     issues_info, ad_review_feedback, last_seen_at, resolved_at)
  select x->>'ad_id', p_account, x->>'ad_name', x->>'adset_name', x->>'campaign_name',
         x->>'effective_status',
         case when jsonb_typeof(x->'issues_info') = 'array' then x->'issues_info' end,
         case when jsonb_typeof(x->'ad_review_feedback') = 'object' then x->'ad_review_feedback' end,
         now(), null
  from jsonb_array_elements(coalesce(p, '[]'::jsonb)) x
  on conflict (ad_id) do update set
    account_id = excluded.account_id, ad_name = excluded.ad_name, adset_name = excluded.adset_name,
    campaign_name = excluded.campaign_name, effective_status = excluded.effective_status,
    issues_info = excluded.issues_info, ad_review_feedback = excluded.ad_review_feedback,
    last_seen_at = now(), resolved_at = null;

  -- los que estaban abiertos en esta cuenta y ya no aparecen → resueltos
  update ad_review_issues t set resolved_at = now()
  where t.account_id = p_account and t.resolved_at is null
    and not exists (select 1 from jsonb_array_elements(coalesce(p, '[]'::jsonb)) x
                     where x->>'ad_id' = t.ad_id);

  -- CONTENIDO primero: es el que pide trabajo (reescribir), ENTIDAD es recrear y listo.
  return query
    select t.ad_id, t.ad_name, t.campaign_name, t.effective_status, t.familia, t.motivo, t.first_seen_at
    from ad_review_issues t
    where t.account_id = p_account and t.resolved_at is null
    order by t.familia, t.first_seen_at desc;
end $$;

-- 091 · Las notificaciones de MercadoLibre dejan de rebotar contra un 404.
--
-- La app "Biolabs-finanzas" (6959316803656) está suscripta a 16 topics —entre ellos `items`,
-- `items_prices`, `price_suggestion` y `catalog_item_competition_status`— y el callback que ML
-- tiene registrado apunta a https://biolabs-finanzas.vercel.app/api/ml/callback, que nunca
-- existió: GET y POST daban 404 (verificado el 30/08/2026). Cada cambio de ficha, cada cambio de
-- precio y cada vez que ganamos o perdimos la caja de catálogo se perdió.
--
-- Por qué importa: ML no expone historial. /items/{id}/history es 404 y
-- /moderations/infractions/search da 401 con nuestro token, así que la única forma de saber "qué
-- me cambiaron y cuándo" es guardar el aviso cuando llega. Diagnosticando el 30/08/2026 una caída
-- del 49% en las ventas de ML, el dato que faltó fue exactamente ese: MLA3356284130 quedó
-- under_review/forbidden el 25/08 12:16 sin registro de por qué, y no hubo forma de saber si el x2
-- (MLA3692036796) perdió la caja de catálogo algún día de esa semana.
--
-- El payload NO trae el cambio: dice qué recurso cambió y cuándo. Con eso alcanza para la línea de
-- tiempo; el "qué" se resuelve yendo a buscar el recurso. Esto no sirve para atrás.
--
-- `notif_id` es el `_id` que manda ML, que es la clave del reintento: ML reinsiste con el MISMO
-- _id hasta que le respondan 200 → primary key, y el insert va con ignoreDuplicates.

create table if not exists ml_events (
  notif_id       text primary key,
  topic          text not null,        -- items · items_prices · catalog_item_competition_status · …
  resource       text not null,        -- /items/MLA3692036796, /orders/123, …
  user_id        bigint,
  application_id bigint,
  sent           timestamptz,          -- cuándo lo emitió ML (≠ cuándo lo recibimos)
  received_at    timestamptz not null default now(),
  attempts       int,
  payload        jsonb not null
);

create index if not exists ml_events_topic_idx on ml_events (topic, received_at desc);
create index if not exists ml_events_resource_idx on ml_events (resource, received_at desc);

alter table ml_events enable row level security;
revoke all on ml_events from anon;
grant select on ml_events to authenticated, service_role;
grant insert on ml_events to service_role;

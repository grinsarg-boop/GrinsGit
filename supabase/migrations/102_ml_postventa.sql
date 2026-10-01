-- 102 · Agente de post-venta de ML: preguntas sin responder y reclamos abiertos.
--
-- Al 01/10/2026 las preguntas se contestaban a mano con una mediana de ~21 h (de 20 min a 71 h, medido
-- sobre las últimas 30 respondidas), y los reclamos se miraban cuando alguien se acordaba. /api/monitor/ml-postventa
-- corre cada 10 min: decide cada pregunta (responder / borrar / escalar / ignorar) y fotografía cada
-- reclamo abierto. Esta tabla es su memoria — para no volver a decidir la misma pregunta en cada corrida —
-- y la fuente del aviso: el workflow salud lee `cambio_at` y falla (→ mail) con lo nuevo de la última hora.

create table if not exists ml_postventa (
  id          text primary key,              -- 'q:<question_id>' · 'c:<claim_id>'
  tipo        text not null check (tipo in ('pregunta', 'reclamo')),
  recurso     text,                          -- pregunta: item_id · reclamo: order/pack id
  texto       text,                          -- pregunta: lo que preguntó · reclamo: reason_id + último mensaje
  accion      text,                          -- pregunta: responder | borrar | escalar | ignorar
  respuesta   text,                          -- el borrador o lo que se mandó
  motivo      text,                          -- por qué esa acción (del modelo o del candado que la forzó)
  estado      text not null,                 -- pregunta: borrador | enviada | borrada | escalada | ignorada | error
                                             -- reclamo: stage|status|acciones del vendedor (cambia → avisa) | cerrado
  vence       timestamptz,                   -- reclamo: due_date más próximo de una acción obligatoria del vendedor
  cambio_at   timestamptz not null default now(),  -- última transición: lo que mira el aviso
  created_at  timestamptz not null default now()
);

create index if not exists ml_postventa_cambio_idx on ml_postventa (cambio_at desc);

alter table ml_postventa enable row level security;
revoke all on ml_postventa from anon;
grant select on ml_postventa to authenticated, service_role;
grant insert, update, delete on ml_postventa to service_role;

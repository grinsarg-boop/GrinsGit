-- 105 · El agente de post-venta (102) suma los mensajes post-venta de los packs y guarda el contacto del
-- comprador para una reposición.
--
-- 02/10/2026: ML bloquea que el vendedor inicie la conversación (403
-- blocked_by_conversation_initiated_by_seller_limited) y nunca da celular ni mail del comprador. Dos
-- reposiciones se cargaron con nuestro mail y un celular 11 11111111, y el aviso del courier no le
-- llegó a nadie. Por eso el agente pide los datos apenas el comprador escribe y los deja acá para el alta.

alter table ml_postventa drop constraint if exists ml_postventa_tipo_check;
alter table ml_postventa add constraint ml_postventa_tipo_check check (tipo in ('pregunta', 'reclamo', 'pack'));
-- id 'p:<pack_id>' · estado = id del último mensaje del comprador (cambia → avisa)

alter table ml_postventa add column if not exists contacto jsonb; -- { orden, email, area, cel } para el alta de la reposición

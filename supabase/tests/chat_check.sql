-- 053 chat: el on-delete cascade borra los mensajes junto con la sesión.
do $$
declare sid uuid;
begin
  insert into chat_sessions (title) values ('t') returning id into sid;
  insert into chat_messages (session_id, role, content)
    values (sid, 'user', 'hola'), (sid, 'assistant', 'chau');
  if (select count(*) from chat_messages where session_id = sid) <> 2 then
    raise exception 'chat: insert de mensajes falló';
  end if;
  delete from chat_sessions where id = sid;
  if (select count(*) from chat_messages where session_id = sid) <> 0 then
    raise exception 'chat: on-delete cascade no borró los mensajes';
  end if;
end $$;

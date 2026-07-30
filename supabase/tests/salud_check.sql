-- salud_check — salud_sistema(): detecta las tres fallas silenciosas del 27/07 y NO grita de más.
begin;

-- Base sana: todos los syncs recién corridos + gasto de ads ayer + atribución OK.
insert into sync_runs (connector, started_at, status)
select c, now() - interval '2 minutes', 'ok'
from unnest(array['urbano','fixy','meta','stock-espejo','ml','ad-review']) c;

insert into products (id, name) values (900, 'TestSalud') on conflict do nothing;
insert into ad_spend (date, ad_id, ad_name, campaign_name, spend, purchases)
values (current_date - 1, 'AD-SALUD', 'x', 'c', 1000, 1);

do $$ begin
  assert (select count(*) from salud_sistema()) = 0,
    'base sana no debería reportar nada: ' || coalesce((select string_agg(area || '=' || detalle, ' | ') from salud_sistema()), '');
end $$;

-- 1. Sync frenado: urbano deja de correr (se esperan <45 min).
update sync_runs set started_at = now() - interval '3 hours' where connector = 'urbano';
do $$ begin
  assert (select count(*) from salud_sistema() where area = 'sync:urbano' and severidad = 'ROJO') = 1,
    'urbano frenado tiene que salir en ROJO';
end $$;
update sync_runs set started_at = now() - interval '2 minutes' where connector = 'urbano';

-- 2. Sync cuya ÚLTIMA corrida falló (059: antes era cualquier error en 6 h).
insert into sync_runs (connector, started_at, status, error)
values ('fixy', now() - interval '1 minute', 'error', 'boom');
do $$ begin
  assert (select count(*) from salud_sistema() where area = 'sync:fixy' and severidad = 'ROJO') = 1,
    'sync con error tiene que salir en ROJO';
end $$;

-- ...y se apaga solo cuando el conector vuelve a correr bien: sin esto eran ~6 mails rojos por hora
-- de un problema ya resuelto, que es la fatiga de alerta que 059 vino a matar.
insert into sync_runs (connector, started_at, status) values ('fixy', now(), 'ok');
do $$ begin
  assert (select count(*) from salud_sistema() where area = 'sync:fixy') = 0,
    'un sync arreglado no puede seguir en ROJO';
end $$;
delete from sync_runs where status = 'error';

-- 3. Ads en $0: el agujero de R3 (4 días ciego tras rotar de cuenta).
delete from ad_spend where date = current_date - 1;
do $$ begin
  assert (select count(*) from salud_sistema() where area = 'ads' and detalle like '%$0%') = 1,
    'gasto de ads en cero tiene que salir en ROJO';
end $$;
insert into ad_spend (date, ad_id, ad_name, campaign_name, spend, purchases)
values (current_date - 1, 'AD-SALUD', 'x', 'c', 1000, 1);

-- 4. Atribución rota: 25 pedidos de ayer, ninguno con utm_content (el caso real desde el 08/07).
insert into orders (id, shopify_id, order_number, created_at, raw)
select 900000 + g, 900000 + g, (900000 + g)::text, now() - interval '1 day',
       jsonb_build_object('note_attributes', '[]'::jsonb)
from generate_series(1, 25) g;
do $$ begin
  assert (select count(*) from salud_sistema() where area = 'atribución') = 1,
    'atribución en 0% tiene que salir';
end $$;

-- ...y con utm_content presente NO grita (evita el falso positivo permanente).
update orders set raw = jsonb_build_object('note_attributes',
  '[{"name":"utm_content","value":"120249882938690152"}]'::jsonb)
where id between 900001 and 900025;
do $$ begin
  assert (select count(*) from salud_sistema() where area = 'atribución') = 0,
    'con atribución sana no tiene que gritar';
end $$;

rollback;

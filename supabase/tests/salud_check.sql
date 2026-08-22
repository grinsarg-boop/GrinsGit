-- salud_check — salud_sistema(): detecta las tres fallas silenciosas del 27/07 y NO grita de más.
begin;

-- Base sana: todos los syncs recién corridos + gasto de ads ayer + atribución OK.
insert into sync_runs (connector, started_at, status)
select c, now() - interval '2 minutes', 'ok'
from unnest(array['urbano','fixy','meta','stock-espejo','ml','ad-review']) c;

insert into products (id, name) values (900, 'TestSalud') on conflict do nothing;
insert into ad_spend (date, ad_id, ad_name, campaign_name, spend, purchases)
values (current_date - 1, 'AD-SALUD', 'x', 'c', 1000, 1);

-- 083: tarifa real de Urbano fresca (si no, el flete ya estaría corriendo contra el fallback plano).
insert into shipments (courier, tracking, province, dispatched_at, freight_tarifa)
values ('urbano', 'TARIFA-SALUD', 'Córdoba', current_date, 8000);

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

-- 4b (076). El camino de note_attributes está muerto desde el 06/07: hoy la cobertura la da el
-- beacon del form. Sin este caso, la alerta gritaría todos los días con el arreglo funcionando —
-- que es la forma más común de apagar una alerta sin darse cuenta.
update orders set raw = jsonb_build_object('note_attributes', '[]'::jsonb),
                  phone = '11' || lpad((id - 900000)::text, 8, '0')
where id between 900001 and 900025;
do $$ begin
  assert (select count(*) from salud_sistema() where area = 'atribución') = 1,
    '076: sin note_attributes y sin beacon, sigue gritando';
end $$;

insert into atribucion_form (phone, ad_id, created_at)
select '11' || lpad(g::text, 8, '0'), 'AD-SALUD', now() - interval '1 day'
from generate_series(1, 25) g;
do $$ begin
  assert (select count(*) from salud_sistema() where area = 'atribución') = 0,
    '076: el beacon cuenta como atribución — la alerta se calla sin necesitar note_attributes';
end $$;

-- 5 (083). El flete de Urbano corriendo contra tarifas viejas. A los 45 días avisa; cuando la ventana
-- (60 d) se vació, estimate_urbano_freight YA está devolviendo el fallback plano para todo el país.
update shipments set dispatched_at = current_date - 50 where tracking = 'TARIFA-SALUD';
do $$ begin
  assert (select count(*) from salud_sistema() where area = 'flete' and severidad = 'AMARILLO') = 1,
    '083: tarifa de 50 días avisa en AMARILLO (todavía hay ventana)';
end $$;

update shipments set dispatched_at = current_date - 70 where tracking = 'TARIFA-SALUD';
do $$ begin
  assert (select count(*) from salud_sistema() where area = 'flete' and severidad = 'ROJO') = 1,
    '083: pasada la ventana es ROJO — el fallback plano ya está actuando';
  assert estimate_urbano_freight('Córdoba')
         = (select (value::text)::numeric from settings where key = 'urbano_freight_fallback'),
    '083: y la alerta dice la verdad: sin tarifas en ventana, el flete ES el fallback plano';
end $$;

-- ...y con una tarifa fresca se calla (el falso positivo permanente que apaga la alerta).
update shipments set dispatched_at = current_date where tracking = 'TARIFA-SALUD';
do $$ begin
  assert (select count(*) from salud_sistema() where area = 'flete') = 0,
    '083: con facturación al día no grita';
end $$;

rollback;

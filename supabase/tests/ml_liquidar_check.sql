-- ml_liquidar_check.sql (044): solo release futuro cuenta, agrupado por lunes de la semana.
begin;

do $t$
declare r record; lunes date := date_trunc('week', current_date + 10)::date;
begin
  insert into ml_orders (ml_id, created_at, product, units, pack, total_amount, sale_fee, status, raw, mp_release_date, mp_net) values
    (97001, now(), 'Pureza', 1, 1, 60000, 10000, 'paid', '{}', current_date + 10, 42785.40),
    (97002, now(), 'Pureza', 1, 1, 40000,  5000, 'paid', '{}', current_date - 1,  30000),   -- ya liberado
    (97003, now(), 'Pureza', 1, 1, 40000,  5000, 'cancelled', '{}', current_date + 10, 999); -- no paid

  select * into r from ml_a_liquidar();
  assert r.semana = lunes, '044: semana = lunes de la fecha de liberación';
  assert r.pagos = 1 and r.neto = 42785.40, '044: solo el paid con release futuro';

  -- 082: MP libera a una HORA del día, no a las 00:00. Una orden que libera HOY sigue pendiente
  -- mientras MP diga 'pending', y sale de la tarjeta apenas dice 'released' — sin esperar a mañana.
  insert into ml_orders (ml_id, created_at, product, units, pack, total_amount, sale_fee, status, raw, mp_release_date, mp_net, mp_release_status) values
    (97004, now(), 'Pureza', 1, 1, 50000, 5000, 'paid', '{}', current_date, 29100, 'pending'),
    (97005, now(), 'Pureza', 1, 1, 50000, 5000, 'paid', '{}', current_date, 29100, 'released');

  select * into r from ml_a_liquidar() where semana = date_trunc('week', current_date)::date;
  assert r.pagos = 1 and r.neto = 29100,
    format('082: la liberada de hoy sale de la tarjeta, la pendiente queda (pagos=%s neto=%s)', r.pagos, r.neto);

  -- Sin dato de MP todavía = pendiente: la tarjeta nunca cuenta de menos por falta de información.
  update ml_orders set mp_release_status = null where ml_id = 97005;
  select * into r from ml_a_liquidar() where semana = date_trunc('week', current_date)::date;
  assert r.pagos = 2, format('082: mp_release_status null cuenta como pendiente (got %s)', r.pagos);

  raise notice '044/082 ml-liquidar: OK';
end $t$;

rollback;

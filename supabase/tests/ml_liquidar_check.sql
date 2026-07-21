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

  raise notice '044 ml-liquidar: OK';
end $t$;

rollback;

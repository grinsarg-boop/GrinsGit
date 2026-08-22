-- 082 · "A liquidar de ML" deja de adivinar por fecha y lee si MP ya liberó.
--
-- La 044 deriva liberado/pendiente de `mp_release_date >= hoy`. El commit 9e9e01d (20/08) arregló la
-- fecha en el sync —MP devuelve el peor caso (+28 d) hasta que ML entrega, y no se refrescaba— pero
-- la función quedó con la misma regla de fecha, y ahí queda un agujero que la fecha sola no puede
-- cerrar: MP libera A UNA HORA del día, no a las 00:00. `money_release_date` viene con hora
-- (2026-08-22T09:38:26-04:00) y nosotros guardamos solo la fecha, así que todo lo que libera HOY se
-- cuenta como pendiente hasta mañana.
--
-- Medido el 22/08/2026 a las 10:13 ART: 181 órdenes con release date = hoy, $5.267.125 declarados
-- como "a liquidar" — plata que va cayendo al saldo de Santi a lo largo del día. Muestra de 12
-- consultadas a MP en ese momento: 2 ya en `released` (release 08:33 y 09:38), 10 en `pending`
-- (release 11:52 a 19:30). O sea: el error no es fijo, arranca en $5,3 M a la mañana y se va a cero
-- a la noche. La fecha no alcanza; el estado sí.
--
-- Fix: guardar `money_release_status` en el mismo fetch que ya trae neto y retención, y que
-- ml_a_liquidar() excluya lo liberado. `mp_net` no se toca: nunca estuvo mal.
-- Sin dato todavía (null) = pendiente, que es el comportamiento de siempre — la tarjeta nunca cuenta
-- de menos por falta de información. Y las liberadas salen solas del conjunto al día siguiente
-- (mp_release_date < hoy), así que no hace falta tocar el filtro de re-consulta del sync.

alter table ml_orders add column if not exists mp_release_status text;

create or replace function ml_a_liquidar()
returns table (semana date, pagos int, neto numeric)
language sql stable as $$
  select date_trunc('week', mp_release_date)::date,
         count(*)::int,
         coalesce(sum(mp_net), 0)
  from ml_orders
  where status = 'paid'
    and mp_release_date >= (now() at time zone 'America/Argentina/Buenos_Aires')::date
    and coalesce(mp_release_status, 'pending') <> 'released'
  group by 1
  order by 1
$$;

revoke execute on function ml_a_liquidar() from anon;
grant execute on function ml_a_liquidar() to authenticated, service_role;

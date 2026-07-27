-- 057 — Una devolución que lleva +30 días sin cerrar se da por DEVUELTA.
--
-- El problema: `RM` ("Rendido a Matriz") y `DV`/`RV` son estados de devolución EN CURSO, y la
-- devolución recién termina en `RC` ("Conformes y devoluciones rendidos al remitente"). Cuando
-- Urbano nunca emite el `RC`, la guía queda en `en_devolucion` para siempre: no es entregada, no es
-- devuelta, **no resuelve**. La cohorte de ese día nunca llega a 100% y no aparece en /trabados
-- (el predicado de la 038 excluye `en_devolucion` a propósito, porque una devolución en curso no es
-- una pieza trabada). Resultado: cohortes de junio clavadas en 93-99% por 61 guías en RM + 8 en DV.
--
-- La decisión (Pancho, 27/07/2026): a los 30 días el desenlace comercial ya ocurrió — la venta se
-- perdió. Contarla como `devuelto` cierra la cohorte y dice la verdad del negocio.
--
-- Es P&L-NEUTRO por construcción: `devuelto` y `en_devolucion` pagan igual (flete completo, sin
-- imputar costo de producto — el costo va solo en entregado+siniestro, migr 036). Lo que SÍ cambia
-- es el ESTIMADO: la proyección dejaba de contar esas guías como "todavía pueden entregarse", así
-- que el revenue_estimado de esos días baja y se acerca al confirmado. Es el punto.
--
-- Se resuelve con datos, no con un remap en la consulta, porque el remap de edad (el de `PI` +7d de
-- la 018) está copiado en ~19 funciones y meter una segunda regla ahí sería multiplicar el mismo
-- error. Y es estable: `devuelto` es TERMINAL para el sync (lib/couriers/sync.ts) → una vez marcada,
-- no se vuelve a consultar y ningún re-sync la pisa. `status_raw` queda intacto ('RM'), así que
-- siempre se puede auditar cuáles se cerraron por esta regla:
--   select * from shipments where status_raw = 'RM' and status_canonical = 'devuelto';

create or replace function cerrar_devoluciones_viejas(p_dias int default 30) returns int
language plpgsql as $fn$
declare v_n int; v_desde date; v_hasta date;
begin
  select min(dispatched_at), max(dispatched_at) into v_desde, v_hasta
  from shipments
  where status_canonical = 'en_devolucion'
    and status_at is not null
    and current_date - status_at::date > p_dias;

  update shipments
     set status_canonical = 'devuelto',
         resolved_at = coalesce(resolved_at, status_at),
         updated_at = now()
   where status_canonical = 'en_devolucion'
     and status_at is not null
     and current_date - status_at::date > p_dias;
  get diagnostics v_n = row_count;

  if v_n > 0 and v_desde is not null then
    perform recompute_daily_pnl(v_desde, coalesce(v_hasta, current_date));
  end if;
  return v_n;
end $fn$;

revoke execute on function cerrar_devoluciones_viejas(int) from anon, authenticated;

select cerrar_devoluciones_viejas(30);

-- Diario, para que las que van cumpliendo 30 días se cierren solas. pg_cron no existe en el
-- Postgres embebido de test:db, así que el schedule se saltea ahí sin romper nada.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('cerrar-devoluciones-viejas')
      where exists (select 1 from cron.job where jobname = 'cerrar-devoluciones-viejas');
    perform cron.schedule('cerrar-devoluciones-viejas', '35 5 * * *',
                          'select cerrar_devoluciones_viejas(30)');
  end if;
end $$;

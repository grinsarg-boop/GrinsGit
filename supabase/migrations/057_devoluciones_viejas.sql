-- 057 — Una devolución que lleva +30 días sin cerrar se da por DEVUELTA.
--
-- `RM` ("Rendido a Matriz") y `DV`/`RV` son estados de devolución EN CURSO; la devolución recién
-- termina en `RC` ("Conformes y devoluciones rendidos al remitente"). Cuando Urbano nunca emite el
-- `RC`, la guía se queda ahí para siempre. Decisión de Pancho (27/07/2026): a los 30 días el
-- desenlace comercial ya ocurrió — la venta se perdió — así que corresponde llamarla `devuelto`.
--
-- ⚠️ LO QUE ESTA MIGRACIÓN **NO** HACE, y la primera versión de este comentario decía que sí:
-- **no mueve la madurez de ninguna cohorte y no cambia un solo número de ningún panel.** El
-- diagnóstico original ("las cohortes de junio están clavadas por 61 guías en RM") era falso:
--   · `sales_days` (030, línea 84) ya cuenta `en_devolucion` DENTRO de `resueltas`:
--       filter (where st in ('entregado','rehusado','en_devolucion','devuelto','siniestro'))
--   · `analisis_zonas` (035/036) agrupa `en_devolucion` junto a `devuelto` en `devueltas`.
--   Comprobado en prod: los mismos días de junio dan idénticos antes y después de aplicar esto
--   (13/06 94/93 · 24/06 93/91 · 29/06 122/121 · 30/06 141/132).
--
-- Entonces esto vale sólo por la SEMÁNTICA (que el estado diga la verdad del negocio), y tiene un
-- costo real que se asume a conciencia: `devuelto` es TERMINAL para el sync (`TERMINALES` en
-- lib/couriers/sync.ts) → estas 39 guías dejan de consultarse, y justo le pedimos a Urbano por mail
-- que cierre esas devoluciones. Si las cierra, no lo vamos a ver. Si eso molesta, revertir es
-- devolverlas a `en_devolucion` filtrando por `status_raw='RM' and status_canonical='devuelto'`.
--
-- Es P&L-neutro: `devuelto` y `en_devolucion` pagan igual (flete completo, sin imputar costo de
-- producto — el costo va sólo en entregado+siniestro, migr 036).
--
-- Se resuelve con datos y no con un remap en la consulta porque el remap de edad de la 018
-- (`PI` +7d → no_despachado) está copiado en ~19 funciones y una segunda regla ahí multiplicaría el
-- mismo problema. `status_raw` queda intacto ('RM'): es la evidencia de por qué se cerró.
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

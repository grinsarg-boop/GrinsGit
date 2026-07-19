-- 033 — Saldo A COBRAR de Urbano. Espejo del saldo a pagar (flete): acá es la plata que Urbano nos
-- debe por el COD que cobró en la puerta.
--
-- Ciclo de Urbano, verificado contra una liquidación y su factura reales (14/07/2026):
--   · ventana de cobranza = MARTES a LUNES inclusive, por fecha de ENTREGA
--   · giro el martes siguiente
--   · del giro ya viene descontada la comisión de contrareembolso CON impuestos
--
-- La conciliación cerró al centavo contra el archivo `resumen_transferencia_15_07_2026`:
--   liquidación                     $7.410.197,00
--   factura CONTRAREMBOLSOS 4,3%      $318.638,51   (7.410.197 × 0,043)
--   + IVA 21 + ARBA IIBB 5 + AGIP IIBB 3 = ×1,29
--   total factura                     $411.043,69
--   giro = liquidación − factura    $6.999.153,31   ← el pago real fue $6.999.153,32
-- ⇒ la tasa efectiva del giro es 4,3% × 1,29 = 5,547%, que es `settings.commission_pct->>'urbano'`.
--
-- Ojo: la hora del corte NO se puede inferir de nuestros datos. El WS de Urbano devuelve fecha sin
-- hora (`shipment_events.occurred_at` queda a las 12:00Z, o 23:59:59 si es el evento sintético de la
-- 019), así que el corte es a nivel DÍA. Alcanza: las entregas de un lunes caen enteras en su ventana.

create or replace function urbano_cobranza(p_desde date)
returns table (
  ventana_ini date, ventana_fin date, fecha_pago date,
  guias int, cod_bruto numeric, comision numeric, neto numeric
) language sql stable as $$
  with ent as (
    select
      -- martes de la ventana que contiene la entrega. isodow: lun=1 … dom=7 ⇒ offset (isodow−2) mod 7,
      -- con el +7 porque en Postgres el módulo hereda el signo del dividendo (lunes daría −1).
      (d.dia - ((extract(isodow from d.dia)::int - 2 + 7) % 7))::date as ini,
      d.cod
    from (
      select (s.status_at at time zone 'America/Argentina/Buenos_Aires')::date as dia,
             coalesce(o.cod_amount, 0) as cod
      from shipments s
      join orders o on o.id = s.order_id
      where s.courier = 'urbano'
        and s.status_canonical = 'entregado'
        and s.status_at is not null
    ) d
    where d.dia >= p_desde
  ),
  agg as (
    select ini, count(*)::int as guias, coalesce(sum(cod), 0) as bruto
    from ent group by ini
  )
  select a.ini,
         (a.ini + 6)::date,                     -- lunes de cierre
         (a.ini + 7)::date,                     -- martes de pago
         a.guias,
         a.bruto,
         a.bruto * v.rate,
         a.bruto * (1 - v.rate)
  from agg a
  cross join (
    select coalesce(((select value from settings where key = 'commission_pct')->>'urbano')::numeric, 0) as rate
  ) v
  order by a.ini desc
$$;

revoke execute on function urbano_cobranza(date) from anon;
grant execute on function urbano_cobranza(date) to authenticated, service_role;

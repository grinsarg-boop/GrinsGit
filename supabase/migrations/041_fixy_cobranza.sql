-- 041 — fixy_cobranza(): COD entregado por Fixy por día de ENTREGA (ART), bruto y neto de la
-- comisión (settings.commission_pct->fixy, hoy 1%). Es el "esperado" autoritativo del bloque
-- "A cobrar de Fixy" del panel: contra esto se concilian los sobres cargados en la app Cashflow.
-- (Fixy rinde el COD en sobres físicos que viajan con el transportista; una parte se cobra
-- digital y no pasa por sobre — por eso el panel muestra el gap como techo, no como deuda exacta.)

create or replace function fixy_cobranza(p_desde date)
returns table (dia date, guias int, cod_bruto numeric, neto numeric)
language sql stable as $$
  select (s.status_at at time zone 'America/Argentina/Buenos_Aires')::date,
         count(*)::int,
         coalesce(sum(o.cod_amount), 0),
         coalesce(sum(o.cod_amount), 0)
           * (1 - ((select value from settings where key = 'commission_pct')->>'fixy')::numeric)
  from shipments s
  join orders o on o.id = s.order_id
  where s.courier = 'fixy'
    and s.status_canonical = 'entregado'
    and s.status_at is not null
    and (s.status_at at time zone 'America/Argentina/Buenos_Aires')::date >= p_desde
  group by 1
  order by 1
$$;

revoke execute on function fixy_cobranza(date) from anon;
grant execute on function fixy_cobranza(date) to authenticated, service_role;

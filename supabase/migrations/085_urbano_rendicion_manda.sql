-- 085 — Si Urbano la pagó, la entregó. La rendición le gana al evento del webservice.
--
-- 15 guías figuraban devueltas / en tránsito / con incidencia y estaban cobradas en un resumen.
-- No es un mapeo mal hecho: se midió. Si `RM` fuera "entregado" tendría el mismo ratio de pago que
-- `DL` (91,3% de las guías DL están en un resumen); tiene 1,0% y 20,4%. `RM - Rendido a Matriz` es
-- ambiguo por diseño — se usa tanto para rendir la PLATA de una entrega como para rendir el BULTO
-- de una devolución, y desde los eventos no hay forma de saber cuál. Nueve de las quince ni
-- siquiera tienen recorrido: el WS solo dio el despacho sintético y después el RM.
--
-- Lo que sí es un hecho documental: Urbano no gira el COD de un bulto que volvió. Estar en una
-- rendición que vale (084) es prueba de entrega, y le gana a cualquier sigla.
--
-- La fecha: si la guía tiene algún evento de entrega se usa ese. Si no tiene ninguno (el caso de
-- Tucumán), el lunes de cierre de la ventana que la pagó — no inventa el día exacto, pero cae
-- siempre DENTRO de la ventana correcta, que es lo que urbano_cobranza necesita para no generar
-- un faltante fantasma en la semana de al lado.

create or replace function urbano_rendicion_manda() returns int
language plpgsql as $fn$
declare v_n int;
begin
  with pagadas as (
    -- min: una guía puede figurar en dos resúmenes (pasó con 7013247254768 el 04/08). Vale el primero.
    select r.guia, min(r.fecha_pago) as fecha_pago
    from urbano_rendiciones r where r.vale group by r.guia
  ), fix as (
    update shipments s
       set status_canonical = 'entregado',
           status_at = coalesce(
             (select max(e.occurred_at) from shipment_events e
               where e.shipment_id = s.id and map_status('urbano', e.status_raw) = 'entregado'),
             ((p.fecha_pago - 1)::text || 'T12:00:00Z')::timestamptz),
           resolved_at = coalesce(s.resolved_at, coalesce(
             (select max(e.occurred_at) from shipment_events e
               where e.shipment_id = s.id and map_status('urbano', e.status_raw) = 'entregado'),
             ((p.fecha_pago - 1)::text || 'T12:00:00Z')::timestamptz)),
           updated_at = now()
      from pagadas p
     where s.courier = 'urbano' and s.tracking = p.guia
       and s.status_canonical is distinct from 'entregado'
    returning 1
  ) select count(*)::int into v_n from fix;
  return v_n;
end $fn$;

revoke execute on function urbano_rendicion_manda() from anon;
grant execute on function urbano_rendicion_manda() to authenticated, service_role;

-- ponytail: la corrección se aplica al importar, no en upsert_shipment_events. Un evento nuevo
-- sobre una guía ya cobrada podría volver a pisarla, pero son guías cerradas hace semanas y el
-- próximo push la corrige igual. Si algún día pisa de verdad, el lugar es el `order by occurred_at
-- desc, id desc` de la 074.
-- Reemplaza la 084: mismo cuerpo, más la llamada al final.
create or replace function import_urbano_rendiciones(p jsonb) returns int
language plpgsql as $fn$
declare v_n int;
begin
  with filas as (
    select x->>'resumen' as resumen, (x->>'fecha_pago')::date as fecha_pago, x->>'fmt' as fmt,
           x->>'guia' as guia, (x->>'monto')::numeric as monto,
           nullif(x->>'comprobante', '') as comprobante,
           nullif(x->>'transferido', '')::date as transferido,
           x->>'archivo' as archivo, coalesce((x->>'vale')::boolean, true) as vale
    from jsonb_array_elements(p) x
    where x->>'guia' is not null and x->>'resumen' is not null
  ), up as (
    insert into urbano_rendiciones (resumen, fecha_pago, fmt, guia, monto, comprobante, transferido, archivo, vale)
    select resumen, fecha_pago, fmt, guia, monto, comprobante, transferido, archivo, vale from filas
    on conflict (resumen, fecha_pago, guia) do update set
      fmt = excluded.fmt, monto = excluded.monto, comprobante = excluded.comprobante,
      transferido = excluded.transferido, archivo = excluded.archivo, vale = excluded.vale
    returning 1
  ) select count(*)::int into v_n from up;
  perform urbano_rendicion_manda();
  return v_n;
end $fn$;

revoke execute on function import_urbano_rendiciones(jsonb) from anon, authenticated;
grant execute on function import_urbano_rendiciones(jsonb) to service_role;

select urbano_rendicion_manda();

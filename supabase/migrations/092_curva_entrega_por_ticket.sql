-- 092 · La tasa de entrega en función del ticket, medida, para que el simulador de precio no use
-- una constante.
--
-- Por qué existe: la intuición dice que un pedido más caro se rechaza más en la puerta, y sobre esa
-- intuición se apoya el argumento de "bajemos el precio, va a entregar mejor y además va a
-- convertir más". Medido el 12/09/2026 sobre Urbano (despachos desde el 01/07), pasa exactamente
-- lo contrario — dentro del MISMO producto, el pack más caro entrega MEJOR:
--
--   Pureza    x1 $39.973 → 51,3% (n=240) · x2 $50.031 → 56,6% (n=2.327) · x3 $59.989 → 65,2% (n=526)
--   Natures   x1 $39.980 → 52,6% · x2 $49.980 → 52,7% · x3 $59.981 → 63,5%
--   BeeVenom              x2 $48.999 → 59,3% · x3 $58.999 → 71,7%
--
-- +13,9 pp de x1 a x3 en Pureza con n grande, y el patrón se repite en 3 de 4 productos (Veinguard
-- es el contraejemplo, con n chico). O sea: bajar el precio no compra tasa de entrega, la empeora.
-- Quien compra el pack grande está más comprometido y abre la puerta; el que compra el frasco
-- suelto es el que más deja plantado al repartidor.
--
-- Se expone como RPC en vez de hardcodear la curva en el código porque estos números se mueven con
-- el mix de CP y con la operación del courier. Una constante en el repo envejece en semanas y nadie
-- se entera; una RPC se re-mide sola cada vez que se abre el panel.
--
-- Agrupa por (producto, pack) y no por bandas de monto para no confundir precio con producto: dos
-- productos distintos al mismo ticket tienen tasas distintas por su mix de zona. Dentro de un
-- producto, el pack ES el precio y nada más cambia.

create or replace function curva_entrega_por_ticket(
  p_courier text default 'urbano',
  p_desde   date default (current_date - interval '90 days')::date,
  p_min_n   int  default 40
)
returns table (
  producto  text,
  pack      int,
  ticket    numeric,
  n         bigint,
  entregados bigint,
  tasa      numeric
)
language sql
stable
as $$
  with r as (
    select pr.name as producto, oi.pack, o.total,
           (s.status_canonical = 'entregado') as entregado
    from shipments s
    join orders o       on o.id = s.order_id
    join order_items oi on oi.order_id = o.id
    join products pr    on pr.id = oi.product_id
    where s.courier = p_courier
      and s.dispatched_at >= p_desde
      and o.cod_amount > 0                              -- prepago no tiene riesgo de puerta
      and s.status_canonical in ('entregado','devuelto','en_devolucion','rehusado')
  )
  select producto,
         pack,
         round(avg(total))                                                as ticket,
         count(*)                                                         as n,
         count(*) filter (where entregado)                                as entregados,
         round(count(*) filter (where entregado)::numeric / count(*), 4)  as tasa
  from r
  group by producto, pack
  having count(*) >= p_min_n
  order by producto, pack;
$$;

comment on function curva_entrega_por_ticket is
  'Tasa de entrega por (producto, pack) = por precio con producto constante. Alimenta el simulador '
  'de precio en /precio. Medido 12/09/2026: la tasa SUBE con el ticket (+13,9 pp de x1 a x3 en '
  'Pureza), así que bajar precio no compra entrega.';

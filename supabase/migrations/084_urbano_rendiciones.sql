-- 084 — Lo que Urbano REALMENTE pagó, guía por guía.
--
-- Hasta acá `urbano_cobranza()` (033) solo ESTIMABA: tomaba nuestras entregas, las metía en la
-- ventana martes→lunes y aplicaba el 5,547%. Nunca supo qué liquidó Urbano de verdad. El dato
-- existía pero vivía fuera de la base, en `datos/urbano_rendiciones.csv` (lo arma
-- scripts/urbano-rendiciones.py desde los PDF/xls/xlsx que mandan por mail).
--
-- Por qué importa: una liquidación puede girarse mucho después de su ventana. El resumen 5468
-- (entregas de mayo, $8.928.065) se reemitió como 5545 y recién se transfirió el 28/07/2026 —
-- 77 días. Con solo la estimación eso se lee como "mayo cobrado en mayo", y no fue así.
--
-- `vale = false` marca la reimpresión: el 5545 repite 197/197 guías del 5468 y el detalle xlsx
-- 5141 repite las 82 del 5728. Son el MISMO giro exportado dos veces; contarlas dos veces infla
-- lo cobrado y esconde el faltante. Quién es reimpresión lo decide scripts/_urbano-rend.mjs
-- (>95% de guías en común con un resumen anterior), que es el mismo criterio que usa el reclamo.

create table if not exists urbano_rendiciones (
  resumen     text    not null,
  fecha_pago  date    not null,          -- martes de giro que liquida (empalma con urbano_cobranza)
  fmt         text    not null,          -- A = detalle de transferencia · B = resumen a pagar
  guia        text    not null,          -- 13 dígitos, o BLABS<pedido> desde el 04/08/2026 (070)
  monto       numeric not null,          -- COD bruto de esa guía, antes de la comisión
  comprobante text,                      -- nº de comprobante bancario, o la leyenda que venga
  transferido date,                      -- cuándo salió el giro; ≠ fecha_pago si se pagó tarde
  archivo     text,
  vale        boolean not null default true,
  primary key (resumen, fecha_pago, guia)
);
create index if not exists urbano_rendiciones_guia_idx on urbano_rendiciones (guia);
create index if not exists urbano_rendiciones_pago_idx on urbano_rendiciones (fecha_pago) where vale;

alter table urbano_rendiciones enable row level security;
revoke all on urbano_rendiciones from anon;
grant select on urbano_rendiciones to authenticated, service_role;

-- p = array de filas del CSV. Idempotente por (resumen, fecha_pago, guia): se puede reempujar
-- entero cada vez que llega un resumen nuevo sin duplicar nada.
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
  return v_n;
end $fn$;

revoke execute on function import_urbano_rendiciones(jsonb) from anon, authenticated;
grant execute on function import_urbano_rendiciones(jsonb) to service_role;

-- ── urbano_cobranza: la estimación de la 033 más lo que se rindió de verdad ────────────────────
-- Se agregan columnas al final (drop + create: Postgres no deja cambiar el tipo de retorno con
-- replace). Los consumidores leen por nombre, así que sumar campos no rompe nada.
-- `rendido_*` cuenta solo `vale` — ver arriba. `girado_el` es el último giro de esa ventana: si
-- viene muy por detrás de fecha_pago, esa liquidación se pagó tarde.
drop function if exists urbano_cobranza(date);
create or replace function urbano_cobranza(p_desde date)
returns table (
  ventana_ini date, ventana_fin date, fecha_pago date,
  guias int, cod_bruto numeric, comision numeric, neto numeric,
  rendido_guias int, rendido_bruto numeric, girado_el date
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
  ),
  rend as (
    select r.fecha_pago, count(*)::int as guias, sum(r.monto) as bruto, max(r.transferido) as girado
    from urbano_rendiciones r where r.vale and r.fecha_pago >= p_desde group by r.fecha_pago
  ),
  -- Las ventanas salen de los DOS lados. Con un left join desde las entregas, una liquidación cuya
  -- ventana no tiene entregas nuestras desaparecía sin ruido — y es justo el caso que motiva esta
  -- migración: el 5545 tiene fecha_pago 19/06, un viernes, que nunca puede empatar con el martes
  -- que sale de una entrega. Eran $8.878.075 invisibles.
  claves as (
    select (ini + 7)::date as fecha_pago, ini from agg
    union
    select fecha_pago, (fecha_pago - 7)::date from rend
  )
  select k.ini,
         (k.ini + 6)::date,                     -- lunes de cierre
         k.fecha_pago,                          -- martes de pago
         coalesce(a.guias, 0),
         coalesce(a.bruto, 0),
         coalesce(a.bruto, 0) * v.rate,
         coalesce(a.bruto, 0) * (1 - v.rate),
         coalesce(r.guias, 0),
         coalesce(r.bruto, 0),
         r.girado
  from claves k
  left join agg  a on a.ini = k.ini
  left join rend r on r.fecha_pago = k.fecha_pago
  cross join (
    select coalesce(((select value from settings where key = 'commission_pct')->>'urbano')::numeric, 0) as rate
  ) v
  order by k.ini desc
$$;

revoke execute on function urbano_cobranza(date) from anon;
grant execute on function urbano_cobranza(date) to authenticated, service_role;

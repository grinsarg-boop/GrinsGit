-- 093 — El impuesto de Meta por cuenta pasa a tener tramos con fecha de fin.
--
-- Desde el 16/09/2026 la pauta de R3 (act_1569698667101520) se paga con cripto y el recargo es
-- ~10%, no 36,4% (Pancho, 19/09/2026: "desde que lo notifiqué a hoy"). La 078 modelaba UN factor
-- por cuenta con `desde` y sin `hasta`, así que no había forma de cerrar el 36,4% sin borrarlo del
-- histórico. Ahora cada cuenta lleva una lista de tramos [{pct, desde, hasta?}]; gana el tramo
-- vigente para la fecha del gasto y una fecha fuera de todo tramo paga 0 (comportamiento anterior).
-- El ~10% es estimación de Pancho, no lectura de extracto: ajustar el pct cuando cierre el primer
-- movimiento. Sigue siendo el único lugar donde vive la regla: P&L, /ventas y ads_sin_cohorte la
-- heredan por v_ad_spend.spend_real.

update settings set value = '{"act_1569698667101520": [
  {"pct": 0.364, "desde": "2026-08-07", "hasta": "2026-09-15"},
  {"pct": 0.10,  "desde": "2026-09-16"}
]}'::jsonb
where key = 'meta_ads_impuestos';

create or replace view v_ad_spend as
select a.*,
       a.spend * (1 + coalesce((
         select (x->>'pct')::numeric
         from jsonb_array_elements(case when jsonb_typeof(t.value -> a.account_id) = 'array'
                                        then t.value -> a.account_id else '[]'::jsonb end) x
         where a.date >= (x->>'desde')::date
           and a.date <= coalesce((x->>'hasta')::date, 'infinity'::date)
         order by (x->>'desde')::date desc
         limit 1), 0)) as spend_real
from ad_spend a
left join lateral (select value from settings where key = 'meta_ads_impuestos') t on true;

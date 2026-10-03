// Días hasta la PRIMERA VISITA del courier, por CP × courier (Urbano / Fixy; Correo no tiene guía).
// Fuente: shipments + shipment_events. Cohortes maduras (despachadas hace ≥21 días) desde 2026-05-01
// (antes de mayo Fixy no tiene historial completo — ver migración 073).
// Salida: datos/tiempos-entrega-cp.json (+ .csv). Niveles de fallback: cp (n≥5) → prefijo 2 dígitos (n≥10) → global.
// Uso: node scripts/tiempos-entrega-cp.mjs
import pg from 'pg';
import { readFileSync, writeFileSync } from 'node:fs';

const DESDE = '2026-05-01';        // Urbano: estable mes a mes desde mayo (med 5-6)
const DESDE_FIXY = '2026-07-01';   // Fixy: may-jun dan med 0 (el alta del XLSX caía el día de la visita); jul-ago dan 2, que es lo real
const MIN_CP = 5, MIN_PREFIJO = 10;
// Primera visita = primer evento que implica que el chofer fue (o salió) al domicilio.
// Urbano: LD salida a ruta · DL/EI entregado · CA ausente · VN/BA no entregado · SP guarda tras visita.
// Fixy:   39/POD entregada · 127 visita sin contacto · 51 rechaza · 48 dirección · 52 reprograma · 63 zona · 125 sin dinero.
//   (el 70 "ruteado" de Fixy cae el mismo día que la visita: no suma)
const SQL = `
with ev as (
  select s.courier, regexp_replace(o.zip,'\\D','','g') cp, s.dispatched_at,
         (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date creada,
         min((e.occurred_at at time zone 'America/Argentina/Buenos_Aires')::date) filter (where
           e.raw->>'sintetico' is null and (
             (s.courier='urbano' and e.status_raw in ('LD','DL','EI','CA','VN','BA','SP')) or
             (s.courier='fixy'   and e.status_raw in ('39','POD-ENTREGADA','127','51','48','52','63','125')))) visita
  from shipments s
  join orders o on o.id = s.order_id
  join shipment_events e on e.shipment_id = s.id
  where s.courier in ('urbano','fixy') and s.status_canonical <> 'cancelado'
    and s.dispatched_at >= (case s.courier when 'fixy' then $2 else $1 end)::date and s.dispatched_at <= current_date - 21
    and length(regexp_replace(o.zip,'\\D','','g')) = 4
  group by s.id, 1, 2, 3, 4
), base as (
  select courier, cp, left(cp,2) prefijo, visita - dispatched_at d_desp, visita - creada d_pedido
  from ev where visita is not null and visita >= dispatched_at
), agg as (
  select nivel, clave, courier, count(*)::int n,
         round(percentile_cont(0.5) within group (order by d_desp)::numeric,1)   med,
         round(percentile_cont(0.8) within group (order by d_desp)::numeric,1)   p80,
         round(percentile_cont(0.5) within group (order by d_pedido)::numeric,1) med_pedido,
         round(percentile_cont(0.8) within group (order by d_pedido)::numeric,1) p80_pedido
  from (
    select 'cp' nivel, cp clave, * from base
    union all select 'prefijo', prefijo, * from base
    union all select 'global', '*', * from base
  ) u
  group by 1,2,3
)
select * from agg
where (nivel='cp' and n >= ${MIN_CP}) or (nivel='prefijo' and n >= ${MIN_PREFIJO}) or nivel='global'
order by nivel, clave, courier`;

const url = readFileSync('.env.local','utf8').match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows } = await c.query(SQL, [DESDE, DESDE_FIXY]);
const { rows: [{ hasta }] } = await c.query(`select (current_date - 21)::date hasta`);
await c.end();

const out = {
  generado: new Date().toISOString().slice(0,10),
  despachos: { desde: { urbano: DESDE, fixy: DESDE_FIXY }, hasta: String(hasta).slice(0,10) },
  que_mide: 'días corridos desde el despacho (med/p80) y desde el pedido (med_pedido/p80_pedido) hasta la primera visita del courier; mediana y percentil 80',
  fallback: `cp (n≥${MIN_CP}) → prefijo (2 dígitos, n≥${MIN_PREFIJO}) → global`,
  global: {}, prefijo: {}, cp: {},
};
for (const r of rows) {
  const dest = r.nivel === 'global' ? out.global : (out[r.nivel][r.clave] ??= {});
  dest[r.courier] = { n: r.n, med: +r.med, p80: +r.p80, med_pedido: +r.med_pedido, p80_pedido: +r.p80_pedido };
}
writeFileSync('datos/tiempos-entrega-cp.json', JSON.stringify(out, null, 1));
writeFileSync('datos/tiempos-entrega-cp.csv',
  'nivel,clave,courier,n,med_despacho,p80_despacho,med_pedido,p80_pedido\n' +
  rows.map(r => [r.nivel, r.clave, r.courier, r.n, r.med, r.p80, r.med_pedido, r.p80_pedido].join(',')).join('\n') + '\n');

// Versión para pegar en el form de Shopify (sections/veltron-cod-checkout-form.liquid, al lado de FIXY):
// [med_pedido, p80_pedido] redondeados = días corridos desde el pedido hasta la primera visita. f=fixy, u=urbano.
const compact = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.fromEntries(
  Object.entries(v).map(([c, m]) => [c[0], [Math.round(m.med_pedido), Math.round(m.p80_pedido)]]))]));
const T = { cp: compact(out.cp), pf: compact(out.prefijo), g: compact({ x: out.global }).x };
const formJs = `/* tiempos de entrega reales por CP (primera visita, días corridos desde el pedido) — generado ${out.generado} por scripts/tiempos-entrega-cp.mjs */
const TIEMPOS=${JSON.stringify(T)};
function tiempoEntrega(cp,courier){var k=courier==='fixy'?'f':'u';var r=(TIEMPOS.cp[cp]||{})[k]||(TIEMPOS.pf[String(cp).slice(0,2)]||{})[k]||TIEMPOS.g[k];return r[0]===r[1]?r[0]+' días':r[0]+' a '+r[1]+' días';}
`;
writeFileSync('datos/tiempos-entrega-cp.form.js', formJs);

// self-check del resolver: cp exacto → prefijo → global
{
  const fn = new Function(formJs + 'return tiempoEntrega;')();
  const cpF = Object.keys(T.cp).find(k => T.cp[k].f), cpU = Object.keys(T.cp).find(k => T.cp[k].u);
  const esp = (r) => r[0] === r[1] ? r[0] + ' días' : r[0] + ' a ' + r[1] + ' días';
  if (fn(cpF, 'fixy') !== esp(T.cp[cpF].f)) throw new Error('cp fixy');
  if (fn(cpU, 'urbano') !== esp(T.cp[cpU].u)) throw new Error('cp urbano');
  const pfU = Object.keys(T.pf).find(k => T.pf[k].u && !T.cp[k + '99']);
  if (fn(pfU + '99', 'urbano') !== esp(T.pf[pfU].u)) throw new Error('prefijo');
  if (fn('0000', 'urbano') !== esp(T.g.u) || fn('0000', 'fixy') !== esp(T.g.f)) throw new Error('global');
}

const cnt = (nivel) => rows.filter(r => r.nivel === nivel).length;
console.log(`filas: cp ${cnt('cp')} · prefijo ${cnt('prefijo')} · global ${cnt('global')}`);
console.log('global:', JSON.stringify(out.global));

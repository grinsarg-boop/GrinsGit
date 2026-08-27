// Vista de decisión por anuncio, leída en vivo de la Graph API.
// Uso: node scripts/vista.mjs [filtro] [dias]     ej: node scripts/vista.mjs arraigo 1
//      node scripts/vista.mjs --self-check
//
// Existe porque Ads Manager NO puede calcular la única columna que decide: el costo por
// Initiate Checkout contra el break-even DEL PRODUCTO. Sus columnas son globales; el umbral
// no lo es. Todo lo demás (gasto, compras, CPA, CTR) igual está acá para no abrir dos cosas.
//
// La regla de corte es la de Pancho: 1× CPA objetivo gastado sin vender → se apaga. El IC es
// la misma decisión con 2,5× la muestra (ver Obsidian 20-Ads/Learnings §Apéndice 06/08/2026).
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);

// CPA objetivo por producto — CANON del apéndice 13/07 de 20-Ads/Learnings.md.
// ARRAIGO sale del CPA Veltron por unidad (Serum-Capilar.md:494).
const CPA_OBJ = { arraigo: 12884, veinguard: 9300, beevenom: 8600, natures: 5200, pureza: 4200 };
const CPA_DEFAULT = 8600;

// 2,54 IC por compra medidos sobre 90 d de Tienda R 3 (2.376 IC / 934 compras), estable
// 34,5-44,8% en 11 adsets. HALLAZGO, no ley: si el dedup CAPI de InitiateCheckout está mal
// (Axiomas #69, 1.162 eventos en 7 d) el IC está inflado y este ratio baja.
const IC_POR_COMPRA = 0.393;

const producto = (n) => Object.keys(CPA_OBJ).find((p) => new RegExp(p, 'i').test(n));
const objetivo = (n) => CPA_OBJ[producto(n)] ?? CPA_DEFAULT;

// Un anuncio que vendió no se apaga, gastó lo que gastó. Recién después miramos el gasto seco:
// primero contra el umbral de IC (2,5× más muestra, veredicto 2,6× más temprano) y después
// contra el CPA. Sin llegar a ninguno de los dos, no hay veredicto — no lo inventamos.
export function veredicto({ gasto, compras, ic, cpaObjetivo }) {
  if (compras > 0) return 'VENDE';
  const umbralIC = cpaObjetivo * IC_POR_COMPRA;
  if (ic === 0 && gasto >= cpaObjetivo) return 'CORTAR';
  if (ic === 0 && gasto >= umbralIC) return 'sin IC ⚠';
  if (gasto >= cpaObjetivo) return 'sin venta, con IC';
  return `falta $${Math.round(cpaObjetivo - gasto).toLocaleString('es-AR')}`;
}

if (process.argv.includes('--self-check')) {
  const assert = (c, m) => { if (!c) { console.error('✗ ' + m); process.exit(1); } };
  const o = 10000, u = 3930; // umbralIC = 10000 × 0,393
  assert(veredicto({ gasto: 99999, compras: 1, ic: 0, cpaObjetivo: o }) === 'VENDE', 'vender gana a todo');
  assert(veredicto({ gasto: o, compras: 0, ic: 0, cpaObjetivo: o }) === 'CORTAR', 'CPA sin IC = cortar');
  assert(veredicto({ gasto: u, compras: 0, ic: 0, cpaObjetivo: o }) === 'sin IC ⚠', 'umbral IC avisa antes');
  assert(veredicto({ gasto: u - 1, compras: 0, ic: 0, cpaObjetivo: o }).startsWith('falta'), 'sin muestra no hay veredicto');
  assert(veredicto({ gasto: o, compras: 0, ic: 5, cpaObjetivo: o }) === 'sin venta, con IC', 'con IC no es corte automatico');
  assert(objetivo('arraigo-ba-raya') === 12884 && objetivo('xxx') === CPA_DEFAULT, 'producto por nombre');
  console.log('✓ self-check ok');
  process.exit(0);
}

const filtro = process.argv[2] ?? '';
const dias = Number(process.argv[3] ?? 1);
const hasta = new Date().toISOString().slice(0, 10);
const desde = new Date(Date.now() - (dias - 1) * 86400_000).toISOString().slice(0, 10);

const sumar = (arr, tipo) => (arr ?? []).filter((a) => a.action_type === tipo)
  .reduce((s, a) => s + parseFloat(a.value), 0);

const filas = [];
for (const acct of env.META_AD_ACCOUNT_ID.split(',').map((a) => a.trim()).filter(Boolean)) {
  const url = `https://graph.facebook.com/${env.META_API_VERSION ?? 'v25.0'}/${acct}/insights?` +
    new URLSearchParams({
      level: 'ad', limit: '500',
      fields: 'ad_name,adset_name,spend,impressions,ctr,actions,action_values',
      time_range: JSON.stringify({ since: desde, until: hasta }),
      access_token: env.META_ACCESS_TOKEN,
    });
  const body = await fetch(url).then((r) => r.json());
  if (body.error) { console.error(`⚠ ${acct}: ${body.error.message}`); continue; }
  for (const r of body.data ?? []) {
    if (filtro && !new RegExp(filtro, 'i').test(r.ad_name + r.adset_name)) continue;
    const gasto = parseFloat(r.spend ?? '0');
    if (gasto === 0) continue;
    const compras = sumar(r.actions, 'omni_purchase');
    const ic = sumar(r.actions, 'omni_initiated_checkout');
    filas.push({
      ad: r.ad_name, gasto, compras, ic,
      lpv: sumar(r.actions, 'omni_landing_page_view'),
      ctr: parseFloat(r.ctr ?? '0'),
      valor: sumar(r.action_values, 'omni_purchase'),
      obj: objetivo(r.ad_name + r.adset_name),
    });
  }
}
filas.sort((a, b) => b.gasto - a.gasto);

const ars = (n) => (n ? '$' + Math.round(n).toLocaleString('es-AR') : '—');
const pad = (s, n, izq) => (izq ? String(s).padEnd(n) : String(s).padStart(n));
console.log(`\n${desde} → ${hasta}   filtro: ${filtro || '(todos)'}\n`);
console.log(['ANUNCIO'.padEnd(34), pad('GASTO', 11), pad('IMPR·CTR', 8), pad('LPV', 5), pad('IC', 4),
  pad('$/IC', 10), pad('vs eq.', 7), pad('COMP', 5), pad('CPA', 11), 'VEREDICTO'].join(' '));
console.log('─'.repeat(125));

let tg = 0, tc = 0, ti = 0, tv = 0;
for (const f of filas) {
  tg += f.gasto; tc += f.compras; ti += f.ic; tv += f.valor;
  const eq = f.obj * IC_POR_COMPRA;
  const costoIC = f.ic ? f.gasto / f.ic : null;
  console.log([
    pad(f.ad.slice(0, 34), 34, true), pad(ars(f.gasto), 11), pad(f.ctr.toFixed(2) + '%', 8),
    pad(f.lpv || '—', 5), pad(f.ic || '—', 4), pad(ars(costoIC), 10),
    pad(costoIC ? (costoIC / eq).toFixed(2) + '×' : '—', 7),
    pad(f.compras || '—', 5), pad(f.compras ? ars(f.gasto / f.compras) : '—', 11),
    veredicto({ gasto: f.gasto, compras: f.compras, ic: f.ic, cpaObjetivo: f.obj }),
  ].join(' '));
}
console.log('─'.repeat(125));
console.log(`TOTAL ${ars(tg)} · ${tc} compras · CPA ${tc ? ars(tg / tc) : '—'} · ${ti} IC · $/IC ${ars(ti ? tg / ti : 0)}`);
console.log(`\n  "vs eq." = costo por IC ÷ break-even del producto (CPA objetivo × ${IC_POR_COMPRA}). <1× promete.`);

// ROAS va aparte y último a propósito: en COD el numerador es lo FACTURADO, no lo cobrado, así
// que un ROAS lindo convive con perder plata (el top ad de Pureza: ROAS 3,87 y ROAS neto 0,25).
// El número que decide es el ROAS neto del panel COD; éste es contexto.
// El ticket promedio va al lado como control de sanidad del valor que manda el pixel: si diera
// dos órdenes de magnitud menos que el precio de lista, el evento estaría mandando centavos.
// Verificado el 06/08/2026 en ARRAIGO: da $49.900 = precio x1 exacto. El pixel está bien.
const ticket = tc ? tv / tc : 0;
console.log(`\n  ROAS Meta ${tg ? (tv / tg).toFixed(2) : '0'}× · ticket promedio ${ars(ticket)}` +
  (ticket && ticket < 5000 ? '  ⚠️ TICKET ABSURDO: revisar el valor que manda el pixel' : '') +
  `\n  En COD el ROAS de Meta factura, no cobra. El que decide es el ROAS neto del panel.`);

// Reclamo a Urbano en un solo comando: qué plata no rindió, qué piezas están trabadas, y
// —lo que antes no se podía saber— QUÉ SE MOVIÓ desde el reclamo anterior.
//
// Uso:  node scripts/urbano-reclamo.mjs            (genera el reclamo de hoy y lo compara con el último)
//       node scripts/urbano-reclamo.mjs --dry      (no escribe el snapshot; solo muestra)
//
// Cada corrida deja `datos/reclamos/<fecha>.json` (foto de guía+estado+fecha de estado) y un
// `<fecha>-urbano.csv` para mandar. La foto es lo que convierte el reclamo en un ciclo: en la
// corrida siguiente, toda guía que sigue en la lista CON EL MISMO estado y la misma fecha de
// estado es una pieza que Urbano no tocó → esas se escalan, el resto se cierra solo.
//
// Requiere `datos/urbano_rendiciones.csv` (lo genera scripts/urbano-rendiciones.py desde los PDF).
import pg from 'pg';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(RAIZ, 'datos', 'reclamos');
const HOY = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);   // ART
const COMISION = 0.05547;                                                     // 4,3% × 1,29 (migr 033)
const dry = process.argv.includes('--dry');
const $ = (n) => '$' + Math.round(n).toLocaleString('es-AR');

// ── rendiciones (lo que Urbano REALMENTE pagó) ────────────────────────────────────────────────
const csv = readFileSync(join(RAIZ, 'datos', 'urbano_rendiciones.csv'), 'utf8').trim().split('\n');
const cab = csv[0].split(',');
const rend = csv.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, i) => [cab[i], v])));

// Una reimpresión (mismas guías que un resumen anterior) no es plata nueva — descartarla, o el
// faltante sale menor de lo que es. Ver el aviso de urbano-rendiciones.py.
const porResumen = new Map();
for (const r of rend) {
  const k = `${r.fecha}|${r.resumen}`;
  if (!porResumen.has(k)) porResumen.set(k, new Set());
  porResumen.get(k).add(r.guia);
}
const reimpresos = new Set();
const claves = [...porResumen.keys()].sort();
for (let i = 0; i < claves.length; i++)
  for (let j = i + 1; j < claves.length; j++) {
    const [a, b] = [porResumen.get(claves[i]), porResumen.get(claves[j])];
    const comun = [...b].filter((g) => a.has(g)).length;
    if (comun / b.size > 0.95) reimpresos.add(claves[j]);
  }
const pagada = new Map();                       // guía → fecha del resumen que la pagó
for (const r of rend) if (!reimpresos.has(`${r.fecha}|${r.resumen}`)) pagada.set(r.guia, r.fecha);

// Martes de giro con resumen en mano, y si ese martes trae los DOS formatos. Un martes al que le
// falta un formato no prueba nada: sus "faltantes" pueden estar en el archivo que no tenemos.
const martes = new Map();
for (const r of rend) {
  if (reimpresos.has(`${r.fecha}|${r.resumen}`)) continue;
  if (!martes.has(r.fecha)) martes.set(r.fecha, new Set());
  martes.get(r.fecha).add(r.fmt);
}
const completo = (f) => martes.get(f)?.size === 2;

// martes de giro de una entrega: ventana martes→lunes, giro el martes siguiente (migr 033)
const giroDe = (iso) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 5) % 7) + 7);
  return d.toISOString().slice(0, 10);
};
if (process.argv.includes('--check')) {                    // node scripts/urbano-reclamo.mjs --check
  const { strictEqual: eq } = await import('node:assert');
  eq(giroDe('2026-06-16'), '2026-06-23');                  // martes: abre su propia ventana
  eq(giroDe('2026-06-22'), '2026-06-23');                  // lunes: cierra esa misma ventana
  eq(giroDe('2026-06-21'), '2026-06-23');                  // domingo, adentro
  eq(giroDe('2026-06-15'), '2026-06-16');                  // lunes anterior → ventana anterior
  console.log('ok'); process.exit(0);
}

// ── base ──────────────────────────────────────────────────────────────────────────────────────
const env = readFileSync(join(RAIZ, '.env.local'), 'utf8').match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const db = new pg.Client({ connectionString: env, ssl: { rejectUnauthorized: false } });
await db.connect();
const q = async (s, p) => (await db.query(s, p)).rows;

const entregadas = await q(`
  select s.tracking, s.status_at::date::text as entrega, o.cod_amount::float as cod,
         o.order_number, o.customer_name, o.province
  from shipments s join orders o on o.id = s.order_id
  where s.courier = 'urbano' and s.status_canonical = 'entregado' and s.status_at is not null
  order by s.status_at`);
const trabados = await q(`
  select *, (last_move at time zone 'America/Argentina/Buenos_Aires')::date::text as dia_move
  from trabados_list() where courier = 'urbano'`);
// rendidas que nuestro estado no da por entregadas
const raras = await q(`
  select s.tracking, s.status_raw, s.status_canonical, o.cod_amount::float as cod,
         o.order_number, o.province
  from shipments s join orders o on o.id = s.order_id
  where s.courier = 'urbano' and s.status_canonical <> 'entregado' and s.tracking = any($1)`,
  [[...pagada.keys()]]);
await db.end();

// ── 1. conciliación semana por semana: entregado vs rendido ───────────────────────────────────
// El faltante de una semana a la que le falta un formato NO es plata robada: es el archivo que no
// tenemos. Sólo la semana con los DOS formatos permite afirmar que algo no se pagó.
const porGiro = new Map();
for (const e of entregadas) {
  const g = giroDe(e.entrega);
  if (!porGiro.has(g)) porGiro.set(g, { guias: 0, cod: 0, rg: 0, rcod: 0 });
  const x = porGiro.get(g); x.guias++; x.cod += e.cod ?? 0;
}
for (const r of rend) {
  if (reimpresos.has(`${r.fecha}|${r.resumen}`)) continue;
  if (!porGiro.has(r.fecha)) porGiro.set(r.fecha, { guias: 0, cod: 0, rg: 0, rcod: 0 });
  const x = porGiro.get(r.fecha); x.rg++; x.rcod += Number(r.monto);
  if (r.comprobante) (x.comp ??= new Set()).add(r.comprobante);
}
const semanas = [...porGiro].filter(([g]) => g <= HOY).sort();

// ── 2. guías entregadas que no figuran en ningún resumen ──────────────────────────────────────
// Una guía suelta que no aparece NO prueba nada por sí sola: nuestra fecha de entrega y la de
// ellos difieren en un día y la guía cae en la semana de al lado. Sólo se reclama como plata
// faltante si ADEMÁS la semana entera cierra en rojo (nos pagaron menos de lo que entregamos).
// Si la semana cierra en cero o a favor, es deriva de fecha: se pide en qué resumen se pagó.
const debe = (g) => (porGiro.get(g)?.cod ?? 0) - (porGiro.get(g)?.rcod ?? 0);
const sinRendir = entregadas
  .filter((e) => !pagada.has(e.tracking) && martes.has(giroDe(e.entrega)))
  .map((e) => ({ ...e, giro: giroDe(e.entrega), firme: completo(giroDe(e.entrega)) && debe(giroDe(e.entrega)) > 0 }));
const firmes = sinRendir.filter((e) => e.firme);
const deriva = sinRendir.filter((e) => !e.firme && completo(e.giro));
const aConfirmar = sinRendir.filter((e) => !e.firme && !completo(e.giro));
const suma = (xs) => xs.reduce((s, e) => s + (e.cod ?? 0), 0);

// ── 3. ¿se movieron las del reclamo anterior? ─────────────────────────────────────────────────
mkdirSync(DIR, { recursive: true });
const previos = readdirSync(DIR).filter((f) => f.endsWith('.json') && f.slice(0, 10) < HOY).sort();
// código de estado + DÍA del último movimiento: si los dos siguen iguales, la pieza no se tocó.
// Mismo formato que reporta Urbano en su planilla de respuesta (Chk Codigo + fecha CHK), así que
// una respuesta de ellos se puede guardar como snapshot y compararse igual.
const foto = Object.fromEntries(trabados.map((t) => [t.tracking, `${t.status_raw}|${t.dia_move}`]));
let mov = null;
if (previos.length) {
  const ant = JSON.parse(readFileSync(join(DIR, previos.at(-1)), 'utf8'));
  const antF = ant.piezas ?? {};
  mov = {
    desde: previos.at(-1).slice(0, 10),
    quietas: Object.keys(antF).filter((g) => foto[g] === antF[g]),
    movidas: Object.keys(antF).filter((g) => foto[g] !== antF[g]),
    nuevas: Object.keys(foto).filter((g) => !(g in antF)),
  };
}

// ── salida ────────────────────────────────────────────────────────────────────────────────────
console.log(`\n═══ RECLAMO URBANO ${HOY} ═══\n`);
console.log(`① CONCILIACIÓN POR MARTES DE GIRO (entregado vs rendido)`);
console.log(`   ${'giro'.padEnd(11)} ${'formatos'.padEnd(9)} ${'entregas'.padStart(8)} ${'COD entregado'.padStart(14)}` +
            ` ${'rendidas'.padStart(8)} ${'COD rendido'.padStart(14)} ${'diferencia'.padStart(13)}  comprobante`);
for (const [g, x] of semanas) {
  const fmts = martes.get(g) ? [...martes.get(g)].sort().join('+') : '—';
  const marca = !martes.get(g) ? '⛔' : martes.get(g).size === 2 ? '  ' : '⚠️';
  console.log(`${marca} ${g.padEnd(11)} ${fmts.padEnd(9)} ${String(x.guias).padStart(8)} ${$(x.cod).padStart(14)}` +
              ` ${String(x.rg).padStart(8)} ${$(x.rcod).padStart(14)} ${$(x.cod - x.rcod).padStart(13)}` +
              `  ${x.comp ? [...x.comp].join(',') : '—'}`);
}
console.log(`   ⚠️ = falta un formato (A+B es la liquidación completa de la semana) · ⛔ = sin resumen`);

console.log(`\n② GUÍAS ENTREGADAS QUE NO FIGURAN EN NINGÚN RESUMEN`);
console.log(`   plata faltante (la semana además cierra en rojo): ${String(firmes.length).padStart(3)} guías  ${$(suma(firmes))}` +
            (firmes.length ? `  (neto −5,547%: ${$(suma(firmes) * (1 - COMISION))})` : ''));
console.log(`   deriva de fecha (la semana cuadra: pedir en qué resumen se pagaron): ` +
            `${String(deriva.length).padStart(3)} guías  ${$(suma(deriva))}`);
console.log(`   sin poder auditar (falta un formato del resumen): ${String(aConfirmar.length).padStart(3)} guías  ` +
            `${$(suma(aConfirmar))} — martes ${[...new Set(aConfirmar.map((e) => e.giro))].join(', ')}`);
for (const e of firmes)
  console.log(`     ⛔ ${e.tracking}  entregada ${e.entrega}  giro ${e.giro}  ${$(e.cod ?? 0).padStart(10)}` +
              `  #${e.order_number} ${e.customer_name} (${e.province})`);

// Una trabada que ya figura en un resumen NO es una trabada: se entregó, la cobramos, y lo único
// roto es nuestro estado. Reclamarla sería pedir por algo que ya nos pagaron.
const trabadasCobradas = trabados.filter((t) => pagada.has(t.tracking));
const trabadasReales = trabados.filter((t) => !pagada.has(t.tracking));

console.log(`\n③ PIEZAS TRABADAS HOY: ${trabadasReales.length} · ${$(suma(trabadasReales.map((t) => ({ cod: +t.cod_amount }))))}` +
            (trabadasCobradas.length
              ? `   (+${trabadasCobradas.length} que figuran trabadas pero YA COBRAMOS — no se reclaman, se corrige el estado)`
              : ''));
for (const t of trabadasCobradas)
  console.log(`     ✓ ${t.tracking} ${t.status_raw} ${t.dias}d · ${$(+t.cod_amount)} · rendida ${pagada.get(t.tracking)} · #${t.order_number} (${t.province})`);
if (mov) {
  console.log(`   vs reclamo del ${mov.desde}:  se movieron ${mov.movidas.length}  ·  ` +
              `SIGUEN CLAVADAS ${mov.quietas.length}  ·  nuevas ${mov.nuevas.length}`);
  for (const g of mov.quietas) {
    const t = trabadasReales.find((x) => x.tracking === g);
    if (t) console.log(`     ⛔ ${g} ${t.status_raw} ${t.dias}d sin moverse · ${$(+t.cod_amount)} · ` +
                       `#${t.order_number} ${t.customer_name} (${t.province}) — ESCALAR`);
  }
} else console.log(`   (primer reclamo registrado — desde la próxima corrida se ve qué se movió)`);

console.log(`\n④ RENDIDAS QUE NUESTRO ESTADO NO DA POR ENTREGADAS: ${raras.length} · ${$(suma(raras))}`);
for (const r of raras)
  console.log(`     ${r.tracking}  pagada ${pagada.get(r.tracking)}  pero figura ${r.status_raw}/${r.status_canonical}` +
              `  ${$(r.cod ?? 0)}  #${r.order_number} (${r.province})`);

const filas = [
  ['bloque', 'guia', 'pedido', 'cliente', 'provincia', 'cod', 'fecha', 'estado', 'detalle'],
  ...firmes.map((e) => ['NO RENDIDA (semana en rojo)', e.tracking, e.order_number, e.customer_name, e.province, e.cod, e.entrega, 'entregada', `giro esperado ${e.giro}`]),
  ...deriva.map((e) => ['NO FIGURA EN NINGÚN RESUMEN', e.tracking, e.order_number, e.customer_name, e.province, e.cod, e.entrega, 'entregada', `giro esperado ${e.giro} — pedir en qué resumen se pagó`]),
  ...aConfirmar.map((e) => ['SIN AUDITAR (falta formato A)', e.tracking, e.order_number, e.customer_name, e.province, e.cod, e.entrega, 'entregada', `giro esperado ${e.giro}`]),
  ...trabadasReales.map((t) => ['TRABADA', t.tracking, t.order_number, t.customer_name, t.province, t.cod_amount, String(t.dispatched_at).slice(0, 10), t.status_raw, `${t.dias} días sin movimiento`]),
  ...raras.map((r) => ['ESTADO EN CONFLICTO', r.tracking, r.order_number, '', r.province, r.cod, pagada.get(r.tracking), r.status_raw, 'rendida pero no figura entregada']),
];
const csvOut = filas.map((f) => f.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
if (!dry) {
  writeFileSync(join(DIR, `${HOY}-urbano.csv`), '﻿' + csvOut);
  writeFileSync(join(DIR, `${HOY}.json`), JSON.stringify({
    fecha: HOY, piezas: foto,
    plata: { faltante: suma(firmes), deriva: suma(deriva), sin_auditar: suma(aConfirmar) },
  }, null, 1));
  console.log(`\n→ datos/reclamos/${HOY}-urbano.csv  (${filas.length - 1} filas para mandar)`);
} else console.log('\n(--dry: no escribí nada)');

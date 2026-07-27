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

// ── 1. plata entregada y nunca rendida ────────────────────────────────────────────────────────
const sinRendir = entregadas
  .filter((e) => !pagada.has(e.tracking) && martes.has(giroDe(e.entrega)))
  .map((e) => ({ ...e, giro: giroDe(e.entrega), firme: completo(giroDe(e.entrega)) }));
const firmes = sinRendir.filter((e) => e.firme);
const aConfirmar = sinRendir.filter((e) => !e.firme);
const suma = (xs) => xs.reduce((s, e) => s + (e.cod ?? 0), 0);

// ── 2. semanas sin resumen: no es faltante probado, es visibilidad que no tenemos ─────────────
const porGiro = new Map();
for (const e of entregadas) {
  const g = giroDe(e.entrega);
  if (!porGiro.has(g)) porGiro.set(g, { guias: 0, cod: 0 });
  const x = porGiro.get(g); x.guias++; x.cod += e.cod ?? 0;
}
const sinResumen = [...porGiro].filter(([g]) => !martes.has(g) && g <= HOY).sort();

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
console.log(`① PLATA ENTREGADA Y NUNCA RENDIDA (contra los resúmenes que tenemos)`);
console.log(`   firme:        ${String(firmes.length).padStart(3)} guías  ${$(suma(firmes))}  ` +
            `(neto −5,547%: ${$(suma(firmes) * (1 - COMISION))})`);
console.log(`   a confirmar:  ${String(aConfirmar.length).padStart(3)} guías  ${$(suma(aConfirmar))}  ` +
            `— falta un formato del resumen de ${[...new Set(aConfirmar.map((e) => e.giro))].join(', ')}`);
for (const e of firmes)
  console.log(`     ${e.tracking}  entregada ${e.entrega}  giro ${e.giro}  ${$(e.cod ?? 0).padStart(10)}` +
              `  #${e.order_number} ${e.customer_name} (${e.province})`);

console.log(`\n② SEMANAS SIN RESUMEN (pedirlos: sin el archivo no hay forma de auditar)`);
for (const [g, x] of sinResumen)
  console.log(`   giro ${g}: ${String(x.guias).padStart(4)} entregas · ${$(x.cod).padStart(13)} de COD` +
              ` · neto esperado ${$(x.cod * (1 - COMISION))}`);
console.log(`   TOTAL sin auditar: ${$(sinResumen.reduce((s, [, x]) => s + x.cod, 0))}`);

console.log(`\n③ PIEZAS TRABADAS HOY: ${trabados.length} · ${$(suma(trabados.map((t) => ({ cod: +t.cod_amount }))))}`);
if (mov) {
  console.log(`   vs reclamo del ${mov.desde}:  se movieron ${mov.movidas.length}  ·  ` +
              `SIGUEN CLAVADAS ${mov.quietas.length}  ·  nuevas ${mov.nuevas.length}`);
  for (const g of mov.quietas) {
    const t = trabados.find((x) => x.tracking === g);
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
  ...firmes.map((e) => ['NO RENDIDA', e.tracking, e.order_number, e.customer_name, e.province, e.cod, e.entrega, 'entregada', `giro esperado ${e.giro}`]),
  ...aConfirmar.map((e) => ['NO RENDIDA (a confirmar)', e.tracking, e.order_number, e.customer_name, e.province, e.cod, e.entrega, 'entregada', `giro esperado ${e.giro}`]),
  ...trabados.map((t) => ['TRABADA', t.tracking, t.order_number, t.customer_name, t.province, t.cod_amount, String(t.dispatched_at).slice(0, 10), t.status_raw, `${t.dias} días sin movimiento`]),
  ...raras.map((r) => ['ESTADO EN CONFLICTO', r.tracking, r.order_number, '', r.province, r.cod, pagada.get(r.tracking), r.status_raw, 'rendida pero no figura entregada']),
];
const csvOut = filas.map((f) => f.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
if (!dry) {
  writeFileSync(join(DIR, `${HOY}-urbano.csv`), '﻿' + csvOut);
  writeFileSync(join(DIR, `${HOY}.json`), JSON.stringify({
    fecha: HOY, piezas: foto,
    plata: { firme: suma(firmes), a_confirmar: suma(aConfirmar), sin_resumen: sinResumen.reduce((s, [, x]) => s + x.cod, 0) },
  }, null, 1));
  console.log(`\n→ datos/reclamos/${HOY}-urbano.csv  (${filas.length - 1} filas para mandar)`);
} else console.log('\n(--dry: no escribí nada)');

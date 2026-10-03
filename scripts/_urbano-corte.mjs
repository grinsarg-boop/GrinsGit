// Medición del corte de la ventana de liquidación de Urbano, CON HORA.
// El WS sí devuelve `hora` por movimiento (lo que la migr 033 daba por imposible); el parser de
// lib/couriers/urbano.ts la descarta. Acá se la pide en crudo para las guías que ya sabemos que
// Urbano pagó (urbano_rendiciones, vale) y se cruza el instante de entrega contra el martes que
// las liquidó. Salida: datos/urbano_corte.json (una fila por guía).
import pg from 'pg';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n')
  .filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=')+1).trim()]));
const U = { url: env.URBANO_API_URL.replace(/\/$/, ''), shipper: Number(env.URBANO_SHIPPER), pass: env.URBANO_PASSWORD };

const c = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows } = await c.query(`
  select guia, min(fecha_pago)::text as pago
  from urbano_rendiciones where vale group by guia order by 1`);
await c.end();
console.error(`guías pagadas: ${rows.length}`);

const ENTREGA = new Set(['DL', 'EI', 'RA']);
const ENTREGA2 = ENTREGA;
const lotes = [];
for (let i = 0; i < rows.length; i += 100) lotes.push(rows.slice(i, i + 100));

async function pedir(lote, intento = 0) {
  try {
    const r = await (await fetch(`${U.url}/tracking/consultaTrackingMasivo/`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ autentificacion: { shipper: U.shipper, password: U.pass },
        datos: lote.map(p => ({ codigoSeguimiento: p.guia })) }),
    })).json();
    if (!Array.isArray(r)) throw new Error('respuesta no-array');
    return r;
  } catch (e) {
    if (intento >= 3) throw e;
    return pedir(lote, intento + 1);
  }
}

const out = [];
let hechos = 0;
const CONC = 6;
await Promise.all(Array.from({ length: CONC }, async (_, w) => {
  for (let i = w; i < lotes.length; i += CONC) {
    const lote = lotes[i];
    const r = await pedir(lote);
    const pago = new Map(lote.map(p => [p.guia, p.pago]));
    for (const x of r) {
      const g = String(x.codGestion ?? '');
      const movs = (x.movimientos ?? []).filter(m => m.checkFecha);
      const ent = movs.filter(m => ENTREGA2.has((m.check ?? '').toUpperCase()))
        .sort((a, b) => stamp(a) - stamp(b))[0];
      out.push({ guia: g, pago: pago.get(g) ?? null, err: x.codError,
        check: ent?.check ?? null, fecha: ent?.checkFecha ?? null, hora: ent?.hora ?? null });
    }
    console.error(`${++hechos}/${lotes.length} lotes`);
  }
}));

function stamp(m) {
  const [d, mo, y] = m.checkFecha.split('-');
  return Date.parse(`${y}-${mo}-${d}T${(m.hora ?? '00:00')}:00Z`);
}
process.stdout.write(JSON.stringify(out));

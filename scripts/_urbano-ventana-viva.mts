// Entregas de la ventana de liquidación de Urbano (martes → lunes) leídas EN VIVO del WS, para
// estimar el giro del martes sin depender del lag del sync. Solo lectura.
//   node --env-file=.env.local --import tsx scripts/_urbano-ventana-viva.mts [--ini 2026-09-15]
import pg from "pg";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const INI = arg("ini", "2026-09-15"); // martes
const FIN = new Date(Date.parse(INI) + 6 * 864e5).toISOString().slice(0, 10); // lunes
const U = { url: process.env.URBANO_API_URL!.replace(/\/$/, ""), shipper: Number(process.env.URBANO_SHIPPER), pass: process.env.URBANO_PASSWORD };
const ENTREGA = new Set(["DL", "EI", "RA", "ENTREGADO"]);
const iso = (f: string) => `${f.slice(6, 10)}-${f.slice(3, 5)}-${f.slice(0, 2)}`; // dd-mm-yyyy → iso

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const { rows } = await db.query(
  `select s.tracking, s.status_canonical, coalesce(o.cod_amount,0)::float as cod,
          (s.status_at at time zone 'America/Argentina/Buenos_Aires')::date::text as dia_base
     from shipments s left join orders o on o.id = s.order_id
    where s.courier = 'urbano' and s.tracking like 'BLABS%' and s.dispatched_at >= '2026-08-01'
      and (s.resolved_at is null or (s.status_canonical = 'entregado' and s.status_at >= $1::date))
      and s.status_canonical not in ('devuelto','en_devolucion','siniestro','rehusado')`,
  [INI],
);
await db.end();
console.error(`guías a consultar: ${rows.length}`);

const vivo = new Map<string, string>(); // tracking → día de entrega (iso)
for (let i = 0; i < rows.length; i += 100) {
  const lote = rows.slice(i, i + 100);
  const r = await (await fetch(`${U.url}/tracking/consultaTrackingMasivo/`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ autentificacion: { shipper: U.shipper, password: U.pass }, datos: lote.map((f) => ({ codigoSeguimiento: f.tracking })) }),
    signal: AbortSignal.timeout(120_000),
  })).json();
  for (const x of r) {
    const ent = (x.movimientos ?? []).find((m: any) => ENTREGA.has((m.check ?? "").toUpperCase().trim()) && m.checkFecha);
    if (ent) vivo.set(x.codGestion, iso(ent.checkFecha));
  }
  process.stderr.write(`\r  ${Math.min(i + 100, rows.length)}/${rows.length}`);
}
console.error();

const porDia: Record<string, { n: number; cod: number; nuevas: number; codNuevas: number }> = {};
for (const f of rows) {
  const d = vivo.get(f.tracking);
  if (!d || d < INI || d > FIN) continue;
  const k = (porDia[d] ??= { n: 0, cod: 0, nuevas: 0, codNuevas: 0 });
  k.n++; k.cod += f.cod;
  if (f.status_canonical !== "entregado") { k.nuevas++; k.codNuevas += f.cod; }
}
const rate = 0.05418; // 4,3% × 1,26 desde el giro del 08/09/2026
let N = 0, C = 0, NN = 0, CN = 0;
console.log(`Ventana ${INI} → ${FIN} (entregas según WS en vivo):`);
for (const d of Object.keys(porDia).sort()) {
  const k = porDia[d]; N += k.n; C += k.cod; NN += k.nuevas; CN += k.codNuevas;
  console.log(`  ${d}  ${String(k.n).padStart(4)} guías  $${k.cod.toLocaleString("es-AR")}   (no estaban entregadas en la base: ${k.nuevas} · $${k.codNuevas.toLocaleString("es-AR")})`);
}
console.log(`  TOTAL ${N} guías · bruto $${C.toLocaleString("es-AR")} · comisión 5,418% $${(C * rate).toLocaleString("es-AR")} · NETO $${(C * (1 - rate)).toLocaleString("es-AR")}`);
console.log(`  de eso, el sync todavía no tenía: ${NN} guías · $${CN.toLocaleString("es-AR")}`);
// Entregas fuera de la ventana que la base creía adentro (por si el sync fechó mal)
const fuera = rows.filter((f) => f.status_canonical === "entregado" && f.dia_base >= INI && f.dia_base <= FIN && vivo.get(f.tracking) && (vivo.get(f.tracking)! < INI || vivo.get(f.tracking)! > FIN));
if (fuera.length) console.log(`  ⚠️ ${fuera.length} guías que la base fecha en la ventana pero el WS fecha afuera`);

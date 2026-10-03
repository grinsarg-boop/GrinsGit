// ¿Cuántas guías de Urbano tienen alta pero Urbano todavía no las recibió (solo evento PI)?
// Base (qué guías abiertas hay) → Urbano en vivo (movimientos) → Veltron en vivo (estado del pedido).
// Solo lectura. Detalle a ~/Downloads/urbano-sin-ingreso-<fecha>.csv.
//
//   node --env-file=.env.local --import tsx scripts/_urbano-sin-ingreso.mts [--desde 2026-09-01]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { productoCode } from "../lib/correo.ts";
import { matchProduct } from "../lib/product-match.ts";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const DESDE = arg("desde", "2026-09-01");
const U = { url: process.env.URBANO_API_URL!.replace(/\/$/, ""), shipper: Number(process.env.URBANO_SHIPPER), pass: process.env.URBANO_PASSWORD };
const VB = "https://ecomdash-board-platform-production.up.railway.app";
const TENANT = process.env.VELTRON_TENANT_ID ?? "ceca9834-e837-4f96-82a7-8b8edc689dd9";
const ordenDe = (g: string) => g.replace(/^BLABS/, "").replace(/R\d+$/, "");

// ---- 1. base: guías Urbano abiertas
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const { rows } = await db.query(
  `select s.tracking, s.status_raw, o.order_number, o.cod_amount, o.province,
          (select sum(oi.pack) from order_items oi where oi.order_id = o.id) as unidades,
          (select string_agg(distinct oi.title_raw, ' + ') from order_items oi where oi.order_id = o.id) as producto
     from shipments s left join orders o on o.id = s.order_id
    where s.courier = 'urbano' and s.tracking like 'BLABS%' and s.resolved_at is null and s.dispatched_at >= $1`,
  [DESDE],
);
await db.end();
type Fila = typeof rows[number] & { pi?: string; hora?: string; vel?: string; code?: string | null };
const filas: Fila[] = rows;

// ---- 2. Urbano en vivo: solo PI = sin ingreso
const soloPI = new Map<string, { fecha: string; hora: string }>();
let movieron = 0, noExisten = 0;
for (let i = 0; i < filas.length; i += 100) {
  const lote = filas.slice(i, i + 100);
  const r = await (await fetch(`${U.url}/tracking/consultaTrackingMasivo/`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ autentificacion: { shipper: U.shipper, password: U.pass }, datos: lote.map((f) => ({ codigoSeguimiento: f.tracking })) }),
    signal: AbortSignal.timeout(90_000),
  })).json();
  for (const x of r) {
    const movs = (x.movimientos ?? []).filter((m: any) => m.checkFecha);
    if (x.codError !== 0 || !movs.length) { noExisten++; continue; }
    if (movs.every((m: any) => (m.check ?? "").toUpperCase() === "PI")) soloPI.set(x.codGestion, { fecha: movs[0].checkFecha, hora: movs[0].hora ?? "" });
    else movieron++;
  }
  process.stdout.write(`\r  urbano ${Math.min(i + 100, filas.length)}/${filas.length}`);
}
console.log();

// ---- 3. Veltron en vivo: estado del pedido (REST, misma vk_ del MCP)
const vel = new Map<string, string>(); // order_number → estado
for (const estado of ["confirmado", "preparando", "despachado"]) {
  for (let page = 1, paginas = 1; page <= paginas && page <= 30; page++) {
    const q = `estado=${estado}&carrier=urbano&preset=custom&desde=${DESDE}&hasta=${new Date().toISOString().slice(0, 10)}&page=${page}&page_size=100`;
    const r = await (await fetch(`${VB}/api/v1/tenant/${TENANT}/pedidos?${q}`, { headers: { authorization: `Bearer ${process.env.VELTRON_API_KEY}` }, signal: AbortSignal.timeout(60_000) })).json();
    paginas = Number(r.paginas ?? 1);
    for (const p of r.pedidos ?? []) if (p.shopify_order_number) vel.set(String(p.shopify_order_number), p.estado);
  }
}

// ---- 4. cuadro
const pend = filas.filter((f) => soloPI.has(f.tracking));
for (const f of pend) {
  const m = soloPI.get(f.tracking)!;
  f.pi = m.fecha; f.hora = m.hora;
  f.vel = vel.get(ordenDe(f.tracking)) ?? "no está / otro estado";
  const prod = matchProduct(String(f.producto ?? ""));
  f.code = prod && Number(f.unidades) ? productoCode({ producto: prod, qty: Number(f.unidades) }) : null;
}
const sum = (xs: Fila[]) => ({ pedidos: xs.length, unidades: xs.reduce((a, f) => a + (Number(f.unidades) || 0), 0), cod: xs.reduce((a, f) => a + (Number(f.cod_amount) || 0), 0) });
const fmt = (s: ReturnType<typeof sum>) => `${String(s.pedidos).padStart(4)} pedidos · ${String(s.unidades).padStart(4)} u · COD $${(s.cod / 1e6).toFixed(2)}M`;

console.log(`\nBase: ${filas.length} guías Urbano abiertas desde ${DESDE} · movieron ${movieron} · no existen/sin movs ${noExisten}`);
console.log(`SIN INGRESO (solo PI): ${fmt(sum(pend))}`);
const by = <K extends string>(k: (f: Fila) => K) => Object.entries(pend.reduce((m, f) => ((m[k(f)] ??= []).push(f), m), {} as Record<string, Fila[]>)).sort();
console.log("\nPor fecha de alta (PI) × estado en Veltron:");
for (const [fecha, xs] of by((f) => f.pi!)) {
  console.log(`  ${fecha}  ${fmt(sum(xs))}`);
  for (const [v, ys] of by((f) => f.vel!).filter(([, ys]) => ys.some((y) => y.pi === fecha))) {
    const zs = ys.filter((y) => y.pi === fecha); if (zs.length) console.log(`      veltron ${v.padEnd(22)} ${fmt(sum(zs))}`);
  }
}
console.log("\nPor código de depósito (producto+unidades):");
for (const [c, xs] of by((f) => f.code ?? "?")) console.log(`  ${c.padEnd(4)} ${fmt(sum(xs))}`);
console.log("\nUnidades por producto:");
for (const [p, xs] of by((f) => matchProduct(String(f.producto ?? "")) ?? "?")) console.log(`  ${p.padEnd(10)} ${fmt(sum(xs))}`);

const out = path.join(os.homedir(), "Downloads", `urbano-sin-ingreso-${new Date().toISOString().slice(0, 10)}.csv`);
fs.writeFileSync(out, ["guia,pedido,alta_pi,hora,veltron,code,unidades,producto,cod,provincia",
  ...pend.sort((a, b) => (a.pi! + a.hora!).localeCompare(b.pi! + b.hora!)).map((f) => [f.tracking, f.order_number ?? "", f.pi, f.hora, f.vel, f.code ?? "", f.unidades ?? "", JSON.stringify(f.producto ?? ""), f.cod_amount ?? "", f.province ?? ""].join(","))].join("\n"));
console.log(`\ndetalle → ${out}`);

// Pre-vuelo del alta COD: cancelados / a cancelar / duplicados. Sólo lectura (Shopify + base).
// Uso: npx tsx scripts/chequeo-dup-cancel.mts .despacho-propuesta.json  → escribe chequeo-excluir.json al lado
import fs from "node:fs";
import pg from "pg";
import { shopifyFetch, SHOPIFY_API_VERSION } from "../lib/shopify.ts";

const prop = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const lote: { carrier: string; order: string; pedido_id: number }[] = [];
for (const [carrier, arr] of Object.entries<any[]>(prop.lote)) for (const o of arr) lote.push({ carrier, order: String(o.order_number), pedido_id: o.pedido_id });

// Shopify: todo lo creado en los últimos 21 días, para ver hermanos del mismo cliente.
const desde = new Date(Date.now() - 21 * 86_400_000).toISOString();
const fields = "id,name,order_number,created_at,cancelled_at,cancel_reason,tags,note,financial_status,fulfillment_status,phone,email,customer,shipping_address,line_items";
let url: string | null = `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250&created_at_min=${desde}&fields=${fields}`;
const orders: any[] = [];
while (url) {
  const r = await shopifyFetch(url);
  if (!r.ok) throw new Error(`Shopify ${r.status}: ${(await r.text()).slice(0, 200)}`);
  orders.push(...(await r.json()).orders);
  url = /<([^>]+)>;\s*rel="next"/.exec(r.headers.get("link") ?? "")?.[1] ?? null;
}
const byNum = new Map(orders.map((o) => [String(o.order_number), o]));

const tel = (o: any) => String(o.shipping_address?.phone ?? o.phone ?? o.customer?.phone ?? "").replace(/\D/g, "").slice(-8) || null;
const quien = (o: any) => {
  const a = o.shipping_address ?? {};
  return `${String(a.name ?? "").toLowerCase().replace(/\s+/g, " ").trim()}|${String(a.zip ?? "").replace(/\D/g, "")}`;
};
const items = (o: any) => (o.line_items ?? []).map((l: any) => `${l.title}×${l.quantity}`).sort().join(" + ");
const RX_CANCEL = /cancel|anular|anulad|no enviar|no despachar|devolver plata|reembols/i;
// Pidieron anular por el formulario web y mail-clientes.mjs no los canceló (no cumplían su regla). La nota que
// deja ese agente es de Veltron y no llega a Shopify, así que RX_CANCEL no la ve: va por este archivo.
const ANULAR = new URL("../etiquetas/.mail-clientes-anular.json", import.meta.url);
const pideAnular: Record<string, { fecha: string; texto: string }> = fs.existsSync(ANULAR) ? JSON.parse(fs.readFileSync(ANULAR, "utf8")) : {};

// Base: qué hermanos ya tienen guía (y en qué estado).
const numsHermanos = orders.map((o) => String(o.order_number));
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const { rows } = await db.query(
  `select o.order_number, s.tracking, s.courier, s.dispatched_at::date as despachada, s.status_canonical
     from orders o join shipments s on s.order_id = o.id where o.order_number = any($1)`, [numsHermanos]);
await db.end();
const guiaDe = new Map<string, any[]>();
for (const r of rows) guiaDe.set(r.order_number, [...(guiaDe.get(r.order_number) ?? []), r]);

const excluir: { order: string; carrier: string; motivo: string }[] = [];
const revisar: { order: string; carrier: string; motivo: string }[] = [];
const enLote = new Set(lote.map((l) => l.order));

// 1) mismo nº de orden dos veces en el lote
const vistos = new Map<string, string>();
for (const l of lote) {
  if (vistos.has(l.order)) excluir.push({ order: l.order, carrier: l.carrier, motivo: `repetido en el lote (ya va por ${vistos.get(l.order)})` });
  else vistos.set(l.order, l.carrier);
}

for (const l of lote) {
  const o = byNum.get(l.order);
  if (!o) { revisar.push({ order: l.order, carrier: l.carrier, motivo: "no aparece en Shopify (últimos 21 días)" }); continue; }
  // 2) cancelado / a cancelar
  if (o.cancelled_at) { excluir.push({ order: l.order, carrier: l.carrier, motivo: `CANCELADO en Shopify ${o.cancelled_at.slice(0, 10)} (${o.cancel_reason ?? "?"})` }); continue; }
  if (["voided", "refunded"].includes(o.financial_status)) { excluir.push({ order: l.order, carrier: l.carrier, motivo: `financial_status=${o.financial_status}` }); continue; }
  const txt = `${o.tags ?? ""} ${o.note ?? ""}`;
  if (RX_CANCEL.test(txt)) { excluir.push({ order: l.order, carrier: l.carrier, motivo: `a cancelar: "${txt.trim().slice(0, 90)}"` }); continue; }
  const pa = pideAnular[l.order];
  if (pa) { excluir.push({ order: l.order, carrier: l.carrier, motivo: `pidió anular por el formulario web el ${pa.fecha.slice(0, 10)}: "${pa.texto}" (si va igual, sacarlo de etiquetas/.mail-clientes-anular.json)` }); continue; }

  // 3) duplicado: mismo cliente (teléfono o nombre+CP) con otra orden viva en 21 días
  const t = tel(o), q = quien(o);
  const hermanos = orders.filter((h) => h.order_number !== o.order_number && !h.cancelled_at && ((t && tel(h) === t) || quien(h) === q));
  for (const h of hermanos) {
    const hn = String(h.order_number);
    const mismos = items(h) === items(o);
    const horas = Math.abs(Date.parse(o.created_at) - Date.parse(h.created_at)) / 3_600_000;
    const guias = (guiaDe.get(hn) ?? []).filter((g) => !/devuel|cancel/i.test(String(g.status_canonical ?? "")));
    const desc = `#${hn} (${h.created_at.slice(0, 10)}, ${items(h)})`;
    if (guias.length && mismos && horas <= 96) {
      excluir.push({ order: l.order, carrier: l.carrier, motivo: `duplicado de ${desc}, que ya salió con ${guias.map((g) => g.tracking).join("/")} [${guias[0].status_canonical}]` });
    } else if (enLote.has(hn) && mismos && horas <= 96 && Number(hn) < Number(l.order)) {
      excluir.push({ order: l.order, carrier: l.carrier, motivo: `duplicado de ${desc}, que también va en este lote (se manda la primera)` });
    } else if (horas <= 96) {
      revisar.push({ order: l.order, carrier: l.carrier, motivo: `mismo cliente que ${desc}${guias.length ? `, con guía ${guias[0].tracking} [${guias[0].status_canonical}]` : enLote.has(hn) ? ", también en el lote" : ""}${mismos ? "" : " — productos distintos"}` });
    }
  }
}

const dedup = (a: typeof excluir) => [...new Map(a.map((x) => [x.order, x])).values()];
const ex = dedup(excluir), exSet = new Set(ex.map((x) => x.order));
const rv = revisar.filter((x) => !exSet.has(x.order));
console.log(`Lote: ${lote.length} · Shopify leídas: ${orders.length}`);
console.log(`\nEXCLUIR (${ex.length}):`); for (const x of ex) console.log(`  #${x.order} ${x.carrier}: ${x.motivo}`);
console.log(`\nREVISAR, se dan de alta igual (${rv.length}):`); for (const x of rv) console.log(`  #${x.order} ${x.carrier}: ${x.motivo}`);
fs.writeFileSync(process.argv[2].replace(/[^/]+$/, "chequeo-excluir.json"), JSON.stringify(ex.map((x) => ({ carrier: x.carrier, order: x.order, pedido_id: lote.find((l) => l.order === x.order && l.carrier === x.carrier)?.pedido_id, motivo: x.motivo })), null, 1));

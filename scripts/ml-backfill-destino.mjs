// Backfill de dest_cp/province en ml_orders. El fix de enrichMlShipments solo cubre las órdenes
// NUEVAS (el enrich corre una vez por orden, cuando ship_type está en null). Las viejas ya pasaron
// por ahí, así que su destino hay que ir a buscarlo: 1 fetch de /shipments por orden.
// Sin esto no hay línea de base para medir Flex (AMBA) contra el interior.
// Uso: node scripts/ml-backfill-destino.mjs [limite]   ·   sin límite hace todas.
import { TOKEN, sql } from './_ml.mjs';

const LIMITE = Number(process.argv[2] ?? 0) || null;
const CONC = 8;

const pend = await sql(`
  select ml_id, shipment_id from ml_orders
  where shipment_id is not null and (dest_cp is null or province is null)
  order by created_at desc ${LIMITE ? `limit ${LIMITE}` : ''}`);
console.log(`pendientes: ${pend.length}`);

let ok = 0, sinDato = 0, err = 0;
for (let i = 0; i < pend.length; i += CONC) {
  await Promise.all(pend.slice(i, i + CONC).map(async (r) => {
    try {
      const res = await fetch(`https://api.mercadolibre.com/shipments/${r.shipment_id}`,
        { headers: { authorization: `Bearer ${TOKEN}` } });
      if (!res.ok) { err++; return; }
      const a = (await res.json())?.receiver_address ?? {};
      const cp = String(a.zip_code ?? '').replace(/\D/g, '').slice(0, 4);
      const prov = a.state?.name ?? null;
      if (!cp && !prov) { sinDato++; return; }
      const sets = [];
      if (cp) sets.push(`dest_cp='${cp}'`);
      if (prov) sets.push(`province=${"'" + String(prov).replace(/'/g, "''") + "'"}`);
      await sql(`update ml_orders set ${sets.join(', ')} where ml_id='${r.ml_id}'`);
      ok++;
    } catch { err++; }
  }));
  if ((i / CONC) % 25 === 0) console.log(`  ${i + CONC}/${pend.length} · ok ${ok} · sin dato ${sinDato} · err ${err}`);
}
console.log(`listo — actualizadas ${ok}, sin dato ${sinDato}, errores ${err}`);

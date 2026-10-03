import { ml } from './_ml.mjs';
const NUESTROS = new Set(['MLA3692036796','MLA1830076567','MLA2055177767','MLA3030316544','MLA1908275639','MLA1796574071']);
for (const [pid,tag] of [['MLA70304457','FICHA x2'],['MLA77148723','FICHA x3']]) {
  const { body } = await ml(`/products/${pid}/items`, { limit: 20 });
  console.log(`\n=== ${tag} ${pid} — ${body.paging?.total} competidores`);
  for (const r of body.results ?? []) {
    const envio = r.shipping?.free_shipping ? 'gratis' : `+$${Math.round(r.shipping?.cost ?? 0)}`;
    const final = r.shipping?.free_shipping ? r.price : r.price + (r.shipping?.cost ?? 0);
    console.log(`${NUESTROS.has(r.item_id)?'>>> ':'    '}${r.item_id} | $${String(r.price).padStart(7)} | envio ${envio.padEnd(8)} | final $${Math.round(final).toString().padStart(7)} | ${r.listing_type_id.padEnd(12)} | seller ${r.seller_id} | tags ${r.tags.join(',')}`);
  }
}

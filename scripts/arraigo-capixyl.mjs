// Agrega el Capixyl al bloque LA FÓRMULA de las 3 publicaciones de ARRAIGO en ML, como composición (no claim).
// Copy del "0,5% vs 3%" = el aprobado en la landing de Shopify. Dry-run por defecto; APLICAR=1 escribe.
import { TOKEN, ml } from './_ml.mjs';

const APLICAR = process.env.APLICAR === '1';
const ITEMS = ['MLA1972685043', 'MLA1972685049', 'MLA1972664973'];
const BLOQUE = `LA FÓRMULA — TRES ACTIVOS
· Aceite de romero — el corazón de la fórmula.
· Cafeína — el activo que acompaña el masaje diario sobre el cuero cabelludo.
· Capixyl™ al 3% — péptido (acetyl tetrapeptide-3) con extracto de trébol rojo. La mayoría lo pone al 0,5% para poder nombrarlo en la etiqueta; acá está al 3%.`;

for (const id of ITEMS) {
  const { body: d } = await ml(`/items/${id}/description`);
  const antes = d.plain_text ?? '';
  if (antes.includes('Capixyl')) { console.log(`${id}: ya tiene Capixyl, salto`); continue; }
  // ponytail: replace con función — con string, un $ en el reemplazo se come el texto (memoria del repo).
  const desp = antes.replace(/LA FÓRMULA\n[\s\S]*?(?=\n\nSIN MINOXIDIL)/, () => BLOQUE);
  if (desp === antes) { console.log(`${id}: no encontré el bloque LA FÓRMULA, salto`); continue; }
  console.log(`${id}: ${antes.length} -> ${desp.length} chars`);
  if (!APLICAR) continue;
  const r = await fetch(`https://api.mercadolibre.com/items/${id}/description`, {
    method: 'PUT', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ plain_text: desp }),
  });
  console.log(`  PUT ${r.status}`);
}

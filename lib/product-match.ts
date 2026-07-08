// Espejo TS de match_product en 002_rpcs.sql (la versión SQL es la canónica para orders y ads —
// mantener sincronizados). Testeado en product-match.test.ts (R2).
// (matchPack murió en 006: el pack es el `quantity` de Shopify, no un regex sobre el título.)

const PRODUCT_KEYWORDS: [string, string][] = [
  ["nature", "Natures"],
  ["pureza", "Pureza"],
  ["vein", "Veinguard"],
  ["bee", "BeeVenom"],
  ["altus", "Altus"],
];

export function matchProduct(text: string): string | null {
  const t = text.toLowerCase();
  for (const [kw, name] of PRODUCT_KEYWORDS) if (t.includes(kw)) return name;
  return null;
}

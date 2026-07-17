// Espejo TS de match_product en 002_rpcs.sql (la versión SQL es la canónica para orders y ads —
// mantener sincronizados). Testeado en product-match.test.ts (R2).
// (matchPack murió en 006: el pack es el `quantity` de Shopify, no un regex sobre el título.)

const PRODUCT_KEYWORDS: [string, string][] = [
  ["nature", "Natures"],
  ["pureza", "Pureza"],
  ["vein", "Veinguard"],
  ["bee", "BeeVenom"],
  ["altus", "Altus"],
  // Revival Oil: se vende SOLO por MercadoLibre → nunca llega a orders/ads de
  // Shopify, por eso no está en la versión SQL. Acá lo necesita el lector de
  // etiquetas ML/Flex (/picking) para no marcarlo "sin producto".
  ["revival", "Revival Oil"],
  // M3 (Aceite Reafirmante Anti-celulítico): Shopify + ML. En SQL también (027).
  ["reafirmante", "M3"],
];

export function matchProduct(text: string): string | null {
  const t = text.toLowerCase();
  for (const [kw, name] of PRODUCT_KEYWORDS) if (t.includes(kw)) return name;
  return null;
}

// Todos los productos distintos presentes en el texto (para detectar etiquetas mixtas de ML).
export function matchAllProducts(text: string): string[] {
  const t = text.toLowerCase();
  return [...new Set(PRODUCT_KEYWORDS.filter(([kw]) => t.includes(kw)).map(([, name]) => name))];
}

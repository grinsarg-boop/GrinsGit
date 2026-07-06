// Espejo TS de match_product / match_pack en 002_rpcs.sql (la versión SQL es la canónica
// para orders y ads — mantener sincronizados). Testeado en product-match.test.ts (R2).

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

export function matchPack(text: string): number {
  const m = /x\s*(\d)/i.exec(text) ?? /(\d)\s*(unid|frascos?|pack|u\b)/i.exec(text);
  return m ? parseInt(m[1], 10) : 1;
}

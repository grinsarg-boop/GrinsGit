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
  // Arraigo (Sérum Anticaída de Romero): vende por COD desde el 05/08/2026 y no estaba en ningún
  // lado — las etiquetas salían "sin producto reconocido".
  // La keyword es la MARCA, no "romero": matchAllProducts corre sobre el texto entero de la
  // etiqueta de ML, que incluye el nombre del destinatario, y Romero es un apellido común — un
  // cliente apellidado así quedaría marcado como venta mixta.
  ["arraigo", "Arraigo"],
  // Calma (CALMA™ Serum Facial): COD desde octubre 2026; el 04/10 sus pedidos salieron sin código
  // de depósito. Fin de palabra (\b) porque "calmante" es común en títulos de cosmética y
  // matchAllProducts marcaría venta mixta. Las keywords son regex (las de solo letras = includes).
  // En SQL: 106_producto_calma.sql ('calma\M').
  ["calma\\b", "Calma"],
];

// Nombres canónicos, para el test que chequea que no colisionen las letras del código de depósito.
export const PRODUCTOS = [...new Set(PRODUCT_KEYWORDS.map(([, name]) => name))];

export function matchProduct(text: string): string | null {
  const t = text.toLowerCase();
  for (const [kw, name] of PRODUCT_KEYWORDS) if (new RegExp(kw).test(t)) return name;
  return null;
}

// Todos los productos distintos presentes en el texto (para detectar etiquetas mixtas de ML).
export function matchAllProducts(text: string): string[] {
  const t = text.toLowerCase();
  return [...new Set(PRODUCT_KEYWORDS.filter(([kw]) => new RegExp(kw).test(t)).map(([, name]) => name))];
}

// Unidades físicas de un line item de Shopify. El checkout vende 1 línea por frasco (quantity = unidades;
// el "2x1"/"(LLEVA 3)" del título es marketing), PERO el bot de WhatsApp de Veltron carga el pack
// entero como UNA línea con quantity 1: "OFERTA PurezaDrops — Lleva 3", "Bee Venom Spray 2x1",
// "PurezaDrops Pack x3". Contar quantity ahí rotulaba P1 un pedido de 3 frascos (23/09/2026: 45 líneas
// así desde julio, #23144 entre ellas). Se reconocen por título corto (sin | : ni paréntesis, que
// tienen todos los del catálogo) terminado en el pack. quantity > 1 multiplica (#24447: Lleva 2 ×2 = 4).
// ⚠️ order_items.pack (upsert_order en SQL) todavía cuenta quantity: el P&L no ve esto (el código de depósito sí: lib/picking.ts).
export function unidadesLinea(title: string, quantity: number): number {
  const m = /[|:(]/.test(title) ? null : title.match(/(?:lleva\s*(\d+)|(\d+)\s*x\s*\d+|pack\s*x\s*(\d+))\s*$/i);
  const pack = m ? Number(m[1] ?? m[2] ?? m[3]) : 1;
  return pack * (quantity || 0);
}

// Modelo de profit/orden por publicación. Calibrado a $8.535 en la x2 Clásica a $33.231 (24/09/2026).
const IVA = 1.21, FIXED = 3320, THRESH = 33000;
const FLETE = 7148.56;      // medido 7d, Pureza pack 2 (bruto c/IVA)
const COGS = 4500;          // product_costs Pureza pack 2, is_estimated=false
const T = 581.75 / 34710.91;// tax_withheld medido / precio medio 7d
const ADS_CLA = 2334;       // calibración: profit(33.231)=8.535
const ADS_PRE = 0;          // medido: la Premium casi no gasta pauta hoy
function profit({ sellerPrice, rate, ads }) {
  const fee = rate * sellerPrice + (sellerPrice < THRESH ? FIXED : 0);
  return sellerPrice / IVA - fee / IVA - FLETE / IVA - COGS - T * sellerPrice - ads;
}
const CLA = (p, ads = ADS_CLA) => profit({ sellerPrice: p, rate: 0.205, ads });
const PRE = (p, ads = ADS_PRE) => profit({ sellerPrice: p, rate: 0.244, ads });
const r = (x) => Math.round(x);
const base = CLA(33231);
console.log('CALIBRACION x2 Clásica $33.231 →', r(base), '(objetivo 8.535)');
console.log('marginal por $1 de precio: Clásica', (0.795 / IVA - T).toFixed(4), '| Premium', (0.756 / IVA - T).toFixed(4));
const rows = [];
const add = (n, pub, buyer, seller, p, cmp) => rows.push({ promo: n, pub, comprador: r(buyer), seller_fee_base: r(seller), escalon: seller < THRESH ? 'SI' : 'no', profit: r(p), 'vs base': r(p - cmp), 'vol x': (cmp / p).toFixed(3) });
// --- CLASICA (base = hoy, $33.231, sin promo)
add('HOY sin promo', 'Clásica', 33231, 33231, CLA(33231), base);
add('SMART P-MLA18023152 (meli 1,31/seller 3,69)', 'Clásica', 31569.45, 33231 * (1 - 0.0369), CLA(33231 * (1 - 0.0369)), base);
add('SMART P-MLA18041082 (meli 1,8/seller 3,2)', 'Clásica', 31569.45, 33231 * (1 - 0.032), CLA(33231 * (1 - 0.032)), base);
add('SMART P-MLA18091086 10.10 (meli 1,8/seller 3,2)', 'Clásica', 31569.45, 33231 * (1 - 0.032), CLA(33231 * (1 - 0.032)), base);
add('LIGHTNING LGH-MLA1000', 'Clásica', 31569.45, 31569.45, CLA(31569.45), base);
add('PRICE_DISCOUNT sugerido (=max)', 'Clásica', 31569.45, 31569.45, CLA(31569.45), base);
add('DEAL MELI+ al max permitido', 'Clásica', 32234.07, 32234.07, CLA(32234.07), base);
add('DEAL MELI+ al sugerido', 'Clásica', 28910.97, 28910.97, CLA(28910.97), base);
add('CUPON Oferta10 (-10%, tope $5.000)', 'Clásica', 33231 * 0.9, 33231 * 0.9, CLA(33231 * 0.9), base);
add('bajar a price_to_win 32.547 (edición directa)', 'Clásica', 32547, 32547, CLA(32547), base);
add('>>> subir lista a 34.091 + SMART 10.10', 'Clásica', 34091 * 0.95, 33000, CLA(33000), base);
// --- PREMIUM (base = hoy, PRICE_DISCOUNT started $33.396)
const bp = PRE(33396);
add('HOY PRICE_DISCOUNT $33.396 (started)', 'Premium', 33396, 33396, bp, bp);
add('SMART P-MLA18023152 started $33.869', 'Premium', 33869, 39677 * (1 - 0.144), PRE(39677 * (1 - 0.144)), bp);
add('SMART P-MLA18041082 Compartidas (meli 1,314/seller 16,686)', 'Premium', 32394.12, 39677 * (1 - 0.16686), PRE(39677 * (1 - 0.16686)), bp);
add('DEAL MELI+ al max permitido', 'Premium', 32394.12, 32394.12, PRE(32394.12), bp);
add('DEAL MELI+ al sugerido', 'Premium', 28426.42, 28426.42, PRE(28426.42), bp);
add('CUPON Oferta10 (-10%)', 'Premium', 33396 * 0.9, 33396 * 0.9, PRE(33396 * 0.9), bp);
console.table(rows);
console.log('\n-- quién debe tener la caja, a pauta IGUAL ($2.334/orden) --');
console.log('Clásica gana caja a 33.396 (si tuviera boost cuotas):', r(CLA(33396)));
console.log('Premium gana caja a 33.396 con pauta 2.334:', r(PRE(33396, 2334)));
console.log('delta por orden:', r(CLA(33396) - PRE(33396, 2334)));
console.log('sobrecosto cuotas 5,00pp de la Clásica, neto IVA, por orden:', r(0.05 * 33231 / IVA));

// Pasa el CSV de carga masiva de Correo que baja Veltron por el MISMO filtro que Biolabs Finanzas ›
// Logística › Correo (lib/correo: parseCsv → normalizeRow → rowErrors → buildCsv). El de Veltron sale
// con signos que MiCorreo rechaza, caja 5×5×5 y sin CRLF; paso obligatorio antes de subirlo (Pancho, 28/09/2026).
//   npx tsx scripts/correo-filtro.mts "<csv de Veltron>" "<salida>"
// Si una fila no tiene domicilio armable (falta localidad, calle o CP) corta sin escribir: esa se
// resuelve eligiendo sucursal en la pantalla /logistica (la más cercana al domicilio).
import fs from "node:fs";
import { parseCsv, normalizeRow, rowErrors, buildCsv } from "@/lib/correo";

const [src, dst] = process.argv.slice(2);
if (!src || !dst) { console.error("uso: correo-filtro.mts <csv veltron> <salida>"); process.exit(1); }
const rows = parseCsv(fs.readFileSync(src, "utf8")).map(normalizeRow);
const malas = rows.map((r) => ({ r, e: rowErrors(r) })).filter((x) => x.e.length);
for (const { r, e } of malas) console.error(`✗ ${r.orden} ${r.localidad} (${r.provincia}): ${e.join(" · ")}`);
if (malas.length) { console.error(`${malas.length}/${rows.length} filas con error: no se escribe nada`); process.exit(1); }
fs.writeFileSync(dst, buildCsv(rows), "latin1"); // buildCsv ya es ASCII puro con CRLF
console.log(`✓ ${rows.length} filas → ${dst}`);

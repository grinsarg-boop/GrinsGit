// Lectura de datos/urbano_rendiciones.csv con la regla de reimpresión aplicada. Vive acá porque la
// usan dos consumidores —el reclamo y el push a la base— y es una regla de PLATA: si cada uno la
// escribe a su manera, un día divergen y lo cobrado se cuenta dos veces.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

// martes de giro de una entrega: ventana martes→lunes, giro el martes siguiente (migr 033)
export const giroDe = (iso) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 5) % 7) + 7);
  return d.toISOString().slice(0, 10);
};

export function leerRendiciones() {
  const csv = readFileSync(join(RAIZ, 'datos', 'urbano_rendiciones.csv'), 'utf8').trim().split('\n');
  const cab = csv[0].split(',');
  const rend = csv.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, i) => [cab[i], v])));

  // Una reimpresión (mismas guías que un resumen anterior) no es plata nueva — descartarla, o el
  // faltante sale menor de lo que es. Ver el aviso de urbano-rendiciones.py.
  const porResumen = new Map();
  for (const r of rend) {
    const k = `${r.fecha}|${r.resumen}`;
    if (!porResumen.has(k)) porResumen.set(k, new Set());
    porResumen.get(k).add(r.guia);
  }
  const reimpresos = new Set();
  const claves = [...porResumen.keys()].sort();
  for (let i = 0; i < claves.length; i++)
    for (let j = i + 1; j < claves.length; j++) {
      const [a, b] = [porResumen.get(claves[i]), porResumen.get(claves[j])];
      const comun = [...b].filter((g) => a.has(g)).length;
      if (comun / b.size > 0.95) reimpresos.add(claves[j]);
    }
  const vale = (r) => !reimpresos.has(`${r.fecha}|${r.resumen}`);

  const pagada = new Map();                     // guía → fecha del resumen que la pagó
  for (const r of rend) if (vale(r)) pagada.set(r.guia, r.fecha);

  // Martes de giro con resumen en mano, y si ese martes trae los DOS formatos. Un martes al que le
  // falta un formato no prueba nada: sus "faltantes" pueden estar en el archivo que no tenemos.
  const martes = new Map();
  for (const r of rend) {
    if (!vale(r)) continue;
    if (!martes.has(r.fecha)) martes.set(r.fecha, new Set());
    martes.get(r.fecha).add(r.fmt);
  }
  const completo = (f) => martes.get(f)?.size === 2;

  return { rend, reimpresos, vale, pagada, martes, completo };
}

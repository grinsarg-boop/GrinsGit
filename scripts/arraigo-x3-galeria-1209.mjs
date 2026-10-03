// Galería del x3 según la auditoría del 12/09/2026 (Google Doc "Brief para el editor"), ajustada al aplicador:
// portada limpia sin sticker (regla ML), kit c/aplicador 2º, "tres meses" 3º, pack/ahorro nueva 4º, resto igual.
// Dry-run por defecto; APLICAR=1 sube las 2 nuevas y hace el PUT (lo que no está en el array, ML lo saca).
import { TOKEN, ml } from './_ml.mjs';
import { readFileSync } from 'node:fs';

const ID = 'MLA1972664973';
const APLICAR = process.env.APLICAR === '1';
const OUT = '/Users/franciscoandreudegasperi/Downloads/arraigo-ml-galeria/out/';

const { body: it } = await ml(`/items/${ID}`, { attributes: 'pictures' });
const p = it.pictures.map(x => x.id);
if (p.length !== 11) { console.error(`esperaba 11 fotos, hay ${p.length} — revisar a mano`); process.exit(1); }
// índices 0-based de la galería del 12/09 12:00: 0 sticker · 1 kit · 2 closeup · 3 raíz · 4 rutina · 5 activos · 6 minuto · 7 mirás · 8 tres meses · 9 caja · 10 baño
const orden = (nueva1, nueva4) => [nueva1, p[1], p[8], nueva4, p[2], p[3], p[4], p[5], p[6], p[7], p[9], p[10]];
console.log('orden nuevo:', orden('PORTADA-LIMPIA', 'PACK-AHORRO').join('\n  '));
if (!APLICAR) { console.log('\n[dry-run]'); process.exit(0); }

async function subir(nombre) {
  const fd = new FormData();
  fd.append('file', new Blob([readFileSync(OUT + nombre)], { type: 'image/png' }), nombre);
  const j = await (await fetch('https://api.mercadolibre.com/pictures/items/upload', { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: fd })).json();
  if (!j.id) throw new Error(`${nombre}: ${JSON.stringify(j).slice(0, 200)}`);
  console.log(`subida ${nombre} -> ${j.id}`);
  return j.id;
}
const portada = await subir('portada-x3-limpia.png');
const pack = await subir('08-pack-ahorro.png');
const r = await fetch(`https://api.mercadolibre.com/items/${ID}`, {
  method: 'PUT', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ pictures: orden(portada, pack).map(id => ({ id })) }),
});
const j = await r.json().catch(() => ({}));
console.log(`PUT ${r.status} ${r.ok ? j.pictures.length + ' fotos' : JSON.stringify(j).slice(0, 300)}`);

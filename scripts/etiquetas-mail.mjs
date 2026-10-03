// Último paso de cada generación de etiquetas (Pancho, 29/09/2026): lee el código estampado de cada
// página de los PDFs, arma el detalle de picking por courier (packs por código y frascos por producto),
// descuenta esos frascos de la app Stock y manda todo por mail al depósito, desde biolabsarg@gmail.com
// a andreud.francisco@gmail.com (scripts/gmail-enviar.mjs, token GMAIL_SEND_TOKEN_BIOLABS).
//
//   node --env-file=.env.local scripts/etiquetas-mail.mjs <archivos...>          # descuenta y manda
//   node --env-file=.env.local scripts/etiquetas-mail.mjs --dry <archivos...>    # sólo muestra el detalle
//   MAIL_TO=otra@casilla ...                                                     # a otra casilla
//
// El detalle sale del PDF que se imprime y no de un índice aparte: el código estampado (P2 = Pureza x2)
// es el último texto de cada página en ML, Urbano, Fixy y Correo (verificado 29/09/2026).
//
// STOCK sin doble descuento: `.stock-etiquetas.json` (en la raíz) guarda cada etiqueta ya descontada por
// courier + nº de pedido o venta. Un PDF regenerado, o el de Flex de la mañana que repite etiquetas de la
// noche, sólo descuenta las nuevas. ponytail: la clave es el pedido y no la guía, así que un redespacho
// del mismo pedido no se descuenta solo; si eso pasa seguido, sumar la guía a la clave.
// Es el puente hasta A07-R2-T3 (job stock-despachos por guía despachada): cuando exista, se saca el
// descuento de acá, porque si no se descuenta dos veces.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const RAIZ = path.join(import.meta.dirname, '..');
const DRY = process.argv.includes('--dry');
const archivos = process.argv.slice(2).filter((a) => a !== '--dry');
if (!archivos.length) { console.error('uso: etiquetas-mail.mjs [--dry] <archivos...>'); process.exit(1); }
const TO = process.env.MAIL_TO ?? 'andreud.francisco@gmail.com';

// Letra del código → producto de la app Stock. Misma regla que letraProducto (lib/correo.ts):
// inicial del producto, salvo Arraigo = S.
const PRODUCTO = { P: 'Gotero Pureza', B: 'Bee Venom', R: 'Revival Oil', M: 'M3', V: 'Veinguard', A: 'Altus', N: 'Gotero Natures', S: 'Arraigo' };
const nombreCorto = { 'Gotero Pureza': 'Pureza', 'Bee Venom': 'BeeVenom', 'Gotero Natures': 'Natures' };
const corto = (p) => nombreCorto[p] ?? p;

function courierDe(f) {
  const n = path.basename(f).toLowerCase();
  if (n.includes('flex')) return 'ML Flex';
  if (n.startsWith('ml') || n.includes('dropoff')) return 'ML drop-off';
  if (n.includes('anticipado')) return 'Urbano anticipado';  // antes que 'urbano': el nombre también lo contiene
  if (n.includes('urbano')) return 'Urbano';
  if (n.includes('fixy')) return 'Fixy';
  if (n.includes('correo')) return 'Correo';
  return path.basename(f);
}

// ---------------- 1. leer los códigos de cada PDF ----------------
const pdfjs = await import(path.join(RAIZ, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs'));
const grupos = []; // { courier, archivo, paginas: [{ code, ref }] }
const avisos = [];
for (const f of archivos.filter((a) => a.toLowerCase().endsWith('.pdf'))) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(f)), verbosity: 0 }).promise;
  const paginas = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const items = (await (await doc.getPage(i)).getTextContent()).items.map((x) => x.str.trim()).filter(Boolean);
    const code = [...items].reverse().find((s) => /^[A-Z]\d{1,2}$/.test(s)) ?? null;
    const txt = items.join(' ');
    // ML: Pack ID o Venta (2000…, 16 dígitos), que el PDF trae partido: "Pack ID: 20000 15221272973".
    // COD y Correo: #pedido. (El "#262382468" del remitente de ML tiene 9 dígitos y no entra.)
    const ml = txt.match(/(?:Pack ID|Venta)\s*:?[\s|]*((?:\d+[\s|]*){1,3})/)?.[1]?.replace(/\D/g, '').slice(0, 16);
    // Fixy no trae #pedido: el nº de orden va en "Remito: 27867".
    const ref = (ml?.length === 16 ? ml : null) ?? txt.match(/#(\d{4,6})\b/)?.[1] ?? txt.match(/Remito:[\s|]*(\d{4,6})\b/)?.[1] ?? null;
    if (!code) avisos.push(`${path.basename(f)} pág ${i}: sin código estampado, no entra al detalle ni al stock`);
    paginas.push({ code, ref, pag: i });
  }
  grupos.push({ courier: courierDe(f), archivo: f, paginas });
}

// ---------------- 2. detalle por courier ----------------
const frascos = (code) => Number(code.slice(1));
const detalle = (pags) => {
  const porCode = {}, porProd = {};
  for (const { code } of pags) if (code) {
    porCode[code] = (porCode[code] ?? 0) + 1;
    const p = PRODUCTO[code[0]] ?? code[0];
    porProd[p] = (porProd[p] ?? 0) + frascos(code);
  }
  return { porCode, porProd };
};
const ordenCode = (a, b) => frascos(a) - frascos(b) || a.localeCompare(b);
const lineas = [];
const total = {};
for (const g of grupos) {
  const { porCode, porProd } = detalle(g.paginas);
  for (const [p, u] of Object.entries(porProd)) total[p] = (total[p] ?? 0) + u;
  lineas.push(`${g.courier} — ${g.paginas.length} etiquetas`);
  lineas.push(`  Packs: ${Object.keys(porCode).sort(ordenCode).map((c) => `${c} ×${porCode[c]}`).join(' · ')}`);
  lineas.push(`  Frascos: ${Object.entries(porProd).map(([p, u]) => `${corto(p)} ${u}`).join(' · ')}`);
  lineas.push('');
}
const nEtiq = grupos.reduce((s, g) => s + g.paginas.length, 0);
lineas.push(`TOTAL — ${nEtiq} etiquetas · ${Object.entries(total).map(([p, u]) => `${corto(p)} ${u} frascos`).join(' · ')}`);

// ---------------- 3. stock: sólo lo que no se descontó antes ----------------
const LEDGER = path.join(RAIZ, '.stock-etiquetas.json');
const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : {};
const nuevas = [];
for (const g of grupos) for (const p of g.paginas) {
  if (!p.code) continue;
  const clave = p.ref ? `${g.courier}:${p.ref}` : null;
  if (clave && ledger[clave]) continue;
  if (!clave) avisos.push(`${path.basename(g.archivo)} pág ${p.pag}: sin nº de pedido/venta, se descuenta pero no se puede proteger de un doble descuento`);
  nuevas.push({ clave, code: p.code });
}
const aDescontar = {};
for (const { code } of nuevas) { const p = PRODUCTO[code[0]] ?? code[0]; aDescontar[p] = (aDescontar[p] ?? 0) + frascos(code); }
const repetidas = nEtiq - avisos.filter((a) => a.includes('sin código')).length - nuevas.length;

const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
const lineasStock = [];
if (!Object.keys(aDescontar).length) lineasStock.push(`Stock: nada nuevo para descontar (${repetidas} etiquetas ya descontadas antes).`);
else if (DRY) lineasStock.push(`Stock (dry-run, no se descontó): ${Object.entries(aDescontar).map(([p, u]) => `${corto(p)} −${u}`).join(' · ')}${repetidas ? ` · ${repetidas} ya descontadas antes` : ''}`);
else {
  const URL_ = 'https://fxltytovnfpgnwefoovx.supabase.co/rest/v1';
  const K = process.env.STOCK_SERVICE_KEY;
  if (!K) throw new Error('falta STOCK_SERVICE_KEY (correr con --env-file=.env.local)');
  const h = { apikey: K, authorization: `Bearer ${K}`, 'content-type': 'application/json' };
  const prods = await fetch(`${URL_}/productos?select=id,nombre,stock`, { headers: h }).then((r) => r.json());
  const nota = `etiquetas ${hoy} · ${grupos.map((g) => g.courier).join(' + ')}`;
  lineasStock.push(`Stock descontado (${nota})${repetidas ? ` · ${repetidas} etiquetas ya estaban descontadas` : ''}:`);
  for (const [nombre, u] of Object.entries(aDescontar)) {
    const p = prods.find((x) => x.nombre === nombre);
    if (!p) { lineasStock.push(`  ⚠️ ${nombre} −${u}: no está en la app Stock, no se descontó`); continue; }
    const r1 = await fetch(`${URL_}/movimientos`, { method: 'POST', headers: h, body: JSON.stringify({ tipo: 'salida_producto', producto_id: p.id, cantidad: -u, nota, usuario_email: 'claude (Pancho)' }) });
    if (!r1.ok) throw new Error(`movimiento ${nombre}: ${r1.status} ${await r1.text()}`);
    const queda = Number(p.stock) - u;
    const r2 = await fetch(`${URL_}/productos?id=eq.${p.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ stock: queda, updated_at: new Date().toISOString() }) });
    if (!r2.ok) throw new Error(`stock ${nombre}: ${r2.status} ${await r2.text()}`);
    lineasStock.push(`  ${corto(nombre)}: ${p.stock} − ${u} = ${queda}${queda < 0 ? '  ⚠️ negativo: falta cargar producción' : ''}`);
  }
  for (const { clave, code } of nuevas) if (clave) ledger[clave] = { code, fecha: hoy };
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
}

const cuerpo = [...lineas, '', ...lineasStock, ...(avisos.length ? ['', ...avisos.map((a) => `⚠️ ${a}`)] : []),
  '', 'Adjuntos:', ...archivos.map((f) => `  ${path.basename(f)}`)].join('\n');
console.log(cuerpo);

// ---------------- 4. mail ----------------
if (DRY) { console.log('\n(dry-run: no se mandó el mail)'); process.exit(0); }
const peso = archivos.reduce((s, f) => s + fs.statSync(f).size, 0);
// Gmail corta en 25 MB con el base64 incluido (×1,37): arriba de ~18 MB crudos no sale.
if (peso > 18e6) { console.error(`⛔ ${(peso / 1e6).toFixed(1)} MB: pasa el límite de Gmail, mandalo en dos tandas (el stock YA se descontó)`); process.exit(1); }
const b64h = (s) => `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=`;
const asunto = `Etiquetas ${hoy.split('-').reverse().slice(0, 2).join('/')} — ${grupos.map((g) => `${g.courier} ${g.paginas.length}`).join(' · ')}`;
const B = `b${Date.now()}`;
const partes = [
  `To: ${TO}\r\nSubject: ${b64h(asunto)}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${B}"\r\n`,
  `--${B}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(cuerpo).toString('base64').replace(/.{76}/g, '$&\r\n')}`,
  ...archivos.map((f) => {
    const n = b64h(path.basename(f));
    const ct = f.endsWith('.pdf') ? 'application/pdf' : f.endsWith('.csv') ? 'text/csv; charset=UTF-8' : 'application/octet-stream';
    return `--${B}\r\nContent-Type: ${ct}; name="${n}"\r\nContent-Disposition: attachment; filename="${n}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${fs.readFileSync(f).toString('base64').replace(/.{76}/g, '$&\r\n')}`;
  }),
  `--${B}--\r\n`,
];
const eml = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'etiq-')), 'mail.eml');
fs.writeFileSync(eml, partes.join('\r\n'));
execFileSync('node', [path.join(RAIZ, 'scripts/gmail-enviar.mjs'), 'biolabs', eml], { stdio: 'inherit' });
console.log(`\nmail enviado a ${TO}: ${asunto}`);

// Etiquetas de ML en un PDF ordenado para el armado, desde la API.
//
// Por que existe: hasta hoy el PDF se bajaba a mano del panel y recien ahi /api/ml-picking lo cruzaba
// para contar unidades. GET /shipment_labels devuelve lo mismo y deja elegir el ORDEN de las paginas,
// que es lo que hace rapido el picking.
//
// OJO — efecto de lado: pedir la etiqueta la marca `printed` en ML y la saca de la cola "por imprimir"
// del panel, sin vuelta atras. Por eso el default es dry-run (sin --print no se pide ninguna etiqueta)
// y se pide SOLO lo que va a un PDF: toda etiqueta pedida sale en papel, o el script corta. Si corta a
// mitad, lo ya pedido esta en los lotes crudos /tmp/ml-lote-*.pdf.
//
// La ventana (--hasta) se decide ANTES de pedir: GET /shipments/{id}/sla → expected_date es el
// "Despachar: …" impreso, con fecha y hora (coincidio en 206/206 y 207/207 envios el 27/09/2026).
// Las Flex vencen a las 23:00 del dia: --hasta=AAAA-MM-DD toma el dia entero, drop-off y Flex.
// El "Despachar" impreso se sigue leyendo, solo como control cruzado.
//
// Trampas medidas:
//   · ML devuelve lotes incompletos sin error (24/09: 1 de 25). Se compara ID por ID lo pedido contra
//     lo devuelto y lo que falta se pide de a uno.
//   · Flex (self_service) y drop-off van en lotes separados (24/09: un lote mixto volvio con menos
//     etiquetas identificadas que ids pedidos).
//   · En la etiqueta Flex el numero de envio viene partido ("Envio: 4810547 4871") y la hoja de
//     identificacion del final lo trae entero. La Flex se identifica por Venta ID / Pack ID
//     (27/09: 34/34 contra el numero partido).
//   · El pack NO esta en shipping_items.quantity (siempre 1): vive en el titulo. Misma regla que
//     parseMlPack() de lib/ml.ts.
//
// Uso:
//   node scripts/ml-etiquetas.mjs --hasta=2026-09-28                # dry-run: que se pediria, no imprime
//   node scripts/ml-etiquetas.mjs --print --hasta=2026-09-28        # todo lo que vence el 28/09
//   node scripts/ml-etiquetas.mjs --print --hasta=2026-09-29T11:00  # hasta ese corte
//   node scripts/ml-etiquetas.mjs --print                           # toda la cola, drop-off y Flex

import { ml, TOKEN } from './_ml.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';

const SELLER = '262382468';
const LOTE = 25; // ids por llamada
const MODOS = { xd_drop_off: 'dropoff', self_service: 'flex' }; // logistic_type que se imprime → sufijo del PDF
const args = process.argv.slice(2);
// Un flag mal escrito ("--hasta 2026-09-28", "--hast=…") no puede terminar imprimiendo la cola entera.
const raros = args.filter((a) => !/^--(print|incluir-impresos|hasta=.+|out=.+|modo=(flex|dropoff))$/.test(a));
if (raros.length) throw new Error(`no entiendo: ${raros.join(' ')}`);
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const PRINT = args.includes('--print');
// --modo=flex|dropoff: un solo modo, para armar el PDF de Flex y el de drop-off por separado.
const MODO = flag('modo');
// Re-bajar una etiqueta ya impresa no cambia nada en ML: sirve para rehacer el PDF completo de la
// tanda cuando parte ya se pidio. Quedan afuera igual las `dropped_off` (ya entregadas en sucursal).
const IMPRESOS = args.includes('--incluir-impresos');
// Hora Argentina (-03:00 fijo, sin horario de verano). Solo fecha = hasta el fin de ese dia.
const H = flag('hasta')?.replace(/^(\d{4}-\d\d-\d\d)$/, '$1T23:59');
const HASTA = H ? new Date(`${H}:00-03:00`) : null;
if (H && (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(H) || Number.isNaN(+HASTA))) {
  throw new Error(`--hasta=${flag('hasta')}: va AAAA-MM-DD o AAAA-MM-DDTHH:MM (hora Argentina)`);
}
// Con la hora en el nombre, una segunda corrida del dia no pisa los PDF de la primera.
const AHORA = new Date(Date.now() - 3 * 3600e3).toISOString(); // hora Argentina
const OUT = flag('out') ?? `docs/etiquetas-ml/ml-${AHORA.slice(0, 10)}-${AHORA.slice(11, 16).replace(':', '')}`;

function packDeTitulo(t = '') {
  for (const re of [/^\s*(\d{1,2})\s/, /(\d{1,2})\s*[xX]\s*\d/, /[xX]\s*(\d{1,2})/, /(\d{1,2})\s*u\b/i, /(\d{1,2})\s*unidades?\b/i]) {
    const n = Number((t.match(re) ?? [])[1]);
    if (n >= 1 && n <= 12) return n;
  }
  return 1;
}

// Venta ID y Pack ID → envio: asi se identifica la etiqueta Flex.
const envioDeVenta = new Map();

// Cola autoritativa del lado de ML (no de ml_orders: la tabla puede venir atrasada).
async function cola() {
  const ids = new Set();
  for (let off = 0; off < 1000; off += 50) {
    const r = await ml('/orders/search', { seller: SELLER, 'shipping.status': 'ready_to_ship', offset: off, limit: 50 });
    for (const o of r.body?.results ?? []) {
      if (!o.shipping?.id) continue;
      ids.add(o.shipping.id);
      for (const v of [o.id, o.pack_id]) if (v) envioDeVenta.set(String(v), String(o.shipping.id));
    }
    if (off + 50 >= (r.body?.paging?.total ?? 0)) break;
  }
  const arr = [...ids];
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: 10 }, async () => {
    while (i < arr.length) {
      const id = arr[i++];
      const sh = (await ml(`/shipments/${id}`)).body ?? {};
      const ok = sh.substatus === 'ready_to_print' || (IMPRESOS && sh.substatus === 'printed');
      if (!ok) continue;
      // El limite de despacho: sin el, el envio no entra en ninguna ventana.
      const sla = (await ml(`/shipments/${id}/sla`)).body ?? {};
      const desc = (sh.shipping_items ?? [])[0]?.description ?? '';
      // Flex: /sla puede venir con un día de más. 29/09/2026, envío 48126372920: pagó a las 09:17, antes del
      // corte de las 11 (pay_before), y ML le prometió entrega ESE día (estimated_delivery_time = 29/09, lo
      // que muestra el panel: "darle el paquete el martes 29"). /sla decía "on_time" 30/09 23:00, así que la
      // corrida de la mañana la dejó para el otro día y quedó DEMORADA. En Flex la entrega es el mismo día
      // del despacho: manda la más temprana de las dos fechas.
      let despachar = sla.expected_date ?? null;
      const limite = sh.shipping_option?.estimated_delivery_time?.date?.slice(0, 10);
      if (sh.logistic_type === 'self_service' && limite && (!despachar || limite < despachar.slice(0, 10))) {
        despachar = `${limite}T23:00:00-03:00`;
      }
      out.push({
        id, tipo: sh.logistic_type, metodo: sh.shipping_option?.name ?? '?',
        producto: desc, pack: packDeTitulo(desc),
        creado: sh.date_created ?? '', despachar,
      });
    }
  }));
  return out;
}

async function etiquetas(ids) {
  const r = await fetch(
    `https://api.mercadolibre.com/shipment_labels?shipment_ids=${ids.join(',')}&response_type=pdf`,
    { headers: { authorization: `Bearer ${TOKEN}` } },
  );
  if (!r.ok) throw new Error(`shipment_labels ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return Buffer.from(await r.arrayBuffer());
}

const todo = await cola();
const imprimibles = todo.filter((o) => MODOS[o.tipo] && (!MODO || MODOS[o.tipo] === MODO));
const sel = imprimibles
  .filter((o) => !HASTA || (o.despachar && new Date(o.despachar) <= HASTA))
  .sort((a, b) => (a.despachar ?? '').localeCompare(b.despachar ?? ''));
const contar = (xs, k) => xs.reduce((a, x) => ({ ...a, [k(x)]: (a[k(x)] ?? 0) + 1 }), {});
const diaModo = (o) => `${o.despachar?.slice(0, 16).replace('T', ' ') ?? 'sin fecha en /sla'} ${MODOS[o.tipo]}`;
console.log(`cola por imprimir: ${todo.length}`, contar(todo, (o) => MODOS[o.tipo] ?? `${o.tipo} (no se toca)`));
if (HASTA) console.log(`ventana: despachar hasta ${H.replace('T', ' ')} (hora Argentina)`);
console.log('a pedir (Despachar, modo):', contar(sel, diaModo));
if (HASTA) console.log('fuera de la ventana, no se piden:', contar(imprimibles.filter((o) => !sel.includes(o)), diaModo));
if (!sel.length) {
  console.log('\nnada para pedir.');
  process.exit(0);
}

// Un PDF por dia de despacho y modo: cada tanda se imprime y se lleva por separado.
const pdfDe = (o) => `${OUT}-despachar-${o.despachar ? `${o.despachar.slice(8, 10)}-${o.despachar.slice(5, 7)}` : 'sin-fecha'}-${MODOS[o.tipo]}.pdf`;
// Pisar el PDF de otra corrida deja sus etiquetas marcadas impresas y sin papel.
const pisa = [...new Set(sel.map(pdfDe)), `${OUT}-manifiesto.csv`].filter((f) => existsSync(f));
if (pisa.length) throw new Error(`ya existe ${pisa.join(', ')}: pasar otro --out= (no se pisa)`);

if (!PRINT) {
  console.log('por pack:', contar(sel, (o) => `x${o.pack}`));
  console.log('\nDRY-RUN: no se pidio ninguna etiqueta (nada quedo marcado impreso). Agregar --print.');
  process.exit(0);
}

mkdirSync(OUT.replace(/\/[^/]+$/, ''), { recursive: true });
const paginas = []; // { pagina, envio, venta, despachar, doc }
const docs = [];
const ANIO = String(new Date().getFullYear());

// Baja un PDF de etiquetas y devuelve sus etiquetas con el envio resuelto: drop-off por el numero
// impreso, Flex por Venta ID / Pack ID. La que no se resuelve se descarta aca, y su envio cae en
// `faltan` → se pide de a uno.
async function bajar(ids, tag, tipo) {
  const buf = await etiquetas(ids);
  const tmp = `/tmp/ml-lote-${tag}.pdf`;
  writeFileSync(tmp, buf);
  const info = JSON.parse(execFileSync('python3', ['scripts/_ml-etiqueta-parse.py', tmp, ANIO]));
  docs.push(await PDFDocument.load(buf));
  return info
    .map((p) => ({ ...p, envio: tipo === 'self_service' ? envioDeVenta.get(p.venta) : p.envio, doc: docs.length - 1 }))
    .filter((p) => p.envio);
}

for (const [tipo, modo] of Object.entries(MODOS)) {
  const grupo = sel.filter((o) => o.tipo === tipo);
  for (let i = 0; i < grupo.length; i += LOTE) {
    const lote = grupo.slice(i, i + LOTE);
    const got = await bajar(lote.map((o) => o.id), `${modo}-${i}`, tipo);
    // ML a veces devuelve el lote incompleto sin avisar (medido 24/09/2026: 1 de 25, "Retiro en una
    // sucursal", que pedida sola vuelve perfecta). Se rescata una por una: si falta y no aparece
    // individualmente, se corta — una etiqueta marcada impresa y sin papel es un pedido que se pierde.
    const vistos = new Set(got.map((p) => p.envio));
    const faltan = lote.filter((o) => !vistos.has(String(o.id)));
    for (const f of faltan) {
      const solo = await bajar([f.id], `${modo}-${i}-${f.id}`, tipo);
      const pag = solo.find((p) => p.envio === String(f.id));
      if (!pag) throw new Error(`envio ${f.id}: ML no devuelve su etiqueta ni en lote ni sola — no sigo`);
      got.push(pag);
    }
    paginas.push(...got);
    console.log(`  ${modo} lote ${i / LOTE + 1}: ${lote.length} etiquetas${faltan.length ? ` (${faltan.length} rescatada/s de a una)` : ''}`);
  }
}

const porId = new Map(sel.map((o) => [String(o.id), o]));
// Una etiqueta por envio, y ninguna que no haya pedido.
const cuenta = new Map();
for (const p of paginas) cuenta.set(p.envio, (cuenta.get(p.envio) ?? 0) + 1);
const dup = [...cuenta].filter(([, n]) => n > 1);
const ajenas = [...cuenta.keys()].filter((e) => !porId.has(e));
if (dup.length) throw new Error(`envios con mas de una etiqueta: ${dup.map(([e, n]) => `${e}x${n}`).join(', ')}`);
if (ajenas.length) throw new Error(`etiquetas de envios que no pedi: ${ajenas.join(', ')}`);

// Control cruzado del filtro: el "Despachar" impreso contra /sla (la Flex no lo trae impreso).
const difieren = paginas.filter((p) => p.despachar && p.despachar !== porId.get(p.envio).despachar?.slice(0, 16));
if (difieren.length) {
  console.warn(`OJO: ${difieren.length} etiqueta(s) con el "Despachar" impreso distinto de /sla: ${difieren.map((p) => p.envio).join(', ')}.`
    + ' El filtro por fecha dejo de ser confiable: revisar antes de la proxima corrida.');
}

// Orden de armado: pack chico primero, y dentro del pack por producto.
const ordenArmado = (a, b) => {
  const x = porId.get(a.envio), y = porId.get(b.envio);
  return x.pack - y.pack || x.producto.localeCompare(y.producto) || Number(a.envio) - Number(b.envio);
};
const porPdf = new Map();
for (const p of paginas) {
  const f = pdfDe(porId.get(p.envio));
  if (!porPdf.has(f)) porPdf.set(f, []);
  porPdf.get(f).push(p);
}
const pdfs = [...porPdf.keys()];
for (const f of pdfs) {
  const lista = porPdf.get(f).sort(ordenArmado);
  const doc = await PDFDocument.create();
  for (const p of lista) {
    const [pg] = await doc.copyPages(docs[p.doc], [p.pagina]);
    doc.addPage(pg);
  }
  writeFileSync(f, Buffer.from(await doc.save()));
  console.log(`${lista.length} etiquetas -> ${f}`);
}

const fila = (p) => {
  const o = porId.get(p.envio);
  return [p.envio, o.pack, `"${o.metodo}"`, o.creado.slice(0, 10), o.despachar?.slice(0, 16) ?? '', `"${o.producto.replace(/"/g, "'")}"`].join(',');
};
writeFileSync(`${OUT}-manifiesto.csv`, ['shipment_id,pack,metodo,venta,despachar_antes_de,producto']
  .concat(pdfs.flatMap((f) => porPdf.get(f).map(fila))).join('\n'));
console.log('manifiesto ->', `${OUT}-manifiesto.csv`);

// Assert de cierre: toda etiqueta pedida esta en un PDF (si no, quedaria marcada impresa y sin papel).
const enPdf = pdfs.reduce((a, f) => a + porPdf.get(f).length, 0);
if (enPdf !== sel.length) throw new Error(`pedi ${sel.length} etiquetas y arme ${enPdf}`);
console.log(`\ntotal en PDF: ${enPdf} de ${sel.length} pedidas | sin tocar: ${imprimibles.length - sel.length} fuera de la ventana + ${todo.length - imprimibles.length} de otros modos.`);

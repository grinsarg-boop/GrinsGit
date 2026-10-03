// Redespacho: da de alta guías NUEVAS (la vieja no se reusa: cada guía es única por estado)
// y baja las etiquetas. Fixy por REST, Urbano por SOAP. Uso:
//   set -a && . ./.env.local; set +a
//   node scripts/redespacho.mjs --courier fixy --pedidos 18267 --dry
//   node scripts/redespacho.mjs --courier fixy --pedidos 18267
//   node scripts/redespacho.mjs --courier urbano --pedidos 18106,18121
// Escribe scripts/../.redespacho-<courier>.json con lo creado (para no duplicar altas al reintentar).
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const DRY = process.argv.includes("--dry");
const COURIER = arg("courier");
const PEDIDOS = String(arg("pedidos", "")).split(",").map((s) => s.trim()).filter(Boolean);
if (!["fixy", "urbano"].includes(COURIER) || !PEDIDOS.length) {
  console.error("uso: --courier fixy|urbano --pedidos 18267,18273 [--dry] [--out DIR] [--marca R1] [--servicio B|E] [--cod N] [--unidades N] [--cp NNNN]");
  process.exit(1);
}
const OUT = arg("out", path.join(process.cwd(), "etiquetas"));
const LEDGER = path.join(process.cwd(), `.redespacho-${COURIER}.json`);

// ponytail: bulto nominal — el spray es siempre la misma caja. Si algún día se despacha otra cosa,
// esto sale de products.
const BULTO = { bultos: 1, peso: 0.4, alto: 0.1, largo: 0.2, profundidad: 0.1 };

const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")) : {};
const saveLedger = () => fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));

// --- datos del pedido desde Supabase
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const { rows } = await db.query(
  `select o.order_number, o.cod_amount, o.total,
          o.raw->'shipping_address'->>'name'      as nombre,
          coalesce(o.raw->'shipping_address'->>'phone', o.phone) as telefono,
          o.raw->'shipping_address'->>'address1'  as direccion,
          o.raw->'shipping_address'->>'address2'  as direccion2,
          o.raw->'shipping_address'->>'city'      as localidad,
          o.raw->'shipping_address'->>'zip'       as cp,
          o.raw->'shipping_address'->>'province'  as provincia,
          o.raw->>'email' as email,
          (select string_agg(oi.title_raw || ' x' || oi.qty, ' + ') from order_items oi where oi.order_id = o.id) as items,
          (select string_agg(distinct p.name, ' + ') from order_items oi join products p on p.id = oi.product_id
            where oi.order_id = o.id) as producto
     from orders o where o.order_number = any($1::text[]) order by o.order_number::int`,
  [PEDIDOS],
);
await db.end();
// Código de depósito (S3 = Arraigo x3) y unidades: de Shopify por el mismo camino que
// /logistica?t=preparar (lib/picking.ts, regla de Pancho del 28/09/2026). Antes salía de
// order_items, cuyo `pack` cuenta quantity (no ve los packs del bot de Veltron: "Lleva 3" con
// quantity 1 → P1) y con upper(left(name)), que a Arraigo le ponía A (es S: A es Altus).
const { tsImport } = await import("tsx/esm/api");
const { pickingOrders, codigoDeposito } = await tsImport("../lib/picking.ts", import.meta.url);
const { shopifyFetch } = await tsImport("../lib/shopify.ts", import.meta.url);
const shopify = new Map((await pickingOrders(PEDIDOS, shopifyFetch)).map((o) => [o.orden, o]));
for (const o of rows) {
  const c = codigoDeposito(shopify.get(o.order_number));
  o.marca_deposito = c.code;
  o.unidades = c.unidades;
  if (!c.code) console.error(`⚠️ ${o.order_number}: sin código de depósito — ${c.nota}`);
}
// --cod N / --unidades N: reenvío parcial o reposición (ej. 1 de 2 goteros con COD 0). Pisa la fila
// entera de la corrida (COD, unidades y marca de depósito P2→P1), así que va un pedido por corrida.
for (const o of rows) {
  if (arg("cod") !== undefined) o.cod_amount = Number(arg("cod"));
  if (arg("unidades") !== undefined) { o.unidades = Number(arg("unidades")); if (o.marca_deposito) o.marca_deposito = o.marca_deposito[0] + o.unidades; }
}
const faltan = PEDIDOS.filter((p) => !rows.some((r) => r.order_number === p));
if (faltan.length) { console.error("pedidos que no existen en la base:", faltan.join(",")); process.exit(1); }

// "Mariano acosta 2087" -> {calle:"Mariano acosta", altura:2087}. Sin número → altura 0, calle entera
// (Fixy la muestra igual; forzar un número inventado es peor que un 0 visible).
function partirDireccion(d) {
  const m = String(d ?? "").trim().match(/^(.*?)[\s,]+(\d+)\s*$/);
  return m ? { calle: m[1].trim(), altura: Number(m[2]) } : { calle: String(d ?? "").trim(), altura: 0 };
}
// Móvil argentino en formato internacional: +54 9 <área><número>. Sin el 9 el chofer no puede llamar.
const celular = (t) => { const n = String(t ?? "").replace(/\D/g, "").replace(/^54/, "").replace(/^9/, ""); return n ? `+549${n}` : ""; };

// ---------------- FIXY ----------------
const FX = (process.env.FIXY_API_URL ?? "https://fixy.epresis.com/").replace(/\/$/, "");
const fxPost = async (ep, body) => {
  const r = await fetch(`${FX}/api/v2/${ep}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_token: process.env.FIXY_API_TOKEN, ...body }),
  });
  const txt = await r.text();
  let json; try { json = JSON.parse(txt); } catch { json = { _raw: txt.slice(0, 400) }; }
  return { ok: r.ok, status: r.status, json };
};

// El remito es único de por vida en Fixy. Primer intento: el nº de pedido pelado, que es lo que
// busca el sync (`seguimiento.json` por remito = order_number). Si ya está tomado —o sea, es un
// redespacho— cae a -R, -R2… Mismo patrón que `pelar()` en urbano.ts: el nº de pedido se lee igual.
const remitoFixy = (pedido, intento) => intento === 1 ? String(pedido) : `${pedido}-R${intento > 2 ? intento - 1 : ""}`;

function bodyFixy(o, intento = 1) {
  const { calle, altura } = partirDireccion(o.direccion);
  return {
    codigo_sucursal: process.env.FIXY_SUCURSAL,
    codigo_servicio: String(process.env.FIXY_SERVICIO ?? "").padStart(3, "0"), // "2" del .env → "002": Fixy rechaza "2" (01/10/2026), Veltron usa "002" en el 100%
    internacional: false, isInversa: false, is_urgente: false,
    pago_en: "ORIGEN",           // el flete lo paga BioLabs; el cliente solo paga el contrareembolso
    tipo_operacion: "ENTREGA",
    canal: "API",
    remito: remitoFixy(o.order_number, intento),
    valor_declarado: Number(o.total),
    contrareembolso: Number(o.cod_amount),
    observaciones: arg("obs", ""),
    comprador: {
      destinatario: o.nombre, calle, altura,
      dpto: o.direccion2 || undefined,
      localidad: o.localidad, provincia: o.provincia, cp: Number(o.cp),
      email: o.email || undefined, celular: celular(o.telefono),
      contenido: o.items,
    },
    productos: [{
      bultos: BULTO.bultos, peso: BULTO.peso, descripcion: o.producto ?? "Producto",
      dimensiones: { alto: BULTO.alto, largo: BULTO.largo, profundidad: BULTO.profundidad },
    }],
  };
}

// ---------------- URBANO (SOAP) ----------------
const URB = (process.env.URBANO_API_URL ?? "https://apis.urbano.com.ar/").replace(/\/$/, "");
const xml = (s) => String(s ?? "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]));

// Estructura tomada del flujo que ya corre en producción (~/Downloads/core.js). Dos trampas que
// costaron dos códigos quemados:
//   · el servicio COD es "B" (no "E" ni "C"), y
//   · `valor`/`valorContrareembolso` van DENTRO de productos[]; en la raíz Urbano los ignora en
//     silencio y la etiqueta sale sin "Valor Contrareembolso".
function bodyUrbano(o) {
  const { calle, altura } = partirDireccion(o.direccion);
  return {
    productos: [{
      largo: 20, alto: 15, ancho: 15, peso: 1,     // cm/kg enteros, como el flujo de producción
      valor: 0,
      valorContrareembolso: Math.round(Number(o.cod_amount)),   // --cod ya aplicado sobre la fila
      cantidad: 1,
      descripcionProducto: o.producto ?? "Producto",
    }],
    destinatario: {
      nombre: String(o.nombre ?? "").slice(0, 40),
      email: o.email ? [o.email] : [],
      telefono: o.telefono ?? "", celular: o.telefono ?? "",
    },
    domicilio: {
      direccion: calle.slice(0, 45), altura: String(altura || "S/N").slice(0, 6),
      piso: "", departamento: String(o.direccion2 ?? "").slice(0, 6),
      // --cp fuerza el CP cuando Shopify lo trae roto ("S200", "0000"): Urbano rebota con
      // "Codigo Postal Invalido" y no hay forma de darlo de alta sin corregirlo.
      codigoPostal: Number(arg("cp", "") || String(o.cp).match(/\d{4}/)?.[0]), localidad: o.localidad, provincia: o.provincia,
    },
    // Campo de ENTRADA: acá se fija el tracking, y es único de por vida. Para rehacer una guía va
    // --marca R1 → BLABS<pedido>R1 (sufijo). Medido 20/09/2026: BLABS<n>R1 es pieza DISTINTA en
    // Urbano (BLABS20924 / BLABS20924R1 conviven) y es lo que Veltron y el sync entienden; la marca
    // adelante (BLABSR<n>, convención vieja) deja la guía invisible al sync: BLABSR18619 tiene 24
    // movimientos en Urbano y 0 filas en shipments. Lo que rebotaba con "Codigo Cliente Existente"
    // era la R sola (BLABS<pedido>R), no R1.
    codigoSeguimiento: `BLABS${o.order_number}${arg("marca", "")}`,
    servicio: arg("servicio", "B"),                 // B = contrareembolso
  };
}

function envelopeUrbano(b) {
  const p = (o, ind = "     ") => Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => typeof v === "object"
      ? `${ind}<${k}>\n${p(v, ind + "  ")}\n${ind}</${k}>`
      : `${ind}<${k}>${xml(v)}</${k}>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urb="http://apis.urbano.com.ar/index.php">
 <soapenv:Body>
  <urb:cargaCliente>
   <request>
     <autentificacion>
       <shipper>${Number(process.env.URBANO_SHIPPER)}</shipper>
       <password>${xml(process.env.URBANO_PASSWORD)}</password>
     </autentificacion>
${p(b)}
   </request>
  </urb:cargaCliente>
 </soapenv:Body>
</soapenv:Envelope>`;
}

async function existeEnUrbano(cod) {
  try {
    const r = await fetch(`${URB}/tracking/consultaTrackingMasivo/`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        autentificacion: { shipper: Number(process.env.URBANO_SHIPPER), password: process.env.URBANO_PASSWORD },
        datos: [{ codigoSeguimiento: cod }],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    return (await r.json())?.[0]?.codError === 0;
  } catch { return false; }
}

// Etiqueta Urbano: un PDF 10x15 por código. Reintenta y valida (a veces devuelve vacío).
async function etiquetaUrbano(cod) {
  const url = `https://www.urbano.com.ar/webservice/impresionEtiqueta/?tipo=special&shipper=${process.env.URBANO_SHIPPER}&codSeguimiento=${encodeURIComponent(cod)}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (r.ok) {
        const b = Buffer.from(await r.arrayBuffer());
        if (b.length >= 600 && b.subarray(0, 5).toString() === "%PDF-") return b;
      }
    } catch { /* reintenta */ }
    await new Promise((s) => setTimeout(s, 600 * (i + 1)));
  }
  return null;
}

// Combina en UN pdf, tamaño original, con "#pedido  2B" estampado arriba al centro (sin tapar el QR).
async function combinar(items, destino) {
  const merged = await PDFDocument.create();
  const font = await merged.embedFont(StandardFonts.HelveticaBold);
  const fallidos = [];
  for (const { pedido, bytes, marca } of items) {
    if (!bytes) { fallidos.push(pedido); continue; }
    const doc = await PDFDocument.load(bytes);
    if (!doc.getPageCount()) { fallidos.push(pedido); continue; }
    for (const pg of await merged.copyPages(doc, doc.getPageIndices())) {
      merged.addPage(pg);
      const { width, height } = pg.getSize();
      const sPed = 6, sMar = 11;                 // la marca va más grande: es lo que se lee de lejos
      const t = `#${pedido}`;
      const anchoPed = font.widthOfTextAtSize(t, sPed);
      const anchoMar = marca ? font.widthOfTextAtSize(`  ${marca}`, sMar) : 0;
      const x0 = (width - (anchoPed + anchoMar)) / 2;
      const y = height - sMar - 16;              // 16pt del borde: no toca el QR de arriba a la derecha
      pg.drawText(t, { x: x0, y: y + (sMar - sPed) / 2, size: sPed, font, color: rgb(0, 0, 0) });
      if (marca) pg.drawText(`  ${marca}`, { x: x0 + anchoPed, y, size: sMar, font, color: rgb(0, 0, 0) });
    }
  }
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, await merged.save());
  return { paginas: merged.getPageCount(), fallidos };
}

// ---------------- run ----------------
fs.mkdirSync(OUT, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);

if (DRY) {
  for (const o of rows) {
    console.log(JSON.stringify(COURIER === "fixy" ? bodyFixy(o) : bodyUrbano(o), null, 1));
    console.log(`# ${o.order_number} → código de depósito ${o.marca_deposito ?? "—"} (${o.unidades ?? "?"}u)`);
  }
  console.log(`\n[dry] ${rows.length} pedido(s), NO se envió nada.`);
  process.exit(0);
}

// --existentes: no da de alta nada, solo reimprime la guía que el pedido YA tiene en shipments.
// Sirve para las piezas trabadas en PI, que tienen guía viva y lo único que falta es la etiqueta.
const creados = [];
if (process.argv.includes("--existentes")) {
  const db2 = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db2.connect();
  const { rows: sh } = await db2.query(
    `select distinct on (s.order_ref) s.order_ref, s.tracking from shipments s
      where s.courier = $1 and s.order_ref = any($2::text[]) order by s.order_ref, s.dispatched_at desc nulls last`,
    [COURIER, PEDIDOS],
  );
  await db2.end();
  for (const p of PEDIDOS) {
    const g = sh.find((x) => x.order_ref === p);
    if (g) { creados.push({ pedido: p, guia: g.tracking }); continue; }
    // shipments va por detrás del sync: la guía puede existir en Urbano y todavía no en la base.
    const cod = ledger[p]?.guia ?? `BLABS${p}`;
    if (COURIER === "urbano" && await existeEnUrbano(cod)) { creados.push({ pedido: p, guia: cod }); continue; }
    console.error(`✗ ${p}: no tiene guía ni en shipments ni en el courier`);
  }
  console.log(`${creados.length} guías existentes a reimprimir`);
}

for (const o of process.argv.includes("--existentes") ? [] : rows) {
  if (ledger[o.order_number]) { console.log(`= ${o.order_number} ya tenía guía ${ledger[o.order_number].guia} (ledger) — salteado`); creados.push(ledger[o.order_number]); continue; }
  let res;
  if (COURIER === "fixy") {
    let r, intento = 1;
    do {                                            // -R tomado (redespacho anterior) → -R2, -R3…
      r = await fxPost("guias.json", bodyFixy(o, intento));
    } while (!r.json?.guia && /remito ya se encuentra registrado/i.test(r.json?.message ?? "") && ++intento <= 5);
    if (!r.ok || !r.json?.guia) { console.error(`✗ ${o.order_number}:`, JSON.stringify(r.json).slice(0, 300)); continue; }
    res = { pedido: o.order_number, remito: remitoFixy(o.order_number, intento), guia: String(r.json.guia), flete: r.json.importe, zona: r.json.sub_zona_destino };
  } else {
    const b = bodyUrbano(o);
    // cargaCliente crea la pieza pero a veces no cierra la respuesta. Si vence el timeout NO es un
    // fallo: hay que preguntarle al tracking si la pieza existe, o se duplica el intento a ciegas.
    let cod;
    try {
      const r = await fetch(`${URB}/cargaCliente/`, {
        method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ ...b, autentificacion: { shipper: Number(process.env.URBANO_SHIPPER), password: process.env.URBANO_PASSWORD } }),
        signal: AbortSignal.timeout(25_000),
      });
      const j = await r.json().catch(() => ({}));
      cod = j.codError ?? j.codigoError ?? -99;
      if (![0, 8, 11].includes(cod)) { console.error(`✗ ${o.order_number}: [${cod}] ${j.descError ?? JSON.stringify(j).slice(0, 200)}`); continue; }
    } catch {
      cod = (await existeEnUrbano(b.codigoSeguimiento)) ? 0 : null;
      if (cod === null) { console.error(`✗ ${o.order_number}: sin respuesta y la pieza no existe`); continue; }
      console.log(`  (${o.order_number}: la respuesta no cerró, pero la pieza existe)`);
    }
    res = { pedido: o.order_number, guia: b.codigoSeguimiento, resultado: cod === 0 ? "OK" : `ya existía (codError ${cod})` };
  }
  ledger[o.order_number] = res; saveLedger();
  creados.push(res);
  console.log(`✓ ${o.order_number} → guía ${res.guia}${res.flete != null ? ` · flete ${res.flete}` : ""}`);
}

if (!creados.length) { console.error("no se creó ninguna guía"); process.exit(1); }

// --- etiquetas
const destino = path.join(OUT, `etiquetas-${COURIER}-${stamp}.pdf`);
if (COURIER === "fixy") {
  // OJO: los endpoints de impresión son form-data, NO JSON. Con JSON devuelven 500.
  // (guias.json sí acepta JSON — es la excepción, no la regla.)
  const fd = new FormData();
  fd.set("api_token", process.env.FIXY_API_TOKEN);
  fd.set("tipo", "custom");
  fd.set("nombre", "FIXYPAY QR");           // la única plantilla del cliente (POST /api/v2/etiquetas-cliente)
  fd.set("is_remito", "false");
  fd.set("ides", JSON.stringify(creados.map((c) => Number(c.guia))));
  const r = await fetch(`${FX}/api/v2/print-etiquetas-custom`, { method: "POST", body: fd });
  const raw = await r.text();
  if (!r.ok || !/<html/i.test(raw)) { console.error("print-etiquetas-custom falló:", raw.slice(0, 300)); process.exit(1); }
  const tmp = path.join(OUT, `.guias-${stamp}.html`);
  fs.writeFileSync(tmp, raw.replace(/<\/head>/i, "<style>body{margin:0}</style></head>"));
  const { htmlToPdf } = await import("./html2pdf.mjs");
  await htmlToPdf(tmp, destino, 10, 15);        // 10x15 real, una etiqueta por página
  fs.unlinkSync(tmp);
  console.log(`etiquetas → ${destino}`);
} else {
  // El depósito arma por cantidad de unidades, así que las páginas salen en ese orden (2B antes
  // que 3B) y no en el de los pedidos.
  const porPedido = new Map(rows.map((o) => [o.order_number, o]));
  const orden = [...creados].sort((a, b) => {
    const x = porPedido.get(a.pedido) ?? {}, y = porPedido.get(b.pedido) ?? {};
    return (Number(x.unidades ?? 0) - Number(y.unidades ?? 0))
        || String(x.marca_deposito ?? "").localeCompare(String(y.marca_deposito ?? ""))
        || Number(a.pedido) - Number(b.pedido);
  });
  const items = [];
  for (const c of orden) items.push({ pedido: c.pedido, marca: porPedido.get(c.pedido)?.marca_deposito, bytes: await etiquetaUrbano(c.guia) });
  const { paginas, fallidos } = await combinar(items, destino);
  console.log(`etiquetas → ${destino} · ${paginas} página(s)${fallidos.length ? ` · FALLARON: ${fallidos.join(",")}` : ""}`);
}
console.log(`ledger: ${LEDGER}`);

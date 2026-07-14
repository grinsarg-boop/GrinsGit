// Receta "Carga masiva Mi Correo" del vault (Operaciones-COD, validada 13/07,
// 41 pedidos sin rechazo): ;-separado, 21 columnas, ASCII puro, CRLF, peso con
// punto, CP de 4 dígitos, provincia = letra patente, área de cel de 4 dígitos
// → envío a sucursal.

import { matchProduct } from "./product-match";

export const CORREO_HEADER =
  "tipo_producto(obligatorio);largo(obligatorio en CM);ancho(obligatorio en CM);altura(obligatorio en CM);peso(obligatorio en KG);valor_del_contenido(obligatorio en pesos argentinos);provincia_destino(obligatorio);sucursal_destino(obligatorio solo en caso de no ingresar localidad de destino);localidad_destino(obligatorio solo en caso de no ingresar sucursal de destino);calle_destino(obligatorio solo en caso de no ingresar sucursal de destino);altura_destino(obligatorio solo en caso de no ingresar sucursal de destino);piso(opcional solo en caso de no ingresar sucursal de destino);dpto(opcional solo en caso de no ingresar sucursal de destino);codpostal_destino(obligatorio solo en caso de no ingresar sucursal de destino);destino_nombre(obligatorio);destino_email(obligatorio, debe ser un email valido);cod_area_tel(opcional);tel(opcional);cod_area_cel(obligatorio);cel(obligatorio);numero_orden(opcional)";

export const PROVINCIAS = new Set("ABCDEFGHJKLMNPQRSTUVWXYZ".split(""));

// Códigos de área de 3 dígitos (ENACOM). Todo lo que no sea 11 ni esté acá es
// de 4 dígitos → el pedido va a sucursal (regla 9 de la receta).
const AREAS_3 = new Set([
  "220", "221", "223", "230", "236", "237", "260", "261", "263", "264", "266",
  "280", "291", "294", "297", "298", "299", "336", "341", "342", "343", "345",
  "348", "351", "353", "358", "362", "364", "370", "376", "379", "380", "381",
  "383", "385", "387", "388",
]);

export function asciiStrip(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\x00-\x7F]/g, "");
}

export function cp4(zip: string): string {
  return zip.match(/\d{4}/)?.[0] ?? "";
}

// +54 9? 0? área + (15)? local → { area, cel }. 10 dígitos totales (área+local).
export function splitPhone(raw: string): { area: string; cel: string } | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("54")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("9")) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length !== 10) return null;
  const area = d.startsWith("11") ? "11" : AREAS_3.has(d.slice(0, 3)) ? d.slice(0, 3) : d.slice(0, 4);
  let cel = d.slice(area.length);
  if (cel.startsWith("15") && cel.length > 8) cel = cel.slice(2);
  return { area, cel };
}

export type CorreoRow = {
  valor: string; // entero en pesos
  provincia: string; // letra patente
  sucursal: string; // vacío = envío a domicilio
  localidad: string;
  calle: string;
  altura: string;
  piso: string;
  dpto: string;
  cp: string;
  nombre: string;
  email: string;
  area: string;
  cel: string;
  orden: string;
};

export function needsSucursal(row: CorreoRow): boolean {
  return row.area.length === 4 && !row.sucursal;
}

export function toSucursal(row: CorreoRow, codigo: string): CorreoRow {
  return { ...row, sucursal: codigo, localidad: "", calle: "", altura: "", piso: "", dpto: "", cp: "" };
}

function clean(s: string): string {
  return asciiStrip(s).replace(/\s+/g, " ").trim();
}

export function normalizeRow(row: CorreoRow): CorreoRow {
  return {
    ...row,
    valor: row.valor.replace(/\D/g, ""),
    provincia: clean(row.provincia).toUpperCase(),
    sucursal: clean(row.sucursal).toUpperCase(),
    localidad: clean(row.localidad),
    calle: clean(row.calle),
    // altura sin número → vacío (nunca "S/n" con barra)
    altura: /\d/.test(row.altura) ? clean(row.altura) : "",
    piso: clean(row.piso),
    dpto: clean(row.dpto),
    cp: row.sucursal ? "" : cp4(row.cp),
    nombre: clean(row.nombre),
    email: asciiStrip(row.email).replace(/\s+/g, ""),
    area: row.area.replace(/\D/g, ""),
    cel: row.cel.replace(/\D/g, ""),
    orden: row.orden.replace(/\D/g, ""),
  };
}

// Errores que harían que el importador rechace la fila (self-check paso 11).
export function rowErrors(r: CorreoRow): string[] {
  const e: string[] = [];
  if (!/^\d+$/.test(r.valor)) e.push("valor no numérico");
  if (!PROVINCIAS.has(r.provincia)) e.push(`provincia "${r.provincia}" fuera de tabla`);
  if (r.sucursal) {
    if (r.localidad || r.calle || r.altura || r.cp) e.push("sucursal con campos de domicilio");
  } else {
    if (!r.localidad || !r.calle) e.push("falta localidad o calle");
    if (!/^\d{4}$/.test(r.cp)) e.push(`CP "${r.cp}" no es de 4 dígitos`);
  }
  if (!r.nombre) e.push("falta nombre");
  if (!r.email.includes("@") || /\s/.test(r.email)) e.push(`email inválido "${r.email}"`);
  if (!/^\d{2,4}$/.test(r.area) || !/^\d{6,8}$/.test(r.cel)) e.push("cel inválido");
  if (needsSucursal(r)) e.push(`área ${r.area} de 4 dígitos → elegir sucursal`);
  const line = toLine(r);
  if (/[^\x00-\x7F]/.test(line)) e.push("caracteres no-ASCII");
  if (line.split(";").length !== 21) e.push("no son 21 columnas");
  return e;
}

function toLine(r: CorreoRow): string {
  return [
    "CP", "12", "12", "12", "0.2", r.valor, r.provincia, r.sucursal, r.localidad,
    r.calle, r.altura, r.piso, r.dpto, r.cp, r.nombre, r.email, "", "", r.area,
    r.cel, r.orden,
  ].join(";");
}

export function parseCsv(text: string): CorreoRow[] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("tipo_producto"))
    .map((l) => {
      const c = l.split(";");
      return {
        valor: c[5] ?? "", provincia: c[6] ?? "", sucursal: c[7] ?? "",
        localidad: c[8] ?? "", calle: c[9] ?? "", altura: c[10] ?? "",
        piso: c[11] ?? "", dpto: c[12] ?? "", cp: c[13] ?? "",
        nombre: c[14] ?? "", email: c[15] ?? "", area: c[18] ?? "",
        cel: c[19] ?? "", orden: c[20] ?? "",
      };
    });
}

// Salida final: header textual de la plantilla + CRLF en cada línea, ASCII puro.
export function buildCsv(rows: CorreoRow[]): string {
  const bad = rows.flatMap((r, i) => rowErrors(r).map((e) => `fila ${i + 1}: ${e}`));
  if (bad.length) throw new Error(bad.join(" · "));
  return [CORREO_HEADER, ...rows.map(toLine)].join("\r\n") + "\r\n";
}

// Pedido de Shopify (lo que devuelve /api/correo/pedidos) → fila del CSV.
export type ShopifyPedido = {
  orden: string;
  nombre: string;
  email: string;
  telefono: string;
  total: string;
  provincia: string; // province_code de Shopify = letra patente
  localidad: string;
  address1: string;
  address2: string;
  zip: string;
  producto: string | null; // "BeeVenom" | "Natures" | ...
  qty: number;
};

// Producto+cantidad para la etiqueta: solo si TODOS los ítems son el MISMO producto; carrito mixto
// (o sin match) → producto null (código en blanco, se completa a mano) en vez de rotular mal con el
// 1er ítem y la qty total del pedido (audit C#3).
export function pickProducto(
  items: { title: string; quantity: number }[],
): { producto: string | null; qty: number } {
  const matched = items.map((x) => ({ p: matchProduct(x.title), q: x.quantity ?? 0 }));
  const productos = [...new Set(matched.map((m) => m.p).filter(Boolean))] as string[];
  const producto = productos.length === 1 ? productos[0] : null;
  const qty = producto
    ? matched.filter((m) => m.p === producto).reduce((n, m) => n + m.q, 0)
    : matched.reduce((n, m) => n + m.q, 0);
  return { producto, qty };
}

// B3 = BeeVenom x3. La letra sale del nombre canónico de product-match.
export function productoCode(p: ShopifyPedido): string | null {
  return p.producto ? `${p.producto[0].toUpperCase()}${p.qty}` : null;
}

export function pedidoToRow(p: ShopifyPedido): CorreoRow {
  const phone = splitPhone(p.telefono);
  const a1 = p.address1.trim();
  const a2 = p.address2.trim();
  // Este checkout suele mandar calle en address1 y altura en address2.
  const [calle, altura, piso] = /^\d+$/.test(a2)
    ? [a1, a2, ""]
    : /^(.*\S)\s+(\d+)$/.test(a1)
      ? [a1.replace(/\s+\d+$/, ""), a1.match(/(\d+)$/)![1], a2]
      : [`${a1} ${a2}`, "", ""];
  return normalizeRow({
    valor: p.total.split(".")[0],
    provincia: p.provincia,
    sucursal: "",
    localidad: p.localidad,
    calle, altura, piso,
    dpto: "",
    cp: p.zip,
    nombre: p.nombre,
    email: p.email,
    area: phone?.area ?? "",
    cel: phone?.cel ?? "",
    orden: p.orden,
  });
}

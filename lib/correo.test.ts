import { describe, expect, it } from "vitest";
import {
  buildCsv, needsSucursal, normalizeRow, parseCsv, pedidoToRow, pickProducto, productoCode,
  rowErrors, splitPhone, toSucursal,
} from "./correo";

describe("pickProducto (etiqueta: no rotular mal carritos mixtos)", () => {
  it("un solo producto → ese producto + suma de su qty", () => {
    expect(pickProducto([{ title: "Natures x2", quantity: 2 }])).toEqual({ producto: "Natures", qty: 2 });
  });
  it("mismo producto en 2 líneas → suma qty", () => {
    expect(pickProducto([{ title: "Natures", quantity: 1 }, { title: "natures pack", quantity: 2 }]))
      .toEqual({ producto: "Natures", qty: 3 });
  });
  it("carrito MIXTO → producto null (se completa a mano), qty = total", () => {
    expect(pickProducto([{ title: "Natures", quantity: 1 }, { title: "Pureza", quantity: 2 }]))
      .toEqual({ producto: null, qty: 3 });
  });
  it("ignora líneas sin match (envío/regalo) al elegir el producto único", () => {
    expect(pickProducto([{ title: "BeeVenom", quantity: 3 }, { title: "Envío gratis", quantity: 1 }]))
      .toEqual({ producto: "BeeVenom", qty: 3 });
  });
  it("sin ningún match → producto null", () => {
    expect(pickProducto([{ title: "Envío", quantity: 1 }])).toEqual({ producto: null, qty: 1 });
  });
});

const pedido = {
  orden: "16072", nombre: "Alexx Ross", email: "superspains@hotmail.com",
  telefono: "+541157076989", total: "48990.00", provincia: "B",
  localidad: "Berazategui", address1: "Av 14", address2: "2325",
  zip: "1884", producto: "Natures", qty: 2,
};

describe("correo", () => {
  it("splitPhone: 2, 3 y 4 dígitos de área", () => {
    expect(splitPhone("+541157076989")).toEqual({ area: "11", cel: "57076989" });
    expect(splitPhone("+542213167516")).toEqual({ area: "221", cel: "3167516" });
    expect(splitPhone("+5492224534184")).toEqual({ area: "2224", cel: "534184" });
    expect(splitPhone("123")).toBeNull();
  });

  it("pedidoToRow arma la fila válida desde Shopify", () => {
    const row = pedidoToRow(pedido);
    expect(rowErrors(row)).toEqual([]);
    expect(row).toMatchObject({
      valor: "48990", provincia: "B", calle: "Av 14", altura: "2325",
      cp: "1884", area: "11", cel: "57076989", orden: "16072",
    });
    expect(productoCode(pedido)).toBe("N2");
  });

  it("área de 4 dígitos exige sucursal y la deriva limpia domicilio", () => {
    const row = pedidoToRow({ ...pedido, telefono: "+542224534184" });
    expect(needsSucursal(row)).toBe(true);
    expect(rowErrors(row).join()).toContain("sucursal");
    const suc = toSucursal(row, "OAR");
    expect(rowErrors(suc)).toEqual([]);
    expect(suc.cp).toBe("");
  });

  it("normaliza no-ASCII, CPA y email con espacios; CSV sale CRLF", () => {
    const row = pedidoToRow({
      ...pedido, nombre: "María Luján", localidad: "Junín",
      email: "a b@gmail.com", zip: "B8183AQD",
    });
    expect(row.nombre).toBe("Maria Lujan");
    expect(row.localidad).toBe("Junin");
    expect(row.email).toBe("ab@gmail.com");
    expect(row.cp).toBe("8183");
    const csv = buildCsv([row]);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.split("\r\n")[1].split(";").length).toBe(21);
    expect(Math.max(...[...csv].map((ch) => ch.charCodeAt(0)))).toBeLessThan(128);
  });

  it("parseCsv + normalización de un borrador re-arma filas válidas", () => {
    const draft = "CP;12;12;12;0.2;49990;B;;Maipú;Julián linch;486;;;7160;Cristina migel;vivero@gmail.com;;;226;8518627;16763";
    const fixed = parseCsv(draft).map(normalizeRow);
    expect(rowErrors(fixed[0])).toEqual([]);
    expect(fixed[0].localidad).toBe("Maipu");
  });

  it("localidad con signos (Mi Correo solo acepta letras y números)", () => {
    // fila 5 real: "Perico _el carmen" hacía rechazar la carga masiva
    const draft = "CP;12;12;12;0.2;49990;Y;;Perico _el carmen;Fca flores;7;;;4608;Laura Flores;lantoju@gmail.com;;;388;5909332;17060";
    const fixed = parseCsv(draft).map(normalizeRow);
    expect(fixed[0].localidad).toBe("Perico el carmen");
    expect(rowErrors(fixed[0])).toEqual([]);
  });

  it("calle con signos (Correo rechaza . / en texto, no solo en localidad)", () => {
    // fila real 17104: "B. Roldan e/ingenieros y echeverria" hacía rechazar TODO el archivo
    const draft = "CP;12;12;12;0.2;48999;B;;Ensenada;B. Roldan e/ingenieros y echeverria;61;;;1925;Gustavo Roldan;gustavoaleroldan@hotmail.com;;;221;6012040;17104";
    const fixed = parseCsv(draft).map(normalizeRow);
    expect(fixed[0].calle).toBe("B Roldan e ingenieros y echeverria");
    expect(rowErrors(fixed[0])).toEqual([]);
    expect(() => buildCsv(fixed)).not.toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { csvTrabados, type TrabadoRow } from "./trabados-tabla";

const row = (o: Partial<TrabadoRow>): TrabadoRow => ({
  courier: "urbano", tracking: "123", order_number: "10298", customer_name: "Ana",
  province: "Salta", product: "Natures", cod_amount: 49980, dispatched_at: "2026-05-20",
  status_canonical: "en_transito", status_raw: "IF", last_move: "2026-05-22T10:00:00+00:00",
  dias: 59, href: null, ...o,
});

describe("csvTrabados", () => {
  it("arma el CSV con ; CRLF y fechas dd/mm/yyyy", () => {
    const csv = csvTrabados([row({})]);
    const [head, linea] = csv.split("\r\n");
    expect(head).toBe("guia;pedido;cliente;provincia;producto;cod_pendiente;fecha_despacho;ultimo_estado;estado_raw;fecha_ultimo_estado;dias_sin_movimiento");
    expect(linea).toBe("123;10298;Ana;Salta;Natures;49980;20/05/2026;en_transito;IF;22/05/2026;59");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("escapa valores con ; o comillas", () => {
    const csv = csvTrabados([row({ customer_name: 'Pérez; "Toto"' })]);
    expect(csv).toContain('"Pérez; ""Toto"""');
  });
});

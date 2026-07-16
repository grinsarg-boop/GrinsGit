import { describe, expect, it } from "vitest";
import { CICLO_STATUS, parseUrbanoMasivo, parseUrbanoResponse } from "./urbano";

// R7 — mock con responses REALES del WS (datos/urbano_ws_samples/, entity-encoded tal cual).
// El <tr data="{...}"> es la única parte que el parser lee; embebida acá para no depender
// de archivos gitignoreados.
const trRC =
  '<tr data="{&quot;producto&quot;:&quot;PQ&quot;,&quot;shipper&quot;:&quot;004362&quot;,' +
  '&quot;cliCodigo&quot;:&quot;6854687555824&quot;,&quot;gui_numero&quot;:&quot;231556548&quot;,' +
  '&quot;linea&quot;:&quot;LL - LOGISTICA LIVIANA&quot;,&quot;proCodigo&quot;:&quot;PQ - PAQUETERIA&quot;,' +
  '&quot;servicio&quot;:&quot;CONTRA-REEMBOLSO&quot;,&quot;ciclo&quot;:&quot;01-05-2026&quot;,' +
  '&quot;estado&quot;:&quot;RC - Conformes y devoluciones rendidos al remitente&quot;,' +
  '&quot;fechaEstado&quot;:&quot;06-05-2026&quot;}" class="registro"><td>...</td></tr>';

// estado con descripción vacía ("DL - ") — debe normalizar y no romper.
const trDL =
  '<tr data="{&quot;cliCodigo&quot;:&quot;6870864625904&quot;,&quot;gui_numero&quot;:&quot;231542380&quot;,' +
  '&quot;ciclo&quot;:&quot;04-05-2026&quot;,&quot;estado&quot;:&quot;DL - &quot;,' +
  '&quot;fechaEstado&quot;:&quot;08-05-2026&quot;}" class="registro"><td>...</td></tr>';

const page = (tr: string) => `<html><body><table><tbody>${tr}</tbody></table></body></html>`;

describe("parseUrbanoResponse", () => {
  it("emite despacho (ciclo) + estado actual, tracking = cli_codigo, gui en raw", () => {
    const ev = parseUrbanoResponse(page(trRC), "6854687555824");
    expect(ev).toHaveLength(2);

    const [desp, estado] = ev;
    expect(desp.status_raw).toBe(CICLO_STATUS);
    expect(desp.occurred_at).toBe("2026-05-01T12:00:00Z"); // ciclo
    expect(estado.status_raw).toBe("RC"); // código extraído, no la descripción del WS
    expect((estado.raw as { estado_desc: string }).estado_desc)
      .toBe("RC - Conformes y devoluciones rendidos al remitente");
    expect(estado.occurred_at).toBe("2026-05-06T12:00:00Z"); // fechaEstado

    // Opción A: tracking = id Shopify; gui_numero real en raw
    for (const e of ev) {
      expect(e.courier).toBe("urbano");
      expect(e.tracking).toBe("6854687555824");
      expect(e.order_ref).toBe("6854687555824");
      expect((e.raw as { gui_numero: string }).gui_numero).toBe("231556548");
    }
  });

  it('extrae el código con desc vacía ("DL - " → "DL")', () => {
    const ev = parseUrbanoResponse(page(trDL), "6870864625904");
    expect(ev.map((e) => e.status_raw)).toEqual([CICLO_STATUS, "DL"]);
  });

  it("guía inexistente (sin filas) → []", () => {
    expect(parseUrbanoResponse("<html><body>sin resultados</body></html>", "999")).toEqual([]);
  });
});

// API masiva (transporte del sync incremental). Response REAL de consultaTrackingMasivo embebida.
const masivoRC = {
  codGestion: "6865945526512", codError: 0, descError: "", producto: "PQ - PAQUETERIA",
  fecha: "06-05-2026", estado: "RC - Conformes y devoluciones rendidos al remitente",
  movimientos: [
    { check: "PI", codigo_motivo: null, descripcion: "Recibimos la informacion de su pedido", checkFecha: "02-05-2026", hora: "19:36" },
    { check: "MA", codigo_motivo: null, descripcion: "Su envio esta preparado para salir a distribucion", checkFecha: "13-05-2026", hora: "15:35" },
    { check: "LD", codigo_motivo: null, descripcion: "Su envio esta en camino", checkFecha: "13-05-2026", hora: "20:33" },
    { check: "RC", codigo_motivo: null, descripcion: "Conformes y devoluciones rendidos al remitente", checkFecha: "06-06-2026", hora: "10:00" },
  ],
};
const masivoInexistente = { codGestion: "999999999999", codError: 5, descError: "Pieza postal inexistente." };

describe("parseUrbanoMasivo", () => {
  it("emite despacho sintético en `fecha` (=ciclo) + un evento por movimiento, tracking = codGestion", () => {
    const ev = parseUrbanoMasivo(masivoRC, "6865945526512");
    const [desp, ...movs] = ev;
    expect(desp.status_raw).toBe(CICLO_STATUS);
    expect(desp.occurred_at).toBe("2026-05-06T12:00:00Z"); // ciclo = fecha
    expect(movs.map((e) => e.status_raw)).toEqual(["PI", "MA", "LD", "RC"]); // `check` = código, sin split
    expect(movs[0].occurred_at).toBe("2026-05-02T12:00:00Z"); // checkFecha
    expect(movs.at(-1)!.status_raw).toBe("RC"); // último = estado actual (→ devuelto por 005)
    for (const e of ev) {
      expect(e.courier).toBe("urbano");
      expect(e.tracking).toBe("6865945526512");
      expect(e.order_ref).toBe("6865945526512");
    }
  });

  it("pieza inexistente (codError<>0) → []", () => {
    expect(parseUrbanoMasivo(masivoInexistente, "999999999999")).toEqual([]);
  });

  // Bug de madurez: Urbano reporta estado="RM - Rendido a Matriz" (autoritativo) pero el último
  // movimiento sincronizado es AR → sin esto quedaba en_transito. El estado se emite como evento
  // al cierre del día del último movimiento (23:59 > 12:00) → gana el "último por occurred_at".
  const masivoRM = {
    codGestion: "700", codError: 0, producto: "PQ", fecha: "01-06-2026",
    estado: "RM - Rendido a Matriz",
    movimientos: [
      { check: "CO", descripcion: "Contenerizado", checkFecha: "05-06-2026" },
      { check: "AR", descripcion: "Su envio llego a la sucursal de destino", checkFecha: "07-06-2026" },
    ],
  };
  it("estado autoritativo más avanzado que el último movimiento → evento sintético que gana", () => {
    const ev = parseUrbanoMasivo(masivoRM, "700");
    const last = ev.at(-1)!;
    expect(last.status_raw).toBe("RM");
    expect(last.occurred_at).toBe("2026-06-07T23:59:59Z"); // fin del día del último movimiento (AR)
    expect((last.raw as { sintetico?: string }).sintetico).toBe("estado");
  });

  it('estado que coincide con el último movimiento único o vacío (" - ") → sin evento sintético', () => {
    expect(parseUrbanoMasivo(masivoRC, "6865945526512").filter((e) => (e.raw as { sintetico?: string }).sintetico)).toHaveLength(0);
    expect(parseUrbanoMasivo({ ...masivoRM, estado: " - " }, "700").filter((e) => (e.raw as { sintetico?: string }).sintetico)).toHaveLength(0);
  });

  // Caso real 51638: RM/DV/AR el MISMO día (todo 12:00Z) → el ingest elegía AR (en_transito) por
  // desempate arbitrario, aunque estado="RM - Rendido a Matriz". El estado gana con 23:59.
  const masivoTie = {
    codGestion: "800", codError: 0, producto: "PQ", fecha: "02-06-2026",
    estado: "RM - Rendido a Matriz",
    movimientos: [
      { check: "DV", descripcion: "Mal codificado", checkFecha: "04-06-2026" },
      { check: "RM", descripcion: "Rendido a Matriz", checkFecha: "04-06-2026" },
      { check: "AR", descripcion: "Su envio llego a la sucursal de destino", checkFecha: "04-06-2026" },
    ],
  };
  it("empate el mismo día → el estado autoritativo gana aunque haya un movimiento en_transito posterior", () => {
    const ev = parseUrbanoMasivo(masivoTie, "800");
    const last = ev.at(-1)!;
    expect(last.status_raw).toBe("RM");
    expect(last.occurred_at).toBe("2026-06-04T23:59:59Z");
    expect((last.raw as { sintetico?: string }).sintetico).toBe("estado");
  });
});

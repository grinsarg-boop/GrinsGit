import { describe, expect, it } from "vitest";
import { CICLO_STATUS, parseUrbanoResponse } from "./urbano";

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
    expect(estado.status_raw).toBe("RC - Conformes y devoluciones rendidos al remitente");
    expect(estado.occurred_at).toBe("2026-05-06T12:00:00Z"); // fechaEstado

    // Opción A: tracking = id Shopify; gui_numero real en raw
    for (const e of ev) {
      expect(e.courier).toBe("urbano");
      expect(e.tracking).toBe("6854687555824");
      expect(e.order_ref).toBe("6854687555824");
      expect((e.raw as { gui_numero: string }).gui_numero).toBe("231556548");
    }
  });

  it('normaliza estado con desc vacía ("DL - " → "DL -")', () => {
    const ev = parseUrbanoResponse(page(trDL), "6870864625904");
    expect(ev.map((e) => e.status_raw)).toEqual([CICLO_STATUS, "DL -"]);
  });

  it("guía inexistente (sin filas) → []", () => {
    expect(parseUrbanoResponse("<html><body>sin resultados</body></html>", "999")).toEqual([]);
  });
});

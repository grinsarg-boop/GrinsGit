import { describe, expect, it } from "vitest";
import { buildRescateBody, rescateUrbano } from "./urbano-ops";

// El body operativo se manda tal cual a Urbano: si el shape se desalinea, redirige mal un envío real.
// Este check fija el contrato (sin red, sin env). auth NO va acá (se agrega server-side en el envío).
describe("buildRescateBody", () => {
  it("redireccionamiento: pieces + destinatario + domicilio, descarta opcionales vacíos", () => {
    const body = buildRescateBody({
      tipo: "redireccionamiento", piece: "231556548", nombre: "Juana Perez",
      domicilio: {
        direccion: "España", altura: "2759", codigoPostal: "5000", localidad: "Córdoba",
        provincia: "Córdoba", piso: "", departamento: "", observaciones: "dejar en portería",
      },
    });
    expect(body).toEqual({
      pieces: ["231556548"],
      tipoRescate: "redireccionamiento",
      destinatario: { nombre: "Juana Perez" },
      domicilio: {
        direccion: "España", altura: "2759", codigoPostal: "5000",
        localidad: "Córdoba", provincia: "Córdoba", observaciones: "dejar en portería",
      },
    });
  });

  it("redireccionamiento: incluye piso/depto cuando vienen", () => {
    const body = buildRescateBody({
      tipo: "redireccionamiento", piece: "1", nombre: "N",
      domicilio: { direccion: "A", altura: "1", codigoPostal: "1000", localidad: "L", provincia: "P", piso: "3", departamento: "B" },
    }) as { domicilio: Record<string, string> };
    expect(body.domicilio.piso).toBe("3");
    expect(body.domicilio.departamento).toBe("B");
    expect("observaciones" in body.domicilio).toBe(false);
  });

  it("devolucion: solo pieces + tipoRescate", () => {
    expect(buildRescateBody({ tipo: "devolucion", piece: "231556548" })).toEqual({
      pieces: ["231556548"], tipoRescate: "devolucion",
    });
  });
});

// /wbs/rescate/ da 404 (medido 30/09/2026): el botón de /trabados falló siempre sin que nada lo marcara.
it("rescateUrbano apunta a POST /rescate/ (doc 06-03-2026), no a /wbs/rescate/", async () => {
  const r = await rescateUrbano({ tipo: "devolucion", piece: "BLABS1" }, { dryRun: true });
  expect(r.dryRun && new URL(r.url).pathname).toBe("/rescate/");
});

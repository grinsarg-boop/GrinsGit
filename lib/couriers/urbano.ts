import type { CourierClient } from "./types";

// ponytail: portar la llamada del script Python del dueño (SPEC §10.2).
// Cuando llegue: env URBANO_WS_URL/USER/PASS; si el WS es SOAP/XML, usar fast-xml-parser.
// El route handler ya batchea ≤200 guías y loguea el sync_run — solo falta este fetch.
export const urbano: CourierClient = {
  async fetchStatuses() {
    throw new Error(
      "Urbano WS sin implementar: falta el script Python del dueño (SPEC §10.2)",
    );
  },
};

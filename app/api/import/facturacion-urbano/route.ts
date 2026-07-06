import * as XLSX from "xlsx";
import { badCronAuth, logSyncRun, supabaseAdmin } from "@/lib/supabase";

// Facturación Urbano (llega con ~2 semanas de lag, §4.1/§5.5): pisa el flete estimado
// y recalcula el P&L del rango afectado (lo hace el RPC import_urbano_freight).
// multipart field "file", CSV o XLSX con columnas guía + tarifa.
export async function POST(req: Request) {
  const unauth = badCronAuth(req);
  if (unauth) return unauth;

  try {
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) {
      return Response.json({ ok: false, error: 'falta el campo "file"' }, { status: 400 });
    }
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
    if (!rows.length) return Response.json({ ok: false, error: "archivo vacío" }, { status: 400 });

    // ponytail: detección de columnas por keyword — ajustar contra una facturación real
    const keys = Object.keys(rows[0]);
    const col = (...kws: string[]) =>
      keys.find((k) => kws.some((kw) => k.toLowerCase().includes(kw)));
    const cTracking = col("guia", "guía", "tracking", "envio", "envío", "pieza");
    const cTarifa = col("tarifa", "importe", "flete", "total");
    if (!cTracking || !cTarifa) {
      throw new Error(`faltan columnas guía/tarifa. Headers: ${keys.join(", ")}`);
    }

    const p = rows.flatMap((r) => {
      const tracking = String(r[cTracking] ?? "").trim();
      const tarifa = typeof r[cTarifa] === "number"
        ? (r[cTarifa] as number)
        : parseFloat(String(r[cTarifa]).replace(/\./g, "").replace(",", "."));
      return tracking && !isNaN(tarifa) ? [{ tracking, tarifa }] : [];
    });

    const { data: updated, error } = await supabaseAdmin().rpc("import_urbano_freight", { p });
    if (error) throw new Error(error.message);
    await logSyncRun("facturacion-urbano", "ok", updated ?? 0);
    return Response.json({ ok: true, filas: p.length, actualizadas: updated ?? 0 });
  } catch (e) {
    await logSyncRun("facturacion-urbano", "error", 0, [], String(e));
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

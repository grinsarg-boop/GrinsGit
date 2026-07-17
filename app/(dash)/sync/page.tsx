import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { Tip } from "@/components/ui/tooltip";
import { SyncRun } from "@/components/sync-run";
import { FlexUpload, type FlexResult } from "@/components/flex-upload";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fmtDate } from "@/lib/format";
import { logSyncRun, supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const CONNECTORS = ["meta", "urbano", "fixy", "ml", "shopify-backfill", "recompute"] as const;
const SYNC_TIPS: Record<string, string> = {
  recompute: "Recalcula todo el P&L desde cero. Puede tardar y pisa los valores actuales.",
  "shopify-backfill": "Trae pedidos históricos de Shopify que falten. Úsalo solo si detectás huecos en los datos.",
  ml: "Trae las ventas de MercadoLibre y enriquece el flete normal desde el envío. El flete Flex se carga con el xlsx de Santiago (abajo).",
};

async function runNow(formData: FormData) {
  "use server";
  const connector = String(formData.get("connector"));
  if (!CONNECTORS.includes(connector as (typeof CONNECTORS)[number])) return;
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host");
  await fetch(`${proto}://${host}/api/sync/${connector}`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  }).catch(() => {}); // el resultado queda en sync_runs igual
  revalidatePath("/sync");
}

// Subida de la liquidación Flex de Santiago (xlsx). Corre server-side el mismo import que el endpoint
// y devuelve el resultado para mostrar el detalle simple en la UI (useActionState).
async function importFlex(_prev: FlexResult | null, formData: FormData): Promise<FlexResult> {
  "use server";
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "elegí un archivo .xlsx" };
  try {
    const { importMlFlex } = await import("@/lib/ml");
    const { parsed, matched } = await importMlFlex(Buffer.from(await file.arrayBuffer()));
    await logSyncRun("ml-flex", "ok", parsed, [{ matched_to_orders: matched }]);
    revalidatePath("/sync");
    return { ok: true, parsed, matched };
  } catch (e) {
    await logSyncRun("ml-flex", "error", 0, [], String(e));
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function SyncPage() {
  const db = supabaseAdmin();
  const [{ data: runs }, { data: sinClasificar }, { count: flexPend }] = await Promise.all([
    db.from("sync_runs").select("*").order("started_at", { ascending: false }).limit(50),
    // limit explícito: lista de display (guías fuera del P&L para el operador). Si pasa 1000 es una
    // alarma de datos, no algo a mostrar entero — el límite evita el truncado silencioso de PostgREST.
    db.from("v_sin_clasificar").select("*").order("dispatched_at", { ascending: false }).limit(1000),
    // Flex (reparto propio) pagadas sin flete cargado aún → cuántas liquidaciones de Santiago faltan.
    db.from("ml_orders").select("*", { count: "exact", head: true })
      .eq("status", "paid").eq("ship_type", "self_service").is("ship_cost", null),
  ]);

  return (
    <main className="space-y-8">
      <section className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm font-medium">Correr ahora:</span>
        {CONNECTORS.map((c) => (
          <div key={c} className="flex items-center gap-1">
            <SyncRun connector={c} run={runNow} />
            {SYNC_TIPS[c] && <Tip label={`Qué hace ${c}`} tip={SYNC_TIPS[c]} />}
          </div>
        ))}
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm font-medium">Flete Flex (xlsx de Santiago):</span>
        <FlexUpload action={importFlex} />
        <Tip label="Qué es esto" tip="Subí el xlsx semanal de la liquidación Flex de Santiago. La app lee el código de venta + precio de cada envío y le pone el flete real a las órdenes ML de reparto propio. Recalcula el P&L al terminar." />
        {typeof flexPend === "number" && (
          <span className="w-full text-xs text-muted-foreground">
            {flexPend > 0 ? (
              <><b className="tabular-nums text-foreground">{flexPend}</b> órdenes Flex todavía sin flete cargado — subí las liquidaciones que falten (llega a 0 cuando estén todas).</>
            ) : (
              "✓ Todas las órdenes Flex tienen su flete cargado."
            )}
          </span>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Últimas corridas</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Conector</TableHead>
              <TableHead>Cuándo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Filas</TableHead>
              <TableHead>Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(runs ?? []).map((r) => {
              const warnings = (r.warnings ?? []) as unknown[];
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.connector}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(r.started_at).toLocaleString("es-AR", {
                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "ok" ? "secondary" : "destructive"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.rows_upserted === 0 ? (
                      <Tip label="Filas en 0" tip="Sin novedades para sincronizar en esta corrida (no es un error).">
                        <span className="text-muted-foreground">0</span>
                      </Tip>
                    ) : r.rows_upserted}
                  </TableCell>
                  <TableCell className="max-w-md">
                    {r.error && <span className="text-sm text-destructive">{r.error}</span>}
                    {warnings.length > 0 && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground">
                          {warnings.length} warning{warnings.length > 1 ? "s" : ""}
                        </summary>
                        <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-xs">
                          {JSON.stringify(warnings, null, 2)}
                        </pre>
                      </details>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {!runs?.length && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Sin corridas todavía
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <section>
        <h2 className="mb-2 flex flex-wrap items-center gap-1.5 font-semibold">
          Sin clasificar
          <Tip label="Qué es sin clasificar" tip="Despachos que no pudimos matchear con un producto o pedido. Quedan fuera del P&L a propósito: preferimos no inventar atribuciones." />
          <span className="text-sm font-normal text-muted-foreground">(fuera del P&L — no se inventan atribuciones)</span>
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Courier</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>Ref</TableHead>
              <TableHead>Despacho</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(sinClasificar ?? []).map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.courier}</TableCell>
                <TableCell className="font-mono text-xs">{s.tracking}</TableCell>
                <TableCell>{s.order_ref ?? "—"}</TableCell>
                <TableCell>{s.dispatched_at ? fmtDate(s.dispatched_at) : "—"}</TableCell>
                <TableCell>{s.status_canonical}</TableCell>
                <TableCell>{s.motivo}</TableCell>
              </TableRow>
            ))}
            {!sinClasificar?.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nada sin clasificar 🎉
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </main>
  );
}

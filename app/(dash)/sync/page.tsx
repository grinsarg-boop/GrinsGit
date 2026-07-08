import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fmtDate } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const CONNECTORS = ["meta", "urbano", "fixy", "shopify-backfill", "recompute"] as const;

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

export default async function SyncPage() {
  const db = supabaseAdmin();
  const [{ data: runs }, { data: sinClasificar }] = await Promise.all([
    db.from("sync_runs").select("*").order("started_at", { ascending: false }).limit(50),
    // limit explícito: lista de display (guías fuera del P&L para el operador). Si pasa 1000 es una
    // alarma de datos, no algo a mostrar entero — el límite evita el truncado silencioso de PostgREST.
    db.from("v_sin_clasificar").select("*").order("dispatched_at", { ascending: false }).limit(1000),
  ]);

  return (
    <main className="space-y-8">
      <section className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm font-medium">Correr ahora:</span>
        {CONNECTORS.map((c) => (
          <form key={c} action={runNow}>
            <input type="hidden" name="connector" value={c} />
            <Button type="submit" variant="outline" size="sm">{c}</Button>
          </form>
        ))}
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
                  <TableCell className="text-right">{r.rows_upserted}</TableCell>
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
        <h2 className="mb-2 font-semibold">
          Sin clasificar <span className="text-sm font-normal text-muted-foreground">
            (fuera del P&L — no se inventan atribuciones)
          </span>
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

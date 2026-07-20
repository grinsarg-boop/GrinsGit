"use client";
import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtMoney } from "@/lib/format";

// Tabla de trabados con selección y export CSV para el reclamo a Urbano: guía, pedido, fecha,
// último estado y su fecha — lo que Urbano pide para accionar. Separador ; y CRLF (Excel es-AR),
// mismo criterio que el CSV de Correo.
export type TrabadoRow = {
  courier: string; tracking: string; order_number: string | null; customer_name: string | null;
  province: string | null; product: string | null; cod_amount: number | null;
  dispatched_at: string; status_canonical: string; status_raw: string | null;
  last_move: string; dias: number; href: string | null;
};

const COURIER: Record<string, string> = { urbano: "Urbano", fixy: "Fixy" };
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const esc = (v: string | number | null) => {
  const s = String(v ?? "");
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// ponytail: exportada para el test — el archivo va a un tercero, mejor que el formato tenga red.
export function csvTrabados(rows: TrabadoRow[]): string {
  const head = ["guia", "pedido", "cliente", "provincia", "producto", "cod_pendiente",
    "fecha_despacho", "ultimo_estado", "estado_raw", "fecha_ultimo_estado", "dias_sin_movimiento"];
  const lines = rows.map((r) => [
    r.tracking, r.order_number ?? "", r.customer_name ?? "", r.province ?? "", r.product ?? "",
    Math.round(Number(r.cod_amount ?? 0)), dmy(r.dispatched_at),
    r.status_canonical, r.status_raw ?? "", dmy(r.last_move.slice(0, 10)), r.dias,
  ].map(esc).join(";"));
  return [head.join(";"), ...lines].join("\r\n") + "\r\n";
}

export function TrabadosTabla({ rows }: { rows: TrabadoRow[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set(rows.map((r) => r.tracking)));
  const toggle = (tk: string) =>
    setSel((p) => { const n = new Set(p); if (n.has(tk)) n.delete(tk); else n.add(tk); return n; });
  const todos = sel.size === rows.length;
  const elegidos = rows.filter((r) => sel.has(r.tracking));

  function descargar() {
    const blob = new Blob([csvTrabados(elegidos)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reclamo_urbano_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <input type="checkbox" checked={todos} aria-label="Seleccionar todas"
                onChange={() => setSel(todos ? new Set() : new Set(rows.map((r) => r.tracking)))} />
            </TableHead>
            <TableHead>Guía</TableHead>
            <TableHead>Pedido</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Provincia</TableHead>
            <TableHead className="text-right">COD</TableHead>
            <TableHead className="text-right">Despachada</TableHead>
            <TableHead>Último movimiento</TableHead>
            <TableHead className="text-right">Días quieta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={`${r.courier}-${r.tracking}`} data-state={sel.has(r.tracking) ? "selected" : undefined}>
              <TableCell>
                <input type="checkbox" checked={sel.has(r.tracking)} onChange={() => toggle(r.tracking)}
                  aria-label={`Seleccionar guía ${r.tracking}`} />
              </TableCell>
              <TableCell>
                {r.href ? (
                  <a href={r.href} target="_blank" rel="noreferrer"
                     title="Ver seguimiento en Urbano (para reclamar)"
                     className="underline decoration-dotted underline-offset-2 hover:text-foreground">
                    {COURIER[r.courier]} {r.tracking}
                  </a>
                ) : (
                  <span>{COURIER[r.courier] ?? r.courier} {r.tracking}</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                #{r.order_number ?? "?"}{r.customer_name ? ` · ${r.customer_name}` : ""}
              </TableCell>
              <TableCell>{r.product ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{r.province ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtMoney(r.cod_amount)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{fmtDate(r.dispatched_at)}</TableCell>
              <TableCell className="text-muted-foreground">
                {fmtDate(r.last_move.slice(0, 10))} · {r.status_canonical}
                {r.status_raw ? ` (${r.status_raw})` : ""}
              </TableCell>
              <TableCell className="text-right">
                <span className="rounded bg-orange-500/15 px-1.5 py-0.5 font-semibold tabular-nums text-orange-600 dark:text-orange-500">
                  {r.dias}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center gap-3">
        <Button onClick={descargar} disabled={elegidos.length === 0}>
          Descargar CSV para Urbano ({elegidos.length})
        </Button>
        <span className="text-sm text-muted-foreground">
          guía · pedido · cliente · COD · despacho · último estado y su fecha
        </span>
      </div>
    </div>
  );
}

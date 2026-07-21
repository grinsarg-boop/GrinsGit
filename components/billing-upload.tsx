"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export type BillingResult =
  | { ok: true; total: number; from: string; to: string; days: number }
  | { ok: false; error: string };

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? (<><Spinner /> Procesando…</>) : "Subir reporte"}
    </Button>
  );
}

// Subida del Reporte_Facturacion mensual de ML (mismo patrón que FlexUpload).
export function BillingUpload({ action }: { action: (prev: BillingResult | null, fd: FormData) => Promise<BillingResult> }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <div className="flex flex-col gap-1.5">
      <form action={formAction} className="flex items-center gap-2">
        <input type="file" name="file" accept=".xlsx" required
          className="text-sm file:mr-2 file:rounded file:border file:bg-muted file:px-2 file:py-1 file:text-sm" />
        <SubmitBtn />
      </form>
      {state && (state.ok ? (
        <p className="text-sm text-muted-foreground">
          ✓ ${Math.round(state.total).toLocaleString("es-AR")} de percepciones y cargos fijos reales aplicados
          a {state.days} día{state.days === 1 ? "" : "s"} ({state.from} → {state.to}) · pisa los estimados · P&amp;L recalculado.
        </p>
      ) : (
        <p className="text-sm text-destructive">No se pudo procesar: {state.error}</p>
      ))}
    </div>
  );
}

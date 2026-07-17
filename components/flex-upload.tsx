"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export type FlexResult =
  | { ok: true; parsed: number; matched: number }
  | { ok: false; error: string };

// Botón que muestra la rueda + "Procesando…" mientras el server action corre (useFormStatus).
function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? (<><Spinner /> Procesando…</>) : "Subir liquidación"}
    </Button>
  );
}

// Subida del xlsx Flex con feedback de carga y detalle simple del resultado (neutro, sin naranja).
export function FlexUpload({ action }: { action: (prev: FlexResult | null, fd: FormData) => Promise<FlexResult> }) {
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
          ✓ {state.parsed} envío{state.parsed === 1 ? "" : "s"} leído{state.parsed === 1 ? "" : "s"} ·{" "}
          {state.matched} flete{state.matched === 1 ? "" : "s"} aplicado{state.matched === 1 ? "" : "s"} a órdenes · P&amp;L recalculado.
        </p>
      ) : (
        <p className="text-sm text-destructive">No se pudo procesar: {state.error}</p>
      ))}
    </div>
  );
}

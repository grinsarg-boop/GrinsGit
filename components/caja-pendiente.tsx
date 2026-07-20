"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/spinner";

function GuardarBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs hover:bg-accent disabled:opacity-60">
      {pending ? <Spinner className="size-3" /> : "Guardar"}
    </button>
  );
}

// Selector de categoría por movimiento pendiente (mismo patrón que AssignProduct). El server
// action escribe en la base Cashflow y revalida /caja → la fila desaparece al guardar.
export function CajaPendiente({
  movId,
  categorias,
  action,
}: {
  movId: number;
  categorias: { id: number; nombre: string }[];
  action: (fd: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={movId} />
      <select name="categoria" required defaultValue=""
        className="rounded border bg-background px-1.5 py-0.5 text-xs">
        <option value="" disabled>categoría…</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
        <option value="retiro">Retiro socio</option>
      </select>
      <GuardarBtn />
    </form>
  );
}

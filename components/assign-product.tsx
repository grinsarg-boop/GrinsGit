"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/spinner";

function AssignBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs hover:bg-accent disabled:opacity-60">
      {pending ? <Spinner className="size-3" /> : "Asignar"}
    </button>
  );
}

// Selector de producto por fila sin-clasificar. Al enviar, el server action guarda el override y
// recalcula el día → la orden entra al P&L con atribución y costo correctos.
export function AssignProduct({
  shipmentId,
  products,
  action,
}: {
  shipmentId: number;
  products: { id: number; name: string }[];
  action: (fd: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <select name="productId" required defaultValue=""
        className="rounded border bg-background px-1.5 py-0.5 text-xs">
        <option value="" disabled>producto…</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <AssignBtn />
    </form>
  );
}

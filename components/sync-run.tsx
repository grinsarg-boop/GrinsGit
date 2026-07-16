"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { AlertDialog } from "radix-ui";
import { Button } from "@/components/ui/button";

// Acciones pesadas: piden modal de confirmación antes de correr (audit §3.3, §6).
const HEAVY: Record<string, { title: string; body: string }> = {
  recompute: {
    title: "¿Recalcular todo el P&L?",
    body: "Esto vuelve a procesar todas las corridas y puede tardar unos minutos. Los valores actuales se reemplazan por los recalculados.",
  },
  "shopify-backfill": {
    title: "¿Traer pedidos históricos de Shopify?",
    body: "Trae de Shopify los pedidos históricos que falten en la base. Puede tardar. Úsalo solo si detectás huecos en los datos.",
  },
};

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 animate-spin" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

// Botón simple: spinner + "Corriendo…" y deshabilitado mientras corre (evita doble click, audit §6).
function PlainButton({ connector }: { connector: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? (<><Spinner /> Corriendo…</>) : connector}
    </Button>
  );
}

// Botón pesado: outline naranja + modal de confirmación (foco inicial en Cancelar, que da Radix).
function HeavyButton({
  connector,
  meta,
  submit,
}: {
  connector: string;
  meta: { title: string; body: string };
  submit: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button type="button" variant="destructive" size="sm" disabled={pending}>
          {pending ? (<><Spinner /> Corriendo…</>) : (<><WarnIcon /> {connector}</>)}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-5 shadow-xl">
          <AlertDialog.Title className="text-base font-semibold">{meta.title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
            {meta.body}
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" size="sm">Cancelar</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="destructive" size="sm" onClick={submit}>Sí, ejecutar</Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function SyncRun({
  connector,
  run,
}: {
  connector: string;
  run: (formData: FormData) => Promise<void>;
}) {
  const meta = HEAVY[connector];
  const formRef = React.useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={run}>
      <input type="hidden" name="connector" value={connector} />
      {meta ? (
        <HeavyButton connector={connector} meta={meta} submit={() => formRef.current?.requestSubmit()} />
      ) : (
        <PlainButton connector={connector} />
      )}
    </form>
  );
}

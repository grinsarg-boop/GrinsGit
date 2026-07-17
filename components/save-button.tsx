"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// Botón submit con rueda mientras el server action corre. Para forms de /config.
export function SaveButton({ children = "Guardar" }: { children?: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? (<><Spinner className="size-3" /> Guardando…</>) : children}
    </Button>
  );
}

"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Error boundary del grupo. Hasta hoy una RPC caída o un timeout de Supabase tiraba el árbol
// entero y dejaba la pantalla en blanco, sin nav y sin decir qué pasó. Ahora la nav sigue en pie,
// el mensaje se ve y hay botón de reintentar, que en una falla transitoria (que es la mayoría)
// alcanza. Cubre los 13 paneles: Next usa el error.tsx más cercano.
export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]); // el detalle real va a los logs de Vercel
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4">
      <p className="text-sm font-medium text-destructive">Este panel no cargó.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {error.message || "Error desconocido"}
        {error.digest && <span className="tabular-nums"> · {error.digest}</span>}
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={reset}>Reintentar</Button>
        <Button size="sm" variant="outline" asChild><Link href="/sync">Ver estado de los syncs</Link></Button>
      </div>
    </div>
  );
}

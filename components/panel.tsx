import { Card, CardContent } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";

// Panel colapsable: <details> nativo (mismo recurso que los recuadros del Resumen). El estado
// no persiste entre recargas — alcanza para despejar la vista mientras se lee.
export function Panel({ titulo, tip, children }: { titulo: React.ReactNode; tip?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <details open className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-90">▸</span>
            {titulo}
            {tip && <Tip tip={tip} />}
          </summary>
          <div className="mt-3">{children}</div>
        </details>
      </CardContent>
    </Card>
  );
}

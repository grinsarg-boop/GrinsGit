import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Skeleton mientras el panel resuelve sus RPCs. Uno solo para todo el grupo: Next usa el
// loading.tsx más cercano, así que este cubre los 13 paneles y no hay 13 archivos que mantener
// desincronizados. Todos tienen la misma forma —título, fila de KPIs, tabla— y la nav queda
// quieta arriba porque vive en el layout: solo parpadea el contenido.
// El ancho llega como clase literal desde los call-sites (Tailwind las escanea en este archivo):
// nada de derivarlas en runtime, que es la trampa que ya nos comimos el 19/07.
const Barra = ({ w }: { w: string }) => (
  <div className={cn("h-4 animate-pulse rounded bg-muted motion-reduce:animate-none", w)} />
);

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando el panel">
      <Barra w="w-64" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}><CardContent className="space-y-2 pt-5"><Barra w="w-20" /><Barra w="w-28" /></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-3 pt-5">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Barra key={i} w="w-full" />)}
        </CardContent>
      </Card>
    </div>
  );
}

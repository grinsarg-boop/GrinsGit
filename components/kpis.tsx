import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// La capa KPI del panel, escrita una sola vez. Estaba copiada en cinco lugares con dos escalas
// distintas (text-2xl en los drill-down, text-lg en los tiles de /analisis y /tendencias): el mismo
// bloque label + valor + delta a mano cada vez, con la fila de arriba de cada panel leyéndose
// distinto según en qué panel estabas.
//
// Escala: label 0.7rem → valor 1.25rem, un salto del 79%. Refactoring UI pide >25% entre pasos
// para que la jerarquía se lea sin comparar; menos que eso se ve como un error de tipeo.
export type Kpi = {
  label: string;
  value: string;
  tip?: string;
  delta?: React.ReactNode; // <Delta/> ya renderizado: el KPI no sabe contra qué se compara
  pie?: React.ReactNode;   // segunda línea chica (confirmado, ritmo, entrega…)
  color?: string;          // clase de color del valor; sin esto hereda el del texto
};

export function Kpis({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((k) => (
        <div key={k.label} className="sube rounded-lg bg-muted/40 p-3">
          <div className="flex items-center gap-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
            {k.label}
            {k.tip && <Tip tip={k.tip} />}
          </div>
          <div className={cn("text-xl font-semibold tabular-nums tracking-tight", k.color)}>{k.value}</div>
          {k.delta && <div className="pt-0.5">{k.delta}</div>}
          {k.pie && <div className="pt-0.5 text-xs tabular-nums text-muted-foreground">{k.pie}</div>}
        </div>
      ))}
    </div>
  );
}

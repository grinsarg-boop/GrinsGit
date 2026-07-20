import Link from "next/link";
import { cn } from "@/lib/utils";
import { Picking } from "./picking";
import { CorreoTools } from "./correo";
import { EtiquetasMl } from "./etiquetas-ml";

// Las tres herramientas operativas de despacho en una sola ventana (antes /picking, /correo y
// /etiquetas por separado). Tab por searchParam — las rutas viejas redirigen acá con su tab.
const TABS = [
  ["picking", "Picking del día"],
  ["correo", "Correo Argentino"],
  ["etiquetas", "Etiquetas ML"],
] as const;
type Tab = (typeof TABS)[number][0];

export default async function Logistica({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const tab: Tab = t === "correo" || t === "etiquetas" ? t : "picking";
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b">
        {TABS.map(([k, label]) => (
          <Link
            key={k}
            href={`/logistica?t=${k}`}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              tab === k
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </div>
      {tab === "picking" && <Picking />}
      {tab === "correo" && <CorreoTools />}
      {tab === "etiquetas" && <EtiquetasMl />}
    </div>
  );
}

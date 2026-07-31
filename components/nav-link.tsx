"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

// Nav en tres grupos separados por espacio: P&L (de dónde sale el margen) · Plata y stock (lo
// percibido) · Operación (lo que se rompe). Once links planos no dejaban ver ninguna jerarquía ni
// dónde estabas parado. Client component solo por usePathname: ese es todo el costo de agrupar.
const GRUPOS: [string, string][][] = [
  [["/", "Resumen"], ["/ventas", "Ventas"], ["/analisis", "Análisis"], ["/anuncios", "Anuncios"], ["/tendencias", "Tendencias"]],
  [["/caja", "Caja"], ["/stock", "Stock"]],
  [["/trabados", "Trabados"], ["/logistica", "Logística"], ["/sync", "Sync"], ["/config", "Config"]],
];

// Las tres herramientas de /logistica cuelgan indentadas cuando estás ahí. Antes vivían en una
// barra de tabs adentro de la página: desde cualquier otro panel eran invisibles. La barra se
// borró de la página — la nav es la única superficie de navegación.
const LOGISTICA: [string, string][] = [
  ["picking", "Picking del día"],
  ["correo", "Correo Argentino"],
  ["etiquetas", "Etiquetas ML"],
];

const BASE = "rounded-md px-2 py-1 text-sm transition-colors";
const OFF = "text-muted-foreground hover:bg-muted/60 hover:text-foreground";
const ON = "bg-muted font-medium text-foreground";

export function Nav() {
  const path = usePathname();
  const t = useSearchParams().get("t");
  const tab = t === "correo" || t === "etiquetas" ? t : "picking"; // mismo default que la página
  return (
    <nav className="mb-6 border-b pb-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <span className="mr-1 font-semibold">BioLabs Finanzas</span>
        {GRUPOS.map((grupo) => (
          <div key={grupo[0][0]} className="flex flex-wrap items-center gap-1">
            {grupo.map(([href, label]) => (
              <Link key={href} href={href} aria-current={path === href ? "page" : undefined}
                    className={cn(BASE, path === href ? ON : OFF)}>{label}</Link>
            ))}
          </div>
        ))}
        <div className="ml-auto"><ThemeToggle /></div>
      </div>
      {path === "/logistica" && (
        <div className="mt-1 flex flex-wrap items-center gap-1 pl-4">
          {LOGISTICA.map(([k, label]) => (
            <Link key={k} href={`/logistica?t=${k}`} aria-current={tab === k ? "page" : undefined}
                  className={cn(BASE, "text-xs", tab === k ? ON : OFF)}>{label}</Link>
          ))}
        </div>
      )}
    </nav>
  );
}

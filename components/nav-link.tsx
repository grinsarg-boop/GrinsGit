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
  [["/caja", "Caja"], ["/stock", "Stock"], ["/precio", "Precio"]],
  [["/trabados", "Trabados"], ["/logistica", "Logística"], ["/sync", "Sync"], ["/config", "Config"]],
];

// Las tres herramientas de /logistica cuelgan indentadas cuando estás ahí. Antes vivían en una
// barra de tabs adentro de la página: desde cualquier otro panel eran invisibles. La barra se
// borró de la página — la nav es la única superficie de navegación.
const LOGISTICA: [string, string][] = [
  ["picking", "Picking del día"],
  ["preparar", "Preparar etiquetas"],
  ["correo", "Correo Argentino"],
  ["etiquetas", "Etiquetas ML"],
];

const BASE = "rounded-md px-2 py-1 text-sm transition-colors";
const OFF = "text-muted-foreground hover:bg-muted/60 hover:text-foreground";
// Dónde estás parado se dice con el verde de la marca, no con otro gris. Era el único color de
// identidad del panel y solo aparecía en el botón de login.
const ON = "bg-brand/12 font-medium text-brand";

// `avisos` es la campanita de salud (server component, ver salud-banner.tsx) entrando como slot:
// necesita una RPC, así que no puede vivir adentro de este client component.
export function Nav({ avisos }: { avisos?: React.ReactNode }) {
  const path = usePathname();
  const t = useSearchParams().get("t");
  const tab = t === "preparar" || t === "correo" || t === "etiquetas" ? t : "picking"; // mismo default que la página
  return (
    // Pegada arriba y translúcida: en un panel de 90 filas, perder la navegación al scrollear
    // obligaba a volver hasta el techo para cambiar de pantalla.
    <nav className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto w-full max-w-6xl px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <Link href="/" className="mr-1 inline-flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
            <span aria-hidden className="h-4 w-1 rounded-full bg-brand" />
            <span className="font-display text-[0.95rem] font-bold tracking-tight">
              BioLabs <span className="font-medium text-muted-foreground">Finanzas</span>
            </span>
          </Link>
          {GRUPOS.map((grupo) => (
            <div key={grupo[0][0]} className="flex flex-wrap items-center gap-1">
              {grupo.map(([href, label]) => (
                <Link key={href} href={href} aria-current={path === href ? "page" : undefined}
                      className={cn(BASE, path === href ? ON : OFF)}>{label}</Link>
              ))}
            </div>
          ))}
          <div className="ml-auto flex items-center gap-1">{avisos}<ThemeToggle /></div>
        </div>
        {path === "/logistica" && (
          <div className="mt-1 flex flex-wrap items-center gap-1 pl-4">
            {LOGISTICA.map(([k, label]) => (
              <Link key={k} href={`/logistica?t=${k}`} aria-current={tab === k ? "page" : undefined}
                    className={cn(BASE, "text-xs", tab === k ? ON : OFF)}>{label}</Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

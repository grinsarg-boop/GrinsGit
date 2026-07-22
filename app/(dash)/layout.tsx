import Link from "next/link";
import { SyncAlert } from "@/components/sync-alert";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChatWidget } from "@/components/chat-widget";

const NAV: [string, string][] = [
  ["/", "Resumen"],
  ["/ventas", "Ventas"],
  ["/analisis", "Análisis"],
  ["/anuncios", "Anuncios"],
  ["/tendencias", "Tendencias"],
  ["/caja", "Caja"],
  ["/stock", "Stock"],
  ["/trabados", "Trabados"],
  ["/logistica", "Logística"],
  ["/sync", "Sync"],
  ["/config", "Config"],
];

// Subrayado que crece desde la izquierda al pasar el mouse. Con "reducir movimiento" del SO el
// pseudo-elemento no se anima y queda solo el cambio de color, que ya alcanza como affordance.
const NAV_LINK =
  "relative text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground " +
  "after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:origin-left after:scale-x-0 " +
  "after:bg-current after:transition-transform after:duration-200 after:ease-out hover:after:scale-x-100 " +
  "motion-reduce:after:hidden";

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl p-4">
      <nav className="mb-6 flex items-center gap-6 border-b pb-3">
        <span className="font-semibold">BioLabs Finanzas</span>
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className={NAV_LINK}>{label}</Link>
        ))}
        <div className="ml-auto"><ThemeToggle /></div>
      </nav>
      <SyncAlert />
      {children}
      <ChatWidget />
    </div>
  );
}

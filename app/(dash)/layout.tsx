import { Suspense } from "react";
import { Nav } from "@/components/nav-link";
import { SaludBanner } from "@/components/salud-banner";
import { ChatWidget } from "@/components/chat-widget";

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    // La nav queda FUERA del contenedor centrado: es sticky y translúcida, y su fondo tiene que
    // cruzar la pantalla entera. El ancho de lectura lo pone ella adentro.
    <>
      {/* Suspense porque la nav lee ?t= con useSearchParams — sin esto un prerender estático rompe el build. */}
      <Suspense>
        <Nav avisos={<SaludBanner />} />
      </Suspense>
      <div className="mx-auto w-full max-w-6xl p-4 pt-6">
        {children}
        <ChatWidget />
      </div>
    </>
  );
}

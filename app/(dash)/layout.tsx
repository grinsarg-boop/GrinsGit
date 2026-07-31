import { Suspense } from "react";
import { Nav } from "@/components/nav-link";
import { SaludBanner } from "@/components/salud-banner";
import { ChatWidget } from "@/components/chat-widget";

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl p-4">
      {/* Suspense porque la nav lee ?t= con useSearchParams — sin esto un prerender estático rompe el build. */}
      <Suspense>
        <Nav />
      </Suspense>
      <SaludBanner />
      {children}
      <ChatWidget />
    </div>
  );
}

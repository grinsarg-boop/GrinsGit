import Link from "next/link";

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl p-4">
      <nav className="mb-6 flex items-center gap-6 border-b pb-3">
        <span className="font-semibold">BioLabs Finanzas</span>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Resumen</Link>
        <Link href="/sync" className="text-sm text-muted-foreground hover:text-foreground">Sync</Link>
        <Link href="/etiquetas" className="text-sm text-muted-foreground hover:text-foreground">Etiquetas</Link>
        <Link href="/correo" className="text-sm text-muted-foreground hover:text-foreground">Correo</Link>
      </nav>
      {children}
    </div>
  );
}

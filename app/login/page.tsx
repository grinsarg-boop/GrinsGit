"use client";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// Email + contraseña. Sin signup ni reset: los 2 usuarios se crean/resetean a mano
// en el dashboard de Supabase (Auth → Users). La whitelist la aplica el middleware.
export default function LoginPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Los campos NO son controlados: el valor se lee del form al enviar. Con useState + value={},
  // el autocompletado de Chrome rompía el login — Chrome pinta el valor pero lo esconde de JS hasta
  // que tocás la página, así que el estado de React quedaba vacío y se enviaba "" / "", con
  // "Mail o contraseña incorrectos" arriba de un formulario que se veía completo.
  async function login(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget); // antes del await: después, currentTarget ya es null
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
    });
    setBusy(false);
    if (error) setError("Mail o contraseña incorrectos");
    else router.push("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={login} className="w-full max-w-sm space-y-4">
        <h1 className="font-display text-2xl font-bold tracking-tight">BioLabs Finanzas</h1>
        <input
          type="email" name="email" required placeholder="tu@mail.com"
          autoComplete="email"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <input
          type="password" name="password" required placeholder="contraseña"
          autoComplete="current-password"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">Entrar</Button>
      </form>
    </main>
  );
}

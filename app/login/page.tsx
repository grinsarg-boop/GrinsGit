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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError("Mail o contraseña incorrectos");
    else router.push("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={login} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">BioLabs Finanzas</h1>
        <input
          type="email" required value={email} placeholder="tu@mail.com"
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <input
          type="password" required value={password} placeholder="contraseña"
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">Entrar</Button>
      </form>
    </main>
  );
}

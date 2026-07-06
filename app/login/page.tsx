"use client";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// Login por código OTP al mail (sin callback de magic link — menos config en Vercel).
// La whitelist la aplica el middleware: loguearse sin estar en ALLOWED_EMAILS no sirve de nada.
export default function LoginPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    setBusy(false);
    if (error) setError(error.message);
    else router.push("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={sent ? verify : sendCode} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">BioLabs Finanzas</h1>
        {!sent ? (
          <input
            type="email" required value={email} placeholder="tu@mail.com"
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Código enviado a {email}</p>
            <input
              required value={token} placeholder="123456" inputMode="numeric"
              onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">
          {sent ? "Entrar" : "Enviar código"}
        </Button>
      </form>
    </main>
  );
}

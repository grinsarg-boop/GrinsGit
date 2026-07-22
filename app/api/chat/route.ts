import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { chatTools } from "@/lib/chat-tools";
import { buildSystemPrompt } from "@/lib/chat-prompt";

// El tool-loop encadena varias consultas → sube el techo de Vercel (Pro; en Hobby capa a 60).
export const maxDuration = 300;

// El middleware saltea /api → validamos la sesión acá (misma regla que middleware.ts:
// user logueado + whitelist ALLOWED_EMAILS). Devuelve el email si pasa, null si no.
async function authEmail(req: NextRequest): Promise<string | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase() ?? "";
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return email && allowed.includes(email) ? email : null;
}

function artTodayISO(): string {
  // Argentina = UTC-3, sin DST. Sacamos el YYYY-MM-DD local sin depender del TZ del server.
  const art = new Date(Date.now() - 3 * 3600 * 1000);
  return art.toISOString().slice(0, 10);
}

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86400 * 1000).toISOString().slice(0, 10);
}

type DayRow = { dispatch_date: string; despachadas: number; revenue_confirmado: number; profit_confirmado: number; profit_estimado: number; ads: number };

async function baseline(fromISO: string) {
  const sb = supabaseAdmin();
  const { data } = await sb.rpc("dashboard_days", { p_from: fromISO });
  const rows: DayRow[] = Array.isArray(data) ? data : [];
  const cut7 = isoDaysAgo(7);
  const sum = (list: DayRow[]) => list.reduce(
    (a, r) => ({
      despachadas: a.despachadas + Number(r.despachadas || 0),
      revenue_conf: a.revenue_conf + Number(r.revenue_confirmado || 0),
      profit_conf: a.profit_conf + Number(r.profit_confirmado || 0),
      profit_est: a.profit_est + Number(r.profit_estimado || 0),
      ads: a.ads + Number(r.ads || 0),
    }),
    { despachadas: 0, revenue_conf: 0, profit_conf: 0, profit_est: 0, ads: 0 },
  );
  return { desde: fromISO, d7: sum(rows.filter((r) => r.dispatch_date >= cut7)), d30: sum(rows) };
}

// ---- GET: lista de sesiones, o los mensajes de una sesión (?session=<id>) ----
export async function GET(req: NextRequest) {
  if (!(await authEmail(req))) return new NextResponse("unauthorized", { status: 401 });
  const sb = supabaseAdmin();
  const id = req.nextUrl.searchParams.get("session");
  if (id) {
    const { data } = await sb.from("chat_messages")
      .select("role,content").eq("session_id", id).order("created_at");
    return NextResponse.json({ messages: data ?? [] });
  }
  const { data } = await sb.from("chat_sessions")
    .select("id,title,updated_at").order("updated_at", { ascending: false }).limit(50);
  return NextResponse.json({ sessions: data ?? [] });
}

// ---- DELETE: borra una sesión (cascade borra sus mensajes) ----
export async function DELETE(req: NextRequest) {
  if (!(await authEmail(req))) return new NextResponse("unauthorized", { status: 401 });
  const id = req.nextUrl.searchParams.get("session");
  if (!id) return NextResponse.json({ error: "falta ?session" }, { status: 400 });
  await supabaseAdmin().from("chat_sessions").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}

// ---- POST: un turno del chat ----
export async function POST(req: NextRequest) {
  const email = await authEmail(req);
  if (!email) return new NextResponse("unauthorized", { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY en el server." }, { status: 500 });
  }

  let body: { sessionId?: string; message?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "body inválido" }, { status: 400 }); }
  const message = (body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "mensaje vacío" }, { status: 400 });
  if (message.length > 4000) return NextResponse.json({ error: "mensaje demasiado largo" }, { status: 400 });

  const sb = supabaseAdmin();

  // Sesión: existente o nueva (título = primer mensaje recortado).
  let sessionId = body.sessionId ?? null;
  if (!sessionId) {
    const { data, error } = await sb.from("chat_sessions")
      .insert({ user_email: email, title: message.slice(0, 60) })
      .select("id").single();
    if (error || !data) return NextResponse.json({ error: "no se pudo crear la sesión" }, { status: 500 });
    sessionId = data.id;
  }

  // Historial previo (sólo texto — no re-jugamos bloques de tool entre turnos).
  const { data: prior } = await sb.from("chat_messages")
    .select("role,content").eq("session_id", sessionId).order("created_at");
  const history = (prior ?? []) as { role: "user" | "assistant"; content: string }[];

  // Contexto en vivo para el system prompt.
  const from30 = isoDaysAgo(30);
  const [{ data: prods }, base] = await Promise.all([
    sb.from("products").select("id,name").eq("active", true).order("name"),
    baseline(from30),
  ]);
  const system = buildSystemPrompt(artTodayISO(), (prods ?? []) as { id: number; name: string }[], base);

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: message },
  ];

  let reply: string;
  try {
    const client = new Anthropic();
    // Sonnet 5 por default: interactivo y con techo de timeout → prima la latencia (además es el
    // modelo del bot de WhatsApp y más barato). Subir a claude-opus-4-8 vía CHAT_MODEL si se quiere
    // más profundidad. Sin thinking adaptativo: agrega segundos y las tools ya aportan el dato duro.
    const final = await client.beta.messages.toolRunner({
      model: process.env.CHAT_MODEL || "claude-sonnet-5",
      max_tokens: 8000,
      // cache_control: el system (glosario + catálogo + baseline) es estable dentro del loop y entre
      // turnos → se cachea y abarata cada iteración (~10% del costo en cache_read). Latencia neutra.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: chatTools,
      messages,
      max_iterations: 5,
    }).done();
    reply = final.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text).join("\n").trim();
    if (!reply) reply = "(sin respuesta)";
  } catch (e) {
    return NextResponse.json({ error: `Error del modelo: ${(e as Error).message}` }, { status: 502 });
  }

  // Persistir el turno + bumpear la sesión.
  await sb.from("chat_messages").insert([
    { session_id: sessionId, role: "user", content: message },
    { session_id: sessionId, role: "assistant", content: reply },
  ]);
  await sb.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId);

  return NextResponse.json({ sessionId, reply });
}

"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { parseMarkdown, type Inline } from "@/lib/markdown";

// Asistente flotante: burbuja abajo-derecha en todos los paneles. Historial multi-sesión persistido
// en Supabase (chat_sessions/chat_messages) vía /api/chat — sobrevive al reload. Sin dep de iconos
// (SVG inline, mismo criterio que theme-toggle).

type Msg = { role: "user" | "assistant"; content: string };
type Session = { id: string; title: string | null; updated_at: string };

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const loadedSessions = useRef(false);   // ref, no estado: nadie lo pinta y en estado dispara render en cascada
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showList, setShowList] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !loadedSessions.current) { loadedSessions.current = true; void loadSessions(); }
  }, [open]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function loadSessions() {
    try {
      const res = await fetch("/api/chat");
      if (res.ok) setSessions((await res.json()).sessions ?? []);
    } catch { /* silencioso: la lista es secundaria */ }
  }

  async function openSession(id: string) {
    setShowList(false);
    setCurrentId(id);
    setError(null);
    const res = await fetch(`/api/chat?session=${id}`);
    setMessages(res.ok ? (await res.json()).messages ?? [] : []);
  }

  function newChat() {
    setShowList(false);
    setCurrentId(null);
    setMessages([]);
    setError(null);
  }

  async function deleteSession(id: string) {
    await fetch(`/api/chat?session=${id}`, { method: "DELETE" });
    if (id === currentId) newChat();
    void loadSessions();
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    setStatus(null);
    const base: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(base);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: currentId, message: text }),
      });
      if (!res.ok || !res.body) throw new Error(`error ${res.status}`);
      // Stream NDJSON: {status} (tool corriendo) · {delta} (texto) · {done,sessionId}
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "", assistant = "", started = false, sid = currentId;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: { status?: string; delta?: string; done?: boolean; sessionId?: string };
          try { ev = JSON.parse(line); } catch { continue; }
          if (ev.status) setStatus(ev.status);
          else if (ev.delta != null) {
            assistant += ev.delta;
            started = true;
            setStatus(null);
            setMessages([...base, { role: "assistant", content: assistant }]);
          } else if (ev.done) sid = ev.sessionId ?? sid;
        }
      }
      if (!currentId && sid) { setCurrentId(sid); void loadSessions(); }
      if (!started) setMessages([...base, { role: "assistant", content: "(sin respuesta)" }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setStatus(null);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir asistente"
        title="Asistente"
        className="fixed bottom-4 right-4 z-50 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-150 hover:brightness-110 motion-safe:hover:-translate-y-px motion-safe:active:scale-95"
      >
        <ChatIcon />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex h-[600px] max-h-[calc(100vh-2rem)] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl">
      {/* header */}
      <div className="flex items-center gap-1 border-b px-3 py-2">
        <span className="mr-auto text-sm font-semibold">Asistente</span>
        <IconBtn label="Historial" onClick={() => setShowList((v) => !v)}><ListIcon /></IconBtn>
        <IconBtn label="Chat nuevo" onClick={newChat}><PlusIcon /></IconBtn>
        <IconBtn label="Cerrar" onClick={() => setOpen(false)}><XIcon /></IconBtn>
      </div>

      {/* lista de sesiones (dropdown) */}
      {showList && (
        <div className="max-h-48 overflow-y-auto border-b bg-muted/40 text-sm">
          {sessions.length === 0 && <p className="px-3 py-2 text-muted-foreground">Sin conversaciones.</p>}
          {sessions.map((s) => (
            <div key={s.id} className={cn("flex items-center gap-2 px-3 py-1.5 hover:bg-accent", s.id === currentId && "bg-accent")}>
              <button type="button" onClick={() => openSession(s.id)} className="min-w-0 flex-1 truncate text-left">
                {s.title || "(sin título)"}
              </button>
              <button type="button" onClick={() => deleteSession(s.id)} aria-label="Borrar" title="Borrar"
                className="shrink-0 text-muted-foreground hover:text-destructive"><TrashIcon /></button>
            </div>
          ))}
        </div>
      )}

      {/* mensajes */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm">
        {messages.length === 0 && !loading && (
          <p className="mt-6 text-center text-muted-foreground">
            Preguntame sobre el negocio.<br />
            <span className="text-xs">Ej: &ldquo;¿profit de Fixy vs Urbano este mes?&rdquo;, &ldquo;¿qué provincia rinde peor en Nature&apos;s?&rdquo;</span>
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] rounded-lg px-3 py-2",
              m.role === "user" ? "whitespace-pre-wrap bg-primary text-primary-foreground" : "bg-muted",
            )}>{m.role === "user" ? m.content : <Markdown text={m.content} />}</div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-muted-foreground">
              <Spinner className="size-3" /> {status || "pensando…"}
            </div>
          </div>
        )}
        {error && <p className="text-xs text-destructive">⚠ {error}</p>}
        <div ref={endRef} />
      </div>

      {/* input */}
      <div className="flex items-end gap-2 border-t p-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          placeholder="Escribí tu pregunta…"
          className="max-h-28 min-h-9 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={loading || !input.trim()}
          aria-label="Enviar"
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}

function renderInlines(inls: Inline[]) {
  return inls.map((n, i) => {
    if (n.k === "b") return <strong key={i}>{n.v}</strong>;
    if (n.k === "i") return <em key={i}>{n.v}</em>;
    if (n.k === "code") return <code key={i} className="rounded bg-background/60 px-1 py-0.5 text-[0.85em]">{n.v}</code>;
    return <span key={i}>{n.v}</span>;
  });
}

// Render del subset markdown (ver lib/markdown). Tolera texto parcial mientras streamea.
function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-1.5">
      {parseMarkdown(text).map((b, i) => {
        if (b.type === "ul") return <ul key={i} className="list-disc space-y-0.5 pl-4">{b.items.map((it, j) => <li key={j}>{renderInlines(it)}</li>)}</ul>;
        if (b.type === "ol") return <ol key={i} className="list-decimal space-y-0.5 pl-4">{b.items.map((it, j) => <li key={j}>{renderInlines(it)}</li>)}</ol>;
        if (b.type === "h") return <p key={i} className="font-semibold">{renderInlines(b.inlines)}</p>;
        return <p key={i}>{renderInlines(b.inlines)}</p>;
      })}
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
      {children}
    </button>
  );
}

/* iconos inline (stroke currentColor, 16px) */
const svg = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const ChatIcon = () => <svg {...svg} width={22} height={22}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
const XIcon = () => <svg {...svg}><path d="M18 6 6 18M6 6l12 12" /></svg>;
const PlusIcon = () => <svg {...svg}><path d="M12 5v14M5 12h14" /></svg>;
const ListIcon = () => <svg {...svg}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>;
const TrashIcon = () => <svg {...svg} width={14} height={14}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>;
const SendIcon = () => <svg {...svg}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>;

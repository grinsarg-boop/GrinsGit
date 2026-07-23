// Memoria de negocio COMPARTIDA con el bot de WhatsApp: lee la fila `contexto` de la base
// App-Gastos (id=1, campo `texto`) para que el asistente del panel arranque con el mismo
// conocimiento institucional (decisiones, reglas, números corregidos, gotchas).
// ponytail: key pública (ya vive en el repo público app-gastos). Si se quiere, pasar a env
// APPGASTOS_ANON_KEY. Cache 5 min (el contexto cambia pocas veces por día) para no pegarle
// a la otra base en cada mensaje.
const APPGASTOS_BASE = "https://jgxdnxqpkapmjgpahdyk.supabase.co/rest/v1";
const APPGASTOS_KEY = "sb_publishable_K9DKrxQXRtyD5SK7WWVGHA_6PpKMYWD";

export async function fetchMemoria(): Promise<string> {
  try {
    const r = await fetch(`${APPGASTOS_BASE}/contexto?id=eq.1&select=texto`, {
      headers: { apikey: APPGASTOS_KEY, Authorization: `Bearer ${APPGASTOS_KEY}` },
      next: { revalidate: 300 },
    });
    if (!r.ok) return "";
    const rows = (await r.json()) as { texto?: string }[];
    return String(rows?.[0]?.texto ?? "").trim();
  } catch {
    return "";
  }
}

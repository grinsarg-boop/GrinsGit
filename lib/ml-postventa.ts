import Anthropic from "@anthropic-ai/sdk";
import { getMlAccessToken } from "@/lib/ml";
import { supabaseAdmin } from "@/lib/supabase";

// Agente de post-venta de ML (migración 102): contesta / borra / escala preguntas pre-venta y
// fotografía los reclamos abiertos. Las reglas de respuesta son las que fijó Pancho (vault
// Integracion-ML-MP §21/09 y §30/09/2026); las que se pueden escribir como código viven acá como
// candados, no en el prompt — el prompt sugiere, el candado no falla (memoria reglas-en-codigo).

type Db = ReturnType<typeof supabaseAdmin>;
const API = "https://api.mercadolibre.com";

export type Accion = "responder" | "borrar" | "escalar" | "ignorar";
export type Decision = { accion: Accion; texto: string; motivo: string };

// Regla 30/09/2026: la originalidad se responde con este texto exacto. Nunca "es el original":
// somospureza.com es anterior y en un reclamo PDD9943 queda escrito como engaño.
export const ORIGINALIDAD =
  "¡Hola! Este producto lo elaboramos y despachamos nosotros. No tenemos relación con otras páginas que venden productos con nombre parecido. Cualquier duda, escribinos.";

// ANMAT/RNPA/"cambiaron la fórmula": se ignoraban (regla 21/09) y quedaban sin responder para siempre,
// pesando en el tiempo de respuesta → desde el 01/10/2026 se BORRAN (decisión de Pancho). Factura A
// sigue ignorándose (regla 21/09, no se revisó).
const BORRAR = /anmat|rnpa|registro sanitario|cambiaron la f[oó]rmula/i;
const IGNORAR = /factura\s*a\b/i;
const ORIGINAL = /original|trucho|imitaci[oó]n|falsificad|r[eé]plica/i;
// "compré y me llegó distinto" no es una duda de originalidad, es post-venta: la decide el modelo (escala).
const YA_COMPRO = /compr[eé]|me lleg[oó]|recib[ií]|mi pedido|devol|reembols/i;

// Lo que una respuesta pública NUNCA puede llevar: contacto por fuera de ML (ML lo sanciona; regla
// 21/09 "nunca poner el número") y claims sanitarios/regulatorios (Playbook-ML-Compliance).
const PROHIBIDO_EN_RESPUESTA = [
  /https?:\/\/|www\.|\.com\b|@|whats\s*app|\bwsp\b|instagram|facebook|tel[eé]fono|celular/i,
  /\d[\d\s.-]{7,}\d/, // teléfono: 9+ dígitos seguidos (con separadores)
  /anmat|rnpa|aprobad|certificad|\bcura|garantiz|elimina|es (el |un )?original/i,
];

// Candado de entrada: lo que se decide sin preguntarle al modelo.
export function reglaFija(pregunta: string): Decision | null {
  if (BORRAR.test(pregunta)) return { accion: "borrar", texto: "", motivo: "regla 01/10: ANMAT/RNPA/fórmula se borra" };
  if (IGNORAR.test(pregunta)) return { accion: "ignorar", texto: "", motivo: "regla 21/09: Factura A no se responde" };
  if (ORIGINAL.test(pregunta) && !YA_COMPRO.test(pregunta)) return { accion: "responder", texto: ORIGINALIDAD, motivo: "regla 30/09: originalidad, texto fijo" };
  return null;
}

// Candado de salida: una respuesta del modelo que lo rompa no se manda, se escala.
export function candadoSalida(d: Decision): Decision {
  if (d.accion !== "responder") return d;
  const t = d.texto.trim();
  if (!t) return { ...d, accion: "escalar", motivo: "candado: respuesta vacía" };
  if (t.length > 2000) return { ...d, accion: "escalar", motivo: "candado: >2000 caracteres (límite de ML)" };
  const re = PROHIBIDO_EN_RESPUESTA.find((r) => r.test(t));
  if (re) return { ...d, accion: "escalar", motivo: `candado: la respuesta tiene algo prohibido (${re.source.slice(0, 40)})` };
  return { ...d, texto: t };
}

const SISTEMA = `Respondés las preguntas pre-venta de BioLabs en MercadoLibre Argentina.

Tus fuentes son el título y la descripción de la publicación y las respuestas anteriores del vendedor en esa misma publicación: esas respuestas son el tono y los datos aprobados. No inventes nada que no esté ahí.

Elegí UNA acción:
- "responder": cuando podés contestar con esas fuentes. Tono de las respuestas anteriores: voseo, breve (idealmente menos de 350 caracteres), empieza con "¡Hola!" y cierra con "¡Saludos!" o "¡Quedamos a tu disposición!".
- "borrar": SOLO spam, insultos, publicidad de terceros o texto sin sentido.
- "escalar": todo lo demás que no puedas responder con seguridad. Siempre escalar si la persona ya compró y tiene un problema (no llegó, llegó roto, faltante, distinto a lo publicado, devolución, reembolso), si reporta un síntoma o efecto adverso, o si la pregunta es ambigua.

Reglas fijas del vendedor:
- Condición médica o medicación (presión, diabetes, tiroides, anticoagulantes, etc.): recomendar consultarlo con su médico antes de iniciar el consumo. Nunca afirmar que es seguro para esa condición.
- Embarazo, lactancia o menores de 18: no se recomienda; consultar con un profesional.
- Dosis y modo de uso: copiá el modo de uso de la descripción, no lo reformules con otros números.
- Vencimiento: el lote actual vence en octubre de 2028 (10/2028).
- Compras por cantidad o por mayor: se elige la cantidad de packs al momento de la compra en la publicación.
- Nunca: links, teléfonos, mails, WhatsApp ni redes; prometer resultados o plazos; las palabras "cura", "elimina", "garantiza"; mencionar ANMAT, RNPA o aprobaciones; decir que es "el original".

"texto" es la respuesta lista para publicar (vacío si no es "responder"). "motivo" es una línea que explica la decisión.`;

const FORMATO = {
  type: "json_schema" as const,
  schema: {
    type: "object",
    properties: {
      accion: { type: "string", enum: ["responder", "borrar", "escalar"] },
      texto: { type: "string" },
      motivo: { type: "string" },
    },
    required: ["accion", "texto", "motivo"],
    additionalProperties: false,
  },
};

async function decidirConModelo(client: Anthropic, contexto: string, pregunta: string): Promise<Decision> {
  const r = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-06-01"],
    fallbacks: [{ model: "claude-opus-4-8" }],
    output_config: { effort: "medium", format: FORMATO },
    system: SISTEMA,
    messages: [{ role: "user", content: `${contexto}\n\nPREGUNTA NUEVA:\n${pregunta}` }],
  });
  if (r.stop_reason === "refusal") return { accion: "escalar", texto: "", motivo: "el modelo declinó responder" };
  const txt = r.content.find((b) => b.type === "text");
  try {
    return JSON.parse(txt && txt.type === "text" ? txt.text : "") as Decision;
  } catch {
    return { accion: "escalar", texto: "", motivo: `salida del modelo ilegible (stop: ${r.stop_reason})` };
  }
}

type Pregunta = { id: number; item_id: string; text: string; date_created: string };
type Reclamo = {
  id: number; resource_id: number; type: string; stage: string; status: string; reason_id: string;
  players?: { type: string; available_actions?: { action: string; due_date?: string | null; mandatory?: boolean }[] }[];
};

// Huella de un reclamo: cuando cambia (etapa, estado o lo que el vendedor puede/debe hacer), avisa.
export function huellaReclamo(c: Reclamo): { estado: string; vence: string | null } {
  const acciones = c.players?.find((p) => p.type === "seller")?.available_actions ?? [];
  const obligatorias = acciones.filter((a) => a.mandatory && a.due_date).map((a) => a.due_date!).sort();
  const nombres = acciones.map((a) => a.action + (a.mandatory ? "!" : "")).sort().join(",");
  return { estado: `${c.stage}|${c.status}|${nombres}`, vence: obligatorias[0] ?? null };
}

export async function correrPostventa(db: Db = supabaseAdmin()) {
  const token = await getMlAccessToken(db);
  const seller = process.env.ML_SELLER_ID ?? "";
  const get = async (path: string) => {
    const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`ML ${path.split("?")[0]} → ${r.status}`);
    return r.json();
  };
  const escribir = (method: "POST" | "DELETE", path: string, body?: unknown) =>
    fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

  // Modo: 'borrador' (default) decide y guarda sin tocar ML; 'auto' publica y borra. Vive en
  // settings y no en una env para que pasar a auto (o volver) no pida redeploy.
  const { data: cfg } = await db.from("settings").select("value").eq("key", "ml_postventa").maybeSingle();
  const auto = (cfg?.value as { modo?: string } | null)?.modo === "auto";

  // --- Preguntas -------------------------------------------------------------------------------
  const { questions = [] } = (await get(
    `/questions/search?seller_id=${seller}&status=UNANSWERED&api_version=4&limit=50`,
  )) as { questions?: Pregunta[] };
  const client = new Anthropic();
  const contextos = new Map<string, string>();
  const preguntas: { id: string; accion: Accion; estado: string }[] = [];
  const errores: string[] = [];

  for (const q of questions) {
    const id = `q:${q.id}`;
    // La fila se toma ANTES de decidir: si dos corridas se pisan (Vercel puede disparar un cron dos
    // veces) solo una la consigue, y una pregunta nunca se contesta dos veces. Ya existente = ya
    // decidida; si quedó en borrador/escalada la contesta Pancho a mano.
    const { data: tomada, error: e1 } = await db.from("ml_postventa")
      .upsert({ id, tipo: "pregunta", recurso: q.item_id, texto: q.text, estado: "procesando" }, { onConflict: "id", ignoreDuplicates: true })
      .select("id");
    if (e1) throw new Error(`ml_postventa: ${e1.message}`);
    if (!tomada?.length) continue;

    try {
      let d = reglaFija(q.text);
      if (!d) {
        if (!contextos.has(q.item_id)) {
          const [item, desc, prev] = await Promise.all([
            get(`/items/${q.item_id}?attributes=title,price`),
            get(`/items/${q.item_id}/description`).catch(() => ({ plain_text: "" })),
            get(`/questions/search?item=${q.item_id}&status=ANSWERED&api_version=4&sort_fields=date_created&sort_types=DESC&limit=15`),
          ]);
          const qa = ((prev.questions ?? []) as { text: string; answer?: { text?: string } }[])
            .map((p) => `P: ${p.text}\nR: ${p.answer?.text ?? ""}`).join("\n\n");
          contextos.set(q.item_id, `PUBLICACIÓN: ${item.title} — $${item.price}\n\nDESCRIPCIÓN:\n${desc.plain_text}\n\nRESPUESTAS ANTERIORES DEL VENDEDOR:\n${qa}`);
        }
        d = candadoSalida(await decidirConModelo(client, contextos.get(q.item_id)!, q.text));
      }

      let estado = { responder: "borrador", borrar: "borrador", escalar: "escalada", ignorar: "ignorada" }[d.accion];
      if (auto && (d.accion === "responder" || d.accion === "borrar")) {
        const r = d.accion === "responder"
          ? await escribir("POST", "/answers", { question_id: q.id, text: d.texto })
          : await escribir("DELETE", `/questions/${q.id}`);
        estado = r.ok ? (d.accion === "responder" ? "enviada" : "borrada") : "error";
        if (!r.ok) d.motivo += ` · ML ${r.status}: ${(await r.text()).slice(0, 150)}`;
      }

      await db.from("ml_postventa").update({
        accion: d.accion, respuesta: d.texto || null, motivo: d.motivo, estado, cambio_at: new Date().toISOString(),
      }).eq("id", id);
      preguntas.push({ id, accion: d.accion, estado });
    } catch (e) {
      // Falla antes de escribir en ML (API de Claude caída, ML 5xx): se suelta la fila y la próxima
      // corrida reintenta. El error queda en sync_runs → salud_sistema lo marca ROJO.
      await db.from("ml_postventa").delete().eq("id", id);
      errores.push(`${id}: ${String(e).slice(0, 200)}`);
    }
  }

  // --- Reclamos --------------------------------------------------------------------------------
  const abiertos: Reclamo[] = [];
  for (let offset = 0; ; offset += 50) {
    const r = await get(`/post-purchase/v1/claims/search?status=opened&limit=50&offset=${offset}`);
    abiertos.push(...(r.data ?? []));
    if ((r.data ?? []).length < 50) break;
  }
  const { data: previos } = await db.from("ml_postventa").select("id, estado").eq("tipo", "reclamo");
  const antes = new Map((previos ?? []).map((p) => [p.id, p.estado as string]));
  const cambios: { id: string; estado: string; vence: string | null }[] = [];

  for (const c of abiertos) {
    const id = `c:${c.id}`;
    const h = huellaReclamo(c);
    if (antes.get(id) === h.estado) continue;
    const { error } = await db.from("ml_postventa").upsert({
      id, tipo: "reclamo", recurso: String(c.resource_id), texto: `${c.type} · ${c.reason_id}`,
      estado: h.estado, vence: h.vence, cambio_at: new Date().toISOString(),
    });
    if (error) throw new Error(`ml_postventa: ${error.message}`);
    cambios.push({ id, ...h });
  }
  // Los que ya no están abiertos se cierran (sin aviso: lo que importa es lo que pide acción).
  const vivos = abiertos.map((c) => `c:${c.id}`);
  const cerrar = [...antes].filter(([id, e]) => e !== "cerrado" && !vivos.includes(id)).map(([id]) => id);
  if (cerrar.length) await db.from("ml_postventa").update({ estado: "cerrado" }).in("id", cerrar);

  return { modo: auto ? "auto" : "borrador", sinResponder: questions.length, preguntas, errores, reclamos: abiertos.length, cambios, cerrados: cerrar.length };
}

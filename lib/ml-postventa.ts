import Anthropic from "@anthropic-ai/sdk";
import { splitPhone } from "@/lib/correo";
import { getMlAccessToken, parseMlPack } from "@/lib/ml";
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
  id: number; resource: string; resource_id: number; type: string; stage: string; status: string;
  reason_id: string; quantity_type?: string;
  players?: { type: string; available_actions?: { action: string; due_date?: string | null; mandatory?: boolean }[] }[];
};
type Mensaje = { sender_role: string; message?: string; date_created: string };
type MensajePack = { id: string; from: { user_id: number }; text?: string; message_date: { created: string } };

// Huella de un reclamo: cuando cambia (etapa, estado, lo que el vendedor puede/debe hacer o un mensaje
// nuevo del mediador), se analiza de nuevo y avisa. En `dispute` el mediador es el bot de ML: cada
// mensaje suyo es una pregunta o un menú que espera respuesta.
export function huellaReclamo(c: Reclamo, ultimoMediador = ""): { estado: string; vence: string | null } {
  const acciones = c.players?.find((p) => p.type === "seller")?.available_actions ?? [];
  const obligatorias = acciones.filter((a) => a.mandatory && a.due_date).map((a) => a.due_date!).sort();
  const nombres = acciones.map((a) => a.action + (a.mandatory ? "!" : "")).sort().join(",");
  return { estado: `${c.stage}|${c.status}|${nombres}|${ultimoMediador}`, vence: obligatorias[0] ?? null };
}

// Rotos: 9972/9946 = embalaje sano (afectó la reputación 17 de 18 veces), 9973/9947 = embalaje dañado
// (21 de 21 sin afectar). docs/ml-claims-api-2026-10-01.md §1 y §4.
export const ROTO = new Set(["PDD9972", "PDD9973", "PDD9946", "PDD9947"]);

// Número de opción del menú del bot mediador ("4. **Reembolso parcial sin devolución** — …").
export function opcionDelMenu(menu: string, tipo: "parcial" | "total"): number | null {
  const m = menu.match(new RegExp(`^\\s*(\\d+)\\.\\s*\\*\\*Reembolso ${tipo} sin devoluci[oó]n\\*\\*`, "im"));
  return m ? Number(m[1]) : null;
}

// Regla de Pancho (01/10/2026) para rotos: reintegro SIN devolución por la proporción de frascos rotos
// (1 de 2 → 50%) y pelea por la reputación culpando al transporte. La elección va PRIMERO en el mensaje:
// el bot ejecuta la primera opción que entiende y cada mensaje es una decisión irreversible (§3).
export function planRoto(rotos: number, total: number, menu: string): { texto: string; pct: number } | { escalar: string } {
  if (!Number.isInteger(rotos) || rotos < 1 || rotos > total) return { escalar: `no se pudo leer cuántos frascos rotos (${rotos} de ${total})` };
  const pct = Math.round((rotos / total) * 100);
  const tipo = pct === 100 ? "total" : "parcial";
  const n = opcionDelMenu(menu, tipo);
  if (!n) return { escalar: `el menú del mediador no ofrece reembolso ${tipo} sin devolución` };
  const eleccion = tipo === "total"
    ? `Elegimos la opción ${n}: reembolso total sin devolución`
    : `Elegimos la opción ${n}: reembolso parcial sin devolución del ${pct}%`;
  return {
    pct,
    texto: `${eleccion}, por ${rotos} de ${total} frascos rotos. Los goteros salen de nuestro depósito sellados y bien embalados: la rotura ocurrió en el transporte, por maltrato del paquete en la logística. Pedimos que este reclamo no afecte nuestra reputación.`,
  };
}

// Textos aprobados por Pancho (02/10/2026). Nunca "es el original" (regla 30/09).
export const NO_ORIGINAL =
  "Hola. Este producto lo elaboramos y despachamos nosotros, y lo enviado coincide con la publicación: frasco de 30 ml, la etiqueta de las fotos y la composición de la descripción. Cada frasco sale sellado con su precinto. No tenemos relación con otras páginas que venden productos con nombre parecido. Pedimos que este reclamo no afecte nuestra reputación, porque entregamos lo publicado.";
// Sin mencionar la devolución ni ofrecer nada (Pancho, 02/10/2026).
export const NO_HACE_NADA =
  "¡Hola! Lamentamos que todavía no notes cambios. Es un suplemento herbal y los resultados varían según cada persona: se aprecian con uso constante. Te recomendamos 15 gotas por día en ayunas, diluidas en agua, jugo o infusión, y desde la segunda semana 15-20 gotas dos veces por día. Cualquier duda, escribinos por acá.";
// Un arrepentimiento que no es por eficacia ("me equivoqué de sabor") no lleva el texto de B.
const DICE_QUE_NO_ANDA = /no (me )?(hace|funciona|sirve|anda)|no (not[eé]|veo|siento)|sin (efecto|resultado|cambio)|ning[uú]n (efecto|resultado|cambio)/i;

// Reposición (faltante, roto, volcado): ML nunca da celular ni mail del comprador y sin ellos el courier
// no le avisa nada (regla 01/10). El canal existe solo mientras el comprador escribe — el vendedor no
// puede iniciar (403 blocked_by_conversation_initiated_by_seller_limited, 02/10) —, así que se piden en
// esa misma corrida. No nombra courier: desde el 03/10 el anticipado sale por Urbano, no por Correo.
export const PEDIDO_DATOS =
  "¡Hola! Te lo reponemos sin costo. Para coordinar la entrega, pasanos por acá tu celular con código de área y tu mail, y confirmanos si el domicilio es el mismo de la compra. ¡Gracias!";
// En mediación el canal es el mediador: se ofrece el envío y se le piden los datos del comprador.
export const OFRECE_FALTANTE =
  "Hola. Reconocemos el faltante y le enviamos al comprador lo que falta, sin costo, por Urbano a su domicilio. Para coordinar la entrega necesitamos que nos pase su celular con código de área y su mail, y que confirme si el domicilio es el mismo de la compra.";
export const FALTANTE =
  /incomplet|falt(a|an|aba|aron|[oó])\s+(un|uno|dos|1|2|frasco|gotero)|s[oó]lo\s+(1|uno|un frasco|un gotero)\b|\b(1|uno|un frasco)\s+s[oó]lo\b/i;
export const PIDE_REPOSICION =
  /\brot[oa]s?\b|\brompi|volcad|derramad|perdiendo|incomplet|falt(a|an|aba|aron|[oó])\s+(un|uno|dos|1|2|frasco|gotero)|s[oó]lo\s+(1|uno|un frasco|un gotero)\b|\b(1|uno|un frasco)\s+s[oó]lo\b|lleg[oó]\s+vac[ií]o/i;

// La reposición sale por Urbano 2 (cuenta 4565, guía BLABSA<orden>, desde el 03/10). El rastreo público
// pide cuenta + guía pegadas: segui-tu-envio arma cespecifica?shi_codigo=00<4 primeros>&cli_codigo=<resto>
// (verificado con BLABSA27789 el 03/10, sin captcha). Nunca link con https: solo el dominio.
// Urbano corta el código a 16 caracteres sin avisar (05/10: BLABSA2000018620524242 quedó BLABSA2000018620):
// una orden de ML entera no entra, va BLABSA<últimos 10 dígitos>. Más largo = no es la guía real.
export function textoSeguimiento(guia: string): string | null {
  const g = guia.trim().toUpperCase().replace(/^4565/, "");
  if (!/^BLABSA\d{1,10}$/.test(g)) return null;
  return `¡Hola! Tu reposición ya salió por Urbano. Código de seguimiento: 4565${g}. Lo seguís en urbano.com.ar/segui-tu-envio. ¡Saludos!`;
}

export type Contacto = { orden?: string; email?: string; area?: string; cel?: string; guia?: string };
const MAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const TEL = /\+?\d[\d\s().-]{7,}\d/g;
// Celular y mail que escribió el comprador. ponytail: un celular sin código de área no se adivina —
// queda "datos incompletos" y lo ve Pancho en el aviso.
export function contactoDe(t: string): Contacto {
  const email = t.match(MAIL)?.[0].toLowerCase();
  const tel = (t.match(TEL) ?? []).map(splitPhone).find(Boolean);
  return { ...(email ? { email } : {}), ...(tel ? { area: tel.area, cel: tel.cel } : {}) };
}
// `texto` sale en el mail de salud (log de GitHub Actions): sin mail ni teléfono del comprador.
export const sinContacto = (t: string) => t.replace(new RegExp(MAIL, "g"), "[mail]").replace(TEL, "[tel]");

// Qué le escribe el agente a un reclamo (una sola vez por reclamo): rotos en mediación (regla 01/10),
// "no es original" cuando ML habilita escribirle al mediador, y arrepentimiento "no hace nada" antes
// de la mediación (reglas 02/10). Sin canal habilitado no hay mensaje: la API daría 400.
export function respuestaReclamo(c: Reclamo, msgs: Mensaje[], rotos: number, frascos: number):
  { rol: "mediator" | "complainant"; texto: string; accion: string } | { escalar: string } | null {
  const acciones = (c.players?.find((p) => p.type === "seller")?.available_actions ?? []).map((a) => a.action);
  if (ROTO.has(c.reason_id)) {
    // ponytail: solo `dispute` y reclamo total — en `claim` (allow_partial_refund) o parcial, escala.
    if (c.stage !== "dispute" || c.quantity_type !== "total") return { escalar: `roto en etapa ${c.stage} / reclamo ${c.quantity_type}: lo decide Pancho` };
    const p = planRoto(rotos, frascos, msgs.findLast((m) => m.sender_role === "mediator")?.message ?? "");
    return "escalar" in p ? p : { rol: "mediator", texto: p.texto, accion: `reintegro ${p.pct}%` };
  }
  if (c.reason_id === "PDD9943" && acciones.includes("send_message_to_mediator"))
    return { rol: "mediator", texto: NO_ORIGINAL, accion: "respuesta no original" };
  // Faltante (PDD9952 o el comprador lo dice con otro motivo), en cualquier etapa: SIEMPRE se ofrece
  // enviar lo que falta y se piden los datos (Pancho, 05/10). Los rotos no: van por la regla de arriba.
  // Si ya le escribimos a mano (respondent), no se pisa lo que se dijo.
  const comprador = msgs.filter((m) => m.sender_role === "complainant").map((m) => m.message ?? "").join(" ");
  if ((c.reason_id === "PDD9952" || FALTANTE.test(comprador)) && !msgs.some((m) => m.sender_role === "respondent")) {
    if (acciones.includes("send_message_to_complainant")) return { rol: "complainant", texto: PEDIDO_DATOS, accion: "pedido datos" };
    if (acciones.includes("send_message_to_mediator")) return { rol: "mediator", texto: OFRECE_FALTANTE, accion: "pedido datos" };
  }
  if (c.reason_id === "PDD9939" && acciones.includes("send_message_to_complainant") && DICE_QUE_NO_ANDA.test(comprador))
    return { rol: "complainant", texto: NO_HACE_NADA, accion: "respuesta no hace nada" };
  return null;
}

const SISTEMA_RECLAMO = `Analizás reclamos de compradores de BioLabs en MercadoLibre Argentina (suplementos en gotero, frascos de vidrio de 30 ml). Te paso el motivo, la orden y los últimos mensajes. En la etapa "dispute" el mediador es el asistente virtual de ML, que propone un menú numerado de soluciones con un plazo.

Devolvé:
- "analisis": máximo 3 líneas para el dueño del negocio: qué reclama el comprador, qué opciones y qué plazo da ML, y qué conviene hacer. Sin datos personales del comprador (nombre, teléfono, dirección).
- "rotos": si el reclamo es porque llegaron frascos rotos, derramados o dañados, cuántos FRASCOS llegaron rotos según lo que describen el comprador o el mediador. 0 si el reclamo no es por rotura o si el número no está claro.`;

const FORMATO_RECLAMO = {
  type: "json_schema" as const,
  schema: {
    type: "object",
    properties: { analisis: { type: "string" }, rotos: { type: "integer" } },
    required: ["analisis", "rotos"],
    additionalProperties: false,
  },
};

export async function analizarReclamo(client: Anthropic, contexto: string): Promise<{ analisis: string; rotos: number }> {
  const r = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-06-01"],
    fallbacks: [{ model: "claude-opus-4-8" }],
    output_config: { effort: "medium", format: FORMATO_RECLAMO },
    system: SISTEMA_RECLAMO,
    messages: [{ role: "user", content: contexto }],
  });
  const txt = r.content.find((b) => b.type === "text");
  try {
    const a = JSON.parse(txt && txt.type === "text" ? txt.text : "");
    // El análisis termina en el log de GitHub Actions: un teléfono (10-11 dígitos) no sale de la base.
    return { ...a, analisis: String(a.analisis).replace(/\b\d{10,11}\b/g, "[tel]") };
  } catch {
    return { analisis: `sin análisis (stop: ${r.stop_reason})`, rotos: 0 };
  }
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
  const { data: previos } = await db.from("ml_postventa").select("id, estado, accion, contacto").eq("tipo", "reclamo");
  const antes = new Map((previos ?? []).map((p) => [p.id, p.estado as string]));
  const previo = new Map((previos ?? []).map((p) => [p.id, p]));
  const cambios: { id: string; estado: string; vence: string | null }[] = [];

  // Respuesta a PEDIDO_DATOS: suma lo nuevo a lo ya capturado y, si cambió, lo guarda y avisa.
  const ESPERA_DATOS = ["pedido datos", "datos incompletos"];
  const capturar = async (id: string, ya: Contacto | null, texto: string) => {
    const c: Contacto = { ...(ya ?? {}), ...contactoDe(texto) };
    if ((["email", "area", "cel"] as const).every((k) => c[k] === ya?.[k])) return;
    const ok = c.email && c.cel;
    await db.from("ml_postventa").update({
      contacto: c,
      accion: ok ? "datos ok" : "datos incompletos",
      motivo: ok ? "celular y mail capturados (columna contacto)" : `falta ${c.email ? "el celular con código de área" : c.cel ? "el mail" : "celular y mail"}`,
      cambio_at: new Date().toISOString(),
    }).eq("id", id);
  };

  for (const c of abiertos) {
    const id = `c:${c.id}`;
    try {
      const r = await get(`/post-purchase/v1/claims/${c.id}/messages`);
      const msgs = ((Array.isArray(r) ? r : r.data ?? []) as Mensaje[]) // vienen del más nuevo al más viejo
        .sort((a, b) => a.date_created.localeCompare(b.date_created));
      // La huella mira solo al mediador: la respuesta del comprador a PEDIDO_DATOS se lee acá.
      const pv = previo.get(id);
      if (ESPERA_DATOS.includes(pv?.accion ?? ""))
        await capturar(id, pv?.contacto ?? null, msgs.filter((m) => m.sender_role === "complainant").map((m) => m.message ?? "").join(" "));
      const menu = msgs.findLast((m) => m.sender_role === "mediator");
      const h = huellaReclamo(c, menu?.date_created ?? "");
      if (antes.get(id) === h.estado) continue;

      const [orden, razon] = await Promise.all([
        c.resource === "order" ? get(`/orders/${c.resource_id}`) : null,
        get(`/post-purchase/v1/claims/reasons/${c.reason_id}`).catch(() => ({})),
      ]);
      const items = ((orden?.order_items ?? []) as { quantity: number; item: { id: string; title: string } }[]);
      const frascos = items.reduce((s, i) => s + i.quantity * parseMlPack(i.item.title, i.item.id), 0);
      const contexto = `MOTIVO: ${c.reason_id} ${razon.name ?? ""} — ${razon.detail ?? ""}\nETAPA: ${c.stage} · ${c.status}\n` +
        `ORDEN: ${items.map((i) => `${i.quantity} × ${i.item.title}`).join(" + ") || "?"} (${frascos} frascos en total)\n\n` +
        `MENSAJES (del más viejo al más nuevo):\n${msgs.slice(-6).map((m) => `[${m.sender_role} ${m.date_created.slice(0, 16)}] ${m.message ?? ""}`).join("\n\n")}`;
      const a = await analizarReclamo(client, contexto);

      const { error } = await db.from("ml_postventa").upsert({
        id, tipo: "reclamo", recurso: String(c.resource_id), texto: `${c.reason_id} ${razon.name ?? c.type}`,
        motivo: a.analisis, estado: h.estado, vence: h.vence, cambio_at: new Date().toISOString(),
      });
      if (error) throw new Error(`ml_postventa: ${error.message}`);
      cambios.push({ id, ...h });

      // UN solo mensaje automático por reclamo, nunca más (accion queda marcada). Lo que conteste el
      // bot o el comprador lo ve Pancho en el aviso: una segunda respuesta automática sería otra
      // decisión tomada a ciegas (con el bot mediador, irreversible).
      if (!auto) continue;
      const p = respuestaReclamo(c, msgs, a.rotos, frascos);
      if (!p) continue;
      if ("escalar" in p) {
        await db.from("ml_postventa").update({ motivo: `${a.analisis} · NO SE RESPONDIÓ SOLO: ${p.escalar}` }).eq("id", id);
        continue;
      }
      const { data: tomado } = await db.from("ml_postventa").update({ accion: "procesando" }).eq("id", id).is("accion", null).select("id");
      if (!tomado?.length) continue;
      const w = await escribir("POST", `/post-purchase/v1/claims/${c.id}/actions/send-message`, { receiver_role: p.rol, message: p.texto });
      await db.from("ml_postventa").update({
        accion: w.ok ? p.accion : "error",
        respuesta: p.texto,
        motivo: w.ok ? a.analisis : `${a.analisis} · ML ${w.status}: ${(await w.text()).slice(0, 150)}`,
        cambio_at: new Date().toISOString(),
      }).eq("id", id);
    } catch (e) {
      errores.push(`${id}: ${String(e).slice(0, 200)}`);
    }
  }
  // Los que ya no están abiertos se cierran (sin aviso: lo que importa es lo que pide acción).
  const vivos = abiertos.map((c) => `c:${c.id}`);
  const cerrar = [...antes].filter(([id, e]) => e !== "cerrado" && !vivos.includes(id)).map(([id]) => id);
  if (cerrar.length) await db.from("ml_postventa").update({ estado: "cerrado" }).in("id", cerrar);

  // --- Mensajes post-venta (packs) -------------------------------------------------------------
  // Se contestan a mano con OK de Pancho sobre el lote (regla 21/09): el agente solo avisa. Única
  // excepción (02/10): un faltante/roto/volcado reportado desde la última corrida, con el pedido ya
  // entregado, recibe PEDIDO_DATOS en el acto. Más viejo que eso es backlog: solo aviso.
  const { results: noLeidos = [] } = (await get(`/messages/unread?role=seller&tag=post_sale`)) as { results?: { resource: string }[] };
  const { data: packsPrev } = await db.from("ml_postventa").select("id, estado, accion, contacto").eq("tipo", "pack");
  const packAntes = new Map((packsPrev ?? []).map((p) => [p.id, p]));
  // Los que esperan datos se leen aunque ya no figuren sin leer (alguien abrió el chat en ML).
  const packIds = new Set([
    ...noLeidos.map((u) => u.resource.match(/packs\/(\d+)/)?.[1]).filter((x): x is string => !!x),
    ...(packsPrev ?? []).filter((p) => ESPERA_DATOS.includes(p.accion ?? "")).map((p) => p.id.slice(2)),
  ]);
  const packs: { id: string; accion: string | null }[] = [];

  for (const pack of packIds) {
    const id = `p:${pack}`;
    try {
      const t = await get(`/messages/packs/${pack}/sellers/${seller}?tag=post_sale&mark_as_read=false`);
      const msgs = ((t.messages ?? []) as MensajePack[]).sort((a, b) => a.message_date.created.localeCompare(b.message_date.created));
      const delComprador = msgs.filter((m) => String(m.from.user_id) !== seller);
      const ultimo = delComprador.at(-1);
      const prev = packAntes.get(id);
      if (!ultimo || prev?.estado === ultimo.id) continue; // huella: el último mensaje del comprador
      const { error } = await db.from("ml_postventa").upsert({
        id, tipo: "pack", recurso: pack, texto: sinContacto(ultimo.text ?? "").slice(0, 500), estado: ultimo.id,
        motivo: "mensaje nuevo del comprador: se contesta a mano", cambio_at: new Date().toISOString(),
      });
      if (error) throw new Error(`ml_postventa: ${error.message}`);
      packs.push({ id, accion: prev?.accion ?? null });

      const textoComprador = delComprador.map((m) => m.text ?? "").join(" ");
      if (ESPERA_DATOS.includes(prev?.accion ?? "")) {
        await capturar(id, prev?.contacto ?? null, textoComprador);
        continue;
      }
      if (!auto || prev?.accion || msgs.at(-1) !== ultimo || t.conversation_status?.status !== "active") continue;
      if (!PIDE_REPOSICION.test(textoComprador) || Date.now() - Date.parse(ultimo.message_date.created) > 3 * 3600_000) continue;
      const p = await get(`/packs/${pack}`).catch(() => null);
      const orden = await get(`/orders/${p?.orders?.[0]?.id ?? pack}`);
      if (!orden.tags?.includes("delivered")) continue; // antes de la entrega, "roto/falta" no es un reporte

      const { data: tomado } = await db.from("ml_postventa").update({ accion: "procesando" }).eq("id", id).is("accion", null).select("id");
      if (!tomado?.length) continue;
      const w = await escribir("POST", `/messages/packs/${pack}/sellers/${seller}?tag=post_sale`, {
        from: { user_id: Number(seller) }, to: { user_id: orden.buyer.id }, text: PEDIDO_DATOS,
      });
      const body = await w.json().catch(() => ({}));
      await db.from("ml_postventa").update({
        accion: w.ok ? "pedido datos" : "error",
        respuesta: PEDIDO_DATOS,
        contacto: { orden: String(orden.id) },
        motivo: w.ok
          ? `reposición: se pidieron celular y mail (moderación ${body.message_moderation?.status ?? "?"})`
          : `ML ${w.status}: ${JSON.stringify(body).slice(0, 150)}`,
        cambio_at: new Date().toISOString(),
      }).eq("id", id);
    } catch (e) {
      errores.push(`${id}: ${String(e).slice(0, 200)}`);
    }
  }

  // --- Seguimiento de la reposición -------------------------------------------------------------
  // Quien da de alta la reposición en Urbano 2 deja la guía en contacto.guia; el agente la manda una
  // sola vez en el mismo hilo (pack o reclamo) en la corrida siguiente.
  const { data: conGuia } = await db.from("ml_postventa").select("id, accion, contacto")
    .not("contacto->>guia", "is", null).or('accion.is.null,accion.not.in.("seguimiento enviado","error seguimiento")');
  for (const r of auto ? conGuia ?? [] : []) {
    const texto = textoSeguimiento(String(r.contacto.guia));
    if (!texto) {
      if (r.accion !== "error guia") await db.from("ml_postventa").update({ accion: "error guia", motivo: `guía "${r.contacto.guia}" no es BLABSA<número>`, cambio_at: new Date().toISOString() }).eq("id", r.id);
      continue;
    }
    const toma = db.from("ml_postventa").update({ accion: "procesando" }).eq("id", r.id);
    const { data: tomado } = await (r.accion === null ? toma.is("accion", null) : toma.eq("accion", r.accion)).select("id");
    if (!tomado?.length) continue;
    try {
      const [tipo, rid] = [r.id.slice(0, 1), r.id.slice(2)];
      const w = tipo === "c"
        ? await escribir("POST", `/post-purchase/v1/claims/${rid}/actions/send-message`, { receiver_role: "complainant", message: texto })
        : await escribir("POST", `/messages/packs/${rid}/sellers/${seller}?tag=post_sale`, {
            from: { user_id: Number(seller) }, to: { user_id: (await get(`/orders/${r.contacto.orden ?? rid}`)).buyer.id }, text: texto,
          });
      const body = await w.json().catch(() => ({}));
      await db.from("ml_postventa").update({
        accion: w.ok ? "seguimiento enviado" : "error seguimiento", // un error no se reintenta solo: avisa una vez
        respuesta: texto,
        motivo: w.ok ? `seguimiento enviado (moderación ${body.message_moderation?.status ?? "?"})` : `seguimiento: ML ${w.status}: ${JSON.stringify(body).slice(0, 150)}`,
        cambio_at: new Date().toISOString(),
      }).eq("id", r.id);
    } catch (e) {
      await db.from("ml_postventa").update({ accion: r.accion }).eq("id", r.id); // se suelta: reintenta en la próxima
      errores.push(`${r.id}: ${String(e).slice(0, 200)}`);
    }
  }

  return { modo: auto ? "auto" : "borrador", sinResponder: questions.length, preguntas, errores, reclamos: abiertos.length, cambios, cerrados: cerrar.length, packs };
}

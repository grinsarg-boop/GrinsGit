// Nombres de campaña/anuncio de Meta → etiqueta compacta. El slug crudo es enorme
// (abo-cv01-beevenom-03-angv01-video-v02-mix25-45): en pantalla va label, el crudo queda en title=.
// Convención del negocio:
//   campaña: {tipo}-cv{NN}-{producto}-{NN}-{landing}[-{zona}]   tipo ∈ abo|cbo|cxr  (+ legacy sueltos)
//   ad:      ...-angv{NN}-{formato}-...-v{NN}-{audiencia}-{ID}   formato ∈ video|foto|mix  (+ free-form viejo)
// Los que no matchean caen a un acortado sensato — nunca queda el slug largo en pantalla.

const TIPO: Record<string, string> = { abo: "ABO", cbo: "CBO", cxr: "CxR" };
const PROD: Record<string, string> = {
  beevenom: "Beevenom", bee: "Beevenom",
  natures: "Nature's", naturessunrise: "Nature's",
  pureza: "Pureza", purezadrops: "Pureza",
  veinguard: "VeinGuard", ve: "VeinGuard",
  nubba: "Nubba", nu: "Nubba", altus: "Altus",
};
const titleCase = (s: string) => s.replace(/\b[a-z]/g, (m) => m.toUpperCase());
const prettyProd = (p: string) =>
  PROD[p] ?? PROD[p.replace(/\s+/g, "")] ?? PROD[p.split(/\s+/)[0]] ?? (p ? titleCase(p) : p);

// saca IDs de Meta (11+ dígitos), el token 1-3 dígitos que los precede, y "Copia"
const stripIds = (s: string) =>
  s.replace(/\bcopia\b/gi, " ")
    .replace(/\b\d{1,3}\s+(?=\d{11,}\b)/g, " ")
    .replace(/\b\d{11,}\b/g, " ")
    .replace(/[-\s]{2,}/g, " ")
    .replace(/^[-\s]+|[-\s]+$/g, "")
    .trim();

export type CampaignLabel = { label: string; tipo: string | null; producto: string | null };

export function campaignLabel(name: string | null): CampaignLabel {
  if (!name) return { label: "(sin atribución)", tipo: null, producto: null };
  const s = name.trim();
  const m = s.match(/^(abo|cbo|cxr)-cv(\d+)-([a-z]+)-(\d+)(?:-([a-z]+))?(?:\s*-\s*([a-z]+))?$/i);
  if (m) {
    const tipo = TIPO[m[1].toLowerCase()];
    const producto = prettyProd(m[3].toLowerCase());
    const zona = m[6] ? m[6].toUpperCase() : null;
    return { label: `${producto} · ${tipo}${zona ? " · " + zona : ""}`, tipo, producto };
  }
  // legacy suelto ("Nu - Nubba ABO", "Bee Venom | CBO"): tipo en cualquier lado, producto = palabra líder
  const tm = s.match(/\b(abo|cbo|cxr)\b/i);
  const tipo = tm ? TIPO[tm[1].toLowerCase()] : null;
  const head = s.split(/\s*[-|]\s*/)[0].replace(/\b(abo|cbo|cxr)\b/i, "").trim().toLowerCase();
  const producto = head ? prettyProd(head) : null;
  const label = tipo && producto ? `${producto} · ${tipo}` : (stripIds(s).slice(0, 30) || s.slice(0, 30));
  return { label, tipo, producto };
}

export type AdLabel = { label: string; formato: string | null };

export function adLabel(name: string | null): AdLabel {
  if (!name) return { label: "(sin nombre)", formato: null };
  const s = stripIds(name).replace(/--+/g, "-");
  const m = s.match(/angv(\d+)-(video|foto|mix)(?:-[a-z]+)?-v(\d+)-([a-z0-9-]+?)(?:-[A-Z][a-z]+)?$/i);
  if (m) {
    const formato = m[2].toLowerCase();
    return { label: `áng${m[1].padStart(2, "0")} · ${formato} v${m[3].padStart(2, "0")} · ${m[4].toLowerCase()}`, formato };
  }
  const m2 = s.match(/-(video|foto|mix)-(?:[a-z0-9]+-)?v(\d+)-([a-z0-9-]+)$/i);
  if (m2) {
    const formato = m2[1].toLowerCase();
    return { label: `${formato} v${m2[2].padStart(2, "0")} · ${m2[3].toLowerCase()}`, formato };
  }
  const fm = /video/i.test(name) ? "video" : /(foto|imagen|static|estat)/i.test(name) ? "foto" : null;
  return { label: stripIds(name).slice(0, 28) || name.slice(0, 28), formato: fm };
}

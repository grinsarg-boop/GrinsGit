// Markdown mínimo para las respuestas del asistente — solo el subset que emite el modelo:
// párrafos, listas (- / * / 1.), **negrita**, *itálica* / _itálica_, `código`, # títulos.
// Puro (sin React) para poder testearlo; el widget mapea la estructura a JSX.
// ponytail: no metemos react-markdown (dep pesada) para 5 marcas controladas. Si el modelo
// empezara a emitir tablas/links/nested, ahí sí conviene la lib.

export type Inline = { k: "text" | "b" | "i" | "code"; v: string };
export type Block =
  | { type: "p"; inlines: Inline[] }
  | { type: "h"; inlines: Inline[] }
  | { type: "ul"; items: Inline[][] }
  | { type: "ol"; items: Inline[][] };

// **negrita** | `código` | *itálica* | _itálica_ (dentro de una línea, no cruza \n)
const INLINE = /\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_/g;

export function tokenizeInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ k: "text", v: text.slice(last, i) });
    const t = m[0];
    if (t.startsWith("**")) out.push({ k: "b", v: t.slice(2, -2) });
    else if (t.startsWith("`")) out.push({ k: "code", v: t.slice(1, -1) });
    else out.push({ k: "i", v: t.slice(1, -1) });
    last = i + t.length;
  }
  if (last < text.length) out.push({ k: "text", v: text.slice(last) });
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  let list: { type: "ul" | "ol"; items: Inline[][] } | null = null;
  const flush = () => { if (list) { blocks.push(list); list = null; } };
  for (const raw of src.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { flush(); continue; }
    const bullet = line.match(/^\s*[-*]\s+(.*)/);
    const num = line.match(/^\s*\d+[.)]\s+(.*)/);
    const head = line.match(/^\s*#{1,3}\s+(.*)/);
    if (bullet) {
      if (list?.type !== "ul") { flush(); list = { type: "ul", items: [] }; }
      list.items.push(tokenizeInline(bullet[1]));
    } else if (num) {
      if (list?.type !== "ol") { flush(); list = { type: "ol", items: [] }; }
      list.items.push(tokenizeInline(num[1]));
    } else {
      flush();
      blocks.push(head ? { type: "h", inlines: tokenizeInline(head[1]) } : { type: "p", inlines: tokenizeInline(line) });
    }
  }
  flush();
  return blocks;
}

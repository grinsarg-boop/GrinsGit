"use client";

import { useRef, useState } from "react";
import { extractLabels, packBreakdown, type Label, type LabelCourier } from "@/lib/label-picking";
import { buildPdf, sortOrder } from "@/lib/label-prep";
import { productoCode } from "@/lib/correo";
import { fetchOrders } from "./picking";
import { download } from "./correo";
import { Dropzone } from "@/components/ui/dropzone";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const COURIER: Record<string, string> = { urbano: "Urbano", fixy: "Fixy", correo: "Correo", ml: "ML", flex: "Flex", "?": "¿?" };
const COD = new Set<LabelCourier>(["urbano", "fixy", "correo"]);

type Row = {
  file: number;              // índice en `bufs`
  page: number;              // 1-indexed en el PDF de origen
  archivo: string;
  courier: LabelCourier;
  orden: string | null;
  producto: string | null;
  unidades: number | null;
  code: string;              // editable antes de estampar
  nota: string;              // por qué quedó sin resolver
};

export function Preparar() {
  // Los buffers en un ref, no en state: Row.file es un índice acá y con dos tandas seguidas un
  // state viejo daría el índice equivocado — o sea, la etiqueta de otro pedido en el PDF final.
  const bufsRef = useRef<ArrayBuffer[]>([]);
  const [metas, setMetas] = useState<{ name: string; size: number }[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFiles(fl: FileList) {
    setBusy(true);
    setMsg(null);
    try {
      const nuevasMetas: { name: string; size: number }[] = [];
      const raw: (Label & { fileIdx: number })[] = [];
      for (const f of Array.from(fl)) {
        const buf = await f.arrayBuffer();
        const fileIdx = bufsRef.current.push(buf) - 1;
        nuevasMetas.push({ name: f.name, size: f.size });
        // extractLabels hace su propio slice(0): el buffer sigue vivo para pdf-lib.
        for (const l of await extractLabels(buf, f.name)) raw.push({ ...l, fileIdx });
      }

      // COD: la etiqueta trae el N° de pedido pero no qué lleva → Shopify (en tandas de 60).
      const ordenes = [...new Set(raw.filter((l) => COD.has(l.courier) && l.orden).map((l) => l.orden!))];
      const ord = new Map((ordenes.length ? await fetchOrders(ordenes) : []).map((o) => [o.orden, o]));

      const nuevas: Row[] = raw.map((l) => {
        const base = {
          file: l.fileIdx, page: l.page, archivo: l.file ?? "", courier: l.courier,
          orden: l.orden, producto: null as string | null, unidades: null as number | null,
          code: "", nota: "",
        };
        if (!COD.has(l.courier)) {
          // ML/Flex: producto y unidades vienen de la etiqueta misma. Sin código: el hueco donde
          // estamparlo no está validado en ese layout (y para ML está el tab "Etiquetas ML").
          return {
            ...base,
            producto: l.revisar ? null : l.producto,
            unidades: l.revisar ? null : l.unidades,
            nota: l.courier === "?" ? "página no reconocida" : l.revisar ? "ML mixta o multi-compra" : "",
          };
        }
        if (!l.orden) return { ...base, nota: "sin N° de pedido legible" };
        const o = ord.get(l.orden);
        // error (429/5xx) ≠ no existe: el primero se arregla reintentando, el segundo no.
        if (!o || o.error) return { ...base, nota: "error al consultar Shopify — reintentá" };
        if (!o.encontrado) return { ...base, nota: "no existe en Shopify" };
        // Misma regla que pickProducto: solo si TODOS los ítems son el mismo producto (audit C#3).
        const prods = [...new Set(o.items.map((i) => i.producto).filter(Boolean))] as string[];
        const producto = prods.length === 1 ? prods[0] : null;
        const unidades = producto ? o.items.reduce((s, i) => s + i.unidades, 0) : null;
        return {
          ...base, producto, unidades,
          code: productoCode({ producto, qty: unidades ?? 0 }) ?? "",
          nota: producto ? "" : "carrito mixto o sin producto — poné el código a mano",
        };
      });

      const todas = [...rows, ...nuevas];
      setMetas((p) => [...p, ...nuevasMetas]);
      setRows(sortOrder(todas).map((i) => todas[i]));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function descargar() {
    setBusy(true);
    try {
      const { pdf, sinEstampar } = await buildPdf(
        bufsRef.current.map((b) => b.slice(0)),
        rows.map((r) => ({ file: r.file, page: r.page, courier: r.courier, code: r.code.trim().toUpperCase() || null })),
      );
      download("etiquetas_ordenadas.pdf", new Blob([pdf as BlobPart], { type: "application/pdf" }));
      setMsg(sinEstampar
        ? `⚠️ ${sinEstampar} etiqueta(s) salieron SIN código: la página no tiene la medida validada para su courier, y estampar a ciegas puede tapar el código de barras.`
        : null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    bufsRef.current = [];
    setMetas([]); setRows([]); setMsg(null);
  }

  const resueltas = rows.filter((r) => r.producto);
  const revisar = rows.filter((r) => !r.producto);
  // Resumen del día en el mismo orden en que van a salir impresas.
  const pilas = new Map<string, number[]>();
  for (const r of resueltas) pilas.set(r.producto!, [...(pilas.get(r.producto!) ?? []), r.unidades ?? 1]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Preparar etiquetas COD</h1>
      <p className="max-w-[75ch] text-sm text-muted-foreground">
        Subí los PDF de etiquetas de <b className="text-foreground">Correo, Urbano y Fixy</b> mezclados
        como vengan. Lee el N° de pedido de cada una, busca en Shopify qué lleva, le estampa el código
        (<b className="text-foreground">B3</b> = BeeVenom x3) y te devuelve{" "}
        <b className="text-foreground">un solo PDF ordenado por producto y por unidades</b>: imprimís y
        armás sin volver a ordenar nada. Se procesa en tu navegador, no se sube a ningún lado.
      </p>

      <Dropzone
        accept="application/pdf"
        multiple
        busy={busy}
        files={metas}
        onFiles={onFiles}
        onClear={reset}
        hint="Podés soltar varios PDF a la vez"
      />

      {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Leyendo etiquetas y cruzando con Shopify…</p>}
      {msg && <p className="text-sm text-amber-600">{msg}</p>}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <Button onClick={descargar} disabled={busy}>Descargar PDF ordenado</Button>
            <span className="text-sm text-muted-foreground">
              {rows.length} etiquetas · {resueltas.length} con código
              {revisar.length > 0 && ` · ${revisar.length} a revisar (van al final)`}
            </span>
          </div>

          {pilas.size > 0 && (
            <p className="text-sm">
              {[...pilas.entries()].sort().map(([p, u]) => (
                <span key={p} className="mr-4 inline-block">
                  <b>{p}</b> <span className="tabular-nums text-muted-foreground">{packBreakdown(u)}</span>
                </span>
              ))}
            </p>
          )}

          <table className="w-full max-w-3xl text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1 w-8">#</th>
                <th>Pedido</th>
                <th>Courier</th>
                <th>Producto</th>
                <th className="text-right">Un.</th>
                <th className="pl-4">Código</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.file}-${r.page}`} className={`border-b ${r.producto ? "" : "bg-amber-50 dark:bg-amber-950/20"}`}>
                  <td className="py-1 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td>{r.orden ? `#${r.orden}` : <span className="text-muted-foreground">{r.archivo} p.{r.page}</span>}</td>
                  <td className="text-muted-foreground">{COURIER[r.courier] ?? r.courier}</td>
                  <td>{r.producto ?? <span className="text-amber-600">{r.nota}</span>}</td>
                  <td className="text-right tabular-nums">{r.unidades ?? ""}</td>
                  <td className="pl-4">
                    <input
                      value={r.code}
                      placeholder="B3"
                      aria-label={`Código de producto (${r.orden ? `pedido #${r.orden}` : `${r.archivo} página ${r.page}`})`}
                      className="w-16 rounded border px-2 py-0.5"
                      onChange={(ev) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, code: ev.target.value } : x)))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { extractLabels, type Label, type LabelCourier } from "@/lib/label-picking";
import { ResumenPicking } from "./resumen";
import { buildPdf, sortOrder } from "@/lib/label-prep";
import { codigoDeposito } from "@/lib/picking";
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
        // El mismo cálculo que usan los scripts de etiquetas (lib/picking.ts).
        const c = codigoDeposito(ord.get(l.orden));
        return { ...base, producto: c.producto, unidades: c.unidades, code: c.code ?? "", nota: c.nota };
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
  // ML/Flex acá salen ordenadas pero SIN código (otro layout) y SIN partir a 10×15. El tab
  // "Etiquetas ML" hace las dos cosas, así que hay que mandarlo ahí en vez de dejarlo pasar callado.
  const ml = rows.filter((r) => r.courier === "ml" || r.courier === "flex");
  // Resumen del día: cuántas etiquetas de cada combo y cuántas unidades salen — el mismo que el
  // picking del día y el de ML, para poder armar todo junto.
  const bultos = rows.map((r) => ({
    desglose: r.producto && r.unidades != null ? [{ producto: r.producto, unidades: r.unidades }] : [],
  }));

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight">Preparar etiquetas COD</h1>
      <p className="max-w-[75ch] text-sm text-muted-foreground">
        Subí los PDF de etiquetas de <b className="text-foreground">Correo, Urbano y Fixy</b> mezclados
        como vengan. Lee el N° de pedido de cada una, busca en Shopify qué lleva, le estampa el código
        (<b className="text-foreground">B3</b> = BeeVenom x3) y te devuelve{" "}
        <b className="text-foreground">un solo PDF ordenado por producto y por unidades</b>: imprimís y
        armás sin volver a ordenar nada. Se procesa en tu navegador, no se sube a ningún lado.
      </p>
      <p className="text-sm text-muted-foreground">
        Las de <b className="text-foreground">MercadoLibre</b> no van acá: van en{" "}
        <a href="/logistica?t=etiquetas" className="underline">Etiquetas ML</a>, que además de
        ordenarlas y estamparles el código las parte a 10×15 para la impresora térmica.
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

          {ml.length > 0 && (
            <p className="text-sm text-amber-600">
              ⚠️ {ml.length} etiqueta(s) de MercadoLibre/Flex. Acá salen ordenadas pero{" "}
              <b>sin código y sin partir a 10×15</b> (son otro layout). Para esas usá{" "}
              <a href="/logistica?t=etiquetas" className="underline">Etiquetas ML</a>, que las parte,
              las ordena <i>y</i> les estampa el código.
            </p>
          )}

          <ResumenPicking bultos={bultos} sinResolver={revisar.length} />

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

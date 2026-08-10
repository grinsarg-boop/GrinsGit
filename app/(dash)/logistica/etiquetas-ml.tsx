"use client";

import { useEffect, useRef, useState } from "react";
import { mlLabelsTo10x15, type MlStamp } from "@/lib/split-labels";
import { extractLabels, type Label } from "@/lib/label-picking";
import { buildPdf, sortOrder } from "@/lib/label-prep";
import { productoCode } from "@/lib/correo";
import { Dropzone } from "@/components/ui/dropzone";
import { Button } from "@/components/ui/button";

export function EtiquetasMl() {
  // Varios PDF a la vez (igual que el preparador de COD): un día de ML son varias descargas.
  // Los buffers en un ref y solo los metadatos en state: OutPage.file es un índice acá.
  const [files, setFiles] = useState<{ name: string; size: number }[]>([]);
  const bufsRef = useRef<ArrayBuffer[]>([]);
  const [includeTalon, setIncludeTalon] = useState(false);
  const [ordenar, setOrdenar] = useState(false);
  const [sinCodigo, setSinCodigo] = useState(0); // mixtas / multi-compra: ordenan al final, sin código
  const [url, setUrl] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ labels: number; skipped: number; sinEstampar: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Revoca el object URL del blob al reemplazarlo o al desmontar (evita fuga de memoria).
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  useEffect(() => {
    if (!files.length) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const bufs = bufsRef.current;
        // Una etiqueta por página, con el archivo del que salió, en todos los PDF subidos.
        const ls: (Label & { fileIdx: number })[] = [];
        for (let f = 0; f < bufs.length; f++) {
          for (const l of await extractLabels(bufs[f].slice(0))) ls.push({ ...l, fileIdx: f });
        }
        // Ordenar (o solo concatenar) ANTES de partir: así el talón sigue pegado a su etiqueta y
        // mlLabelsTo10x15 no necesita devolver el mapeo de páginas (las hojas A4 de resumen quedan
        // al final y las descarta). Con un solo archivo y sin ordenar, esto es una copia y ya.
        const orden = ordenar ? sortOrder(ls) : ls.map((_, i) => i);
        const { pdf: unido } = await buildPdf(
          bufs.map((b) => b.slice(0)),
          orden.map((i) => ({ file: ls[i].fileIdx, page: ls[i].page })),
        );
        // Indexado por la página YA reordenada, que es la que entra al split. Las mixtas y
        // multi-compra van sin código: ahí el pack que dice la etiqueta no es confiable.
        const stampByPage: MlStamp[] = !ordenar ? [] : orden.map((i) => {
          const l = ls[i];
          if (l.revisar || !l.producto || (l.courier !== "ml" && l.courier !== "flex")) return null;
          const code = productoCode({ producto: l.producto, qty: l.unidades ?? 1 });
          return code ? { code, courier: l.courier } : null;
        });
        setSinCodigo(ordenar ? ls.filter((l) => l.revisar).length : 0);
        const { pdf, labels, skipped, sinEstampar } = await mlLabelsTo10x15(unido, { includeTalon, stampByPage });
        if (cancelled) return;
        if (labels === 0) {
          setError(
            "No encontré etiquetas de 10 cm de ancho. ¿Son los PDF de etiquetas de MercadoLibre?"
          );
          setUrl(null);
          setCounts(null);
          return;
        }
        const blob = new Blob([pdf as BlobPart], { type: "application/pdf" });
        setCounts({ labels, skipped, sinEstampar });
        setUrl(URL.createObjectURL(blob)); // el efecto de cleanup revoca el anterior
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [files, includeTalon, ordenar]);

  const outName = files.length === 1
    ? files[0].name.replace(/\.pdf$/i, "") + "_10x15.pdf"
    : "etiquetas_10x15.pdf";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Etiquetas ML → 10×15</h1>
      <p className="text-sm text-muted-foreground">
        Subí los PDF de etiquetas de MercadoLibre —<b>podés soltar varios juntos</b>— y descargá uno
        solo de 10×15 cm con una etiqueta por página, listo para la impresora térmica. Recorta el
        talón del producto de arriba y descarta las hojas A4 de resumen. Todo se procesa en tu
        navegador, no se sube a ningún lado.
      </p>

      <Dropzone
        accept="application/pdf"
        multiple
        busy={busy}
        files={files}
        hint="Podés soltar varios PDF a la vez"
        onFiles={async (fl) => {
          const nuevos = Array.from(fl);
          bufsRef.current = [...bufsRef.current, ...(await Promise.all(nuevos.map((f) => f.arrayBuffer())))];
          setFiles((p) => [...p, ...nuevos.map((f) => ({ name: f.name, size: f.size }))]);
        }}
        onClear={() => { bufsRef.current = []; setFiles([]); setUrl(null); setCounts(null); setError(null); }}
      />

      {files.length > 0 && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ordenar}
              onChange={(e) => setOrdenar(e.target.checked)}
            />
            Ordenar por producto y unidades, y estampar el código (<b>P2</b> = Pureza x2) al lado del
            QR — el talón que dice el producto se recorta. Las mixtas y multi-compra van al final, sin código.
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeTalon}
              onChange={(e) => setIncludeTalon(e.target.checked)}
            />
            Imprimir también el talón del producto (agrega una página después de cada etiqueta)
          </label>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {url && counts && !busy && (
        <>
          <div className="flex items-center gap-4">
            <Button asChild>
              <a href={url} download={outName}>Descargar {outName}</a>
            </Button>
            <span className="text-sm text-muted-foreground">
              {counts.labels} etiqueta{counts.labels === 1 ? "" : "s"}
              {counts.skipped > 0 && ` · ${counts.skipped} página(s) de resumen descartada(s)`}
              {counts.sinEstampar > 0 && ` · ⚠️ ${counts.sinEstampar} sin código (medida no validada)`}
              {ordenar && sinCodigo > 0 && ` · ⚠️ ${sinCodigo} mixta(s) o multi-compra al final, sin código — contalas a mano`}
            </span>
          </div>
          <iframe src={url} className="h-[70vh] w-full rounded border" title="Vista previa" />
        </>
      )}
    </div>
  );
}

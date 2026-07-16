"use client";

import { useEffect, useRef, useState } from "react";
import { mlLabelsTo10x15 } from "@/lib/split-labels";
import { Dropzone } from "@/components/ui/dropzone";

export default function EtiquetasPage() {
  const [file, setFile] = useState<File | null>(null);
  const [includeTalon, setIncludeTalon] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ labels: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bytesRef = useRef<ArrayBuffer | null>(null);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        if (!bytesRef.current) bytesRef.current = await file.arrayBuffer();
        const { pdf, labels, skipped } = await mlLabelsTo10x15(bytesRef.current.slice(0), {
          includeTalon,
        });
        if (cancelled) return;
        if (labels === 0) {
          setError(
            "No encontré etiquetas de 10 cm de ancho en este PDF. ¿Es el PDF de etiquetas de MercadoLibre?"
          );
          setUrl(null);
          setCounts(null);
          return;
        }
        const blob = new Blob([pdf as BlobPart], { type: "application/pdf" });
        setCounts({ labels, skipped });
        setUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, includeTalon]);

  const outName = file ? file.name.replace(/\.pdf$/i, "") + "_10x15.pdf" : "etiquetas_10x15.pdf";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Etiquetas ML → 10×15</h1>
      <p className="text-sm text-muted-foreground">
        Subí el PDF de etiquetas de MercadoLibre y descargá uno de 10×15 cm con una etiqueta por
        página, listo para la impresora térmica. Recorta el talón del producto de arriba y descarta
        la hoja A4 de resumen. Todo se procesa en tu navegador, no se sube a ningún lado.
      </p>

      <Dropzone
        accept="application/pdf"
        busy={busy}
        files={file ? [{ name: file.name, size: file.size }] : []}
        onFiles={(fl) => { bytesRef.current = null; setFile(fl[0] ?? null); }}
        onClear={() => { bytesRef.current = null; setFile(null); setUrl(null); setCounts(null); setError(null); }}
      />

      {file && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeTalon}
            onChange={(e) => setIncludeTalon(e.target.checked)}
          />
          Imprimir también el talón del producto (agrega una página después de cada etiqueta)
        </label>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {url && counts && !busy && (
        <>
          <div className="flex items-center gap-4">
            <a
              href={url}
              download={outName}
              className="inline-block rounded bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Descargar {outName}
            </a>
            <span className="text-sm text-muted-foreground">
              {counts.labels} etiqueta{counts.labels === 1 ? "" : "s"}
              {counts.skipped > 0 && ` · ${counts.skipped} página(s) de resumen descartada(s)`}
            </span>
          </div>
          <iframe src={url} className="h-[70vh] w-full rounded border" title="Vista previa" />
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { mlLabelsTo10x15, type MlStamp } from "@/lib/split-labels";
import { extractLabels, mergeVenta, type Label, type MlVenta } from "@/lib/label-picking";
import { ResumenPicking, type Bulto } from "./resumen";
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
  // Cruce con la API de ML, cacheado por id de venta: así tocar un checkbox no vuelve a pegarle.
  const ventasRef = useRef(new Map<string, MlVenta>());
  const [ml, setMl] = useState<{ total: number; api: number; difieren: string[]; motivos: string[]; error: string | null } | null>(null);
  // Lo que hay que ir a buscar al depósito, por combo — el mismo resumen que el picking del día.
  const [bultos, setBultos] = useState<Bulto[]>([]);
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
        // Producto y unidades salen de la API de ML (unidades del catálogo, no del título); el
        // parser del título queda de fallback si la API falla. Solo se piden los ids nuevos.
        const nuevos = [...new Set(ls.map((l) => l.venta).filter((x): x is string => !!x))]
          .filter((id) => !ventasRef.current.has(id));
        let apiError: string | null = null;
        try {
          for (let i = 0; i < nuevos.length; i += 100) {
            const res = await fetch(`/api/ml-picking?ids=${nuevos.slice(i, i + 100).join(",")}`);
            if (!res.ok) throw new Error(await res.text());
            const { ventas } = (await res.json()) as { ventas: Record<string, MlVenta> };
            for (const [id, v] of Object.entries(ventas)) ventasRef.current.set(id, v);
          }
        } catch (e) {
          apiError = e instanceof Error ? e.message : String(e);
        }
        if (cancelled) return;
        const cr = ls.map((l) => {
          const v = l.venta ? ventasRef.current.get(l.venta) : null;
          return { ...mergeVenta(l, v), fileIdx: l.fileIdx, titulo: `${l.producto ?? "?"}×${l.unidades ?? "?"}`, apiOk: !!v && !v.error };
        });
        setMl({
          total: cr.filter((l) => l.courier === "ml" || l.courier === "flex").length,
          api: cr.filter((l) => l.apiOk).length,
          difieren: cr.filter((l) => l.difiere).map((l) => `p.${l.page} etiqueta ${l.titulo} vs venta ${l.producto ?? "?"}×${l.unidades ?? "?"}`),
          // El motivo nombra la publicación que no se pudo resolver: es lo único que queda por
          // hacer a mano, y se dice cuál, no "revisá".
          motivos: [...new Set(cr.filter((l) => l.motivo).map((l) => `p.${l.page}: ${l.motivo}`))],
          error: apiError,
        });
        setBultos(cr.map((l) => ({ desglose: l.desglose })));

        const orden = ordenar ? sortOrder(cr) : cr.map((_, i) => i);
        const { pdf: unido } = await buildPdf(
          bufs.map((b) => b.slice(0)),
          orden.map((i) => ({ file: cr[i].fileIdx, page: cr[i].page })),
        );
        // Indexado por la página YA reordenada, que es la que entra al split. Las mixtas, las
        // multi-compra y las que la API contradice van sin código: ahí el pack no es confiable.
        const stampByPage: MlStamp[] = !ordenar ? [] : orden.map((i) => {
          const l = cr[i];
          if (l.revisar || !l.producto || (l.courier !== "ml" && l.courier !== "flex")) return null;
          const code = productoCode({ producto: l.producto, qty: l.unidades ?? 1 });
          return code ? { code, courier: l.courier } : null;
        });
        setSinCodigo(ordenar ? cr.filter((l) => l.revisar).length : 0);
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
      <h1 className="font-display text-2xl font-bold tracking-tight">Etiquetas ML → 10×15</h1>
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
        onClear={() => { bufsRef.current = []; setFiles([]); setUrl(null); setCounts(null); setError(null); setMl(null); setBultos([]); }}
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
            QR — el talón que dice el producto se recorta. El producto y las unidades salen de la
            venta en MercadoLibre, con la misma regla con la que el P&amp;L cobra el costo; las
            mixtas y las que ninguna fuente puede resolver van al final, sin código.
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

      {!busy && <ResumenPicking bultos={bultos} sinResolver={bultos.filter((b) => !b.desglose.length).length} />}

      {ml && ml.total > 0 && !busy && (
        <div className="space-y-1 text-xs">
          <p className="text-muted-foreground">
            {ml.api} de {ml.total} etiqueta(s) ML/Flex identificadas contra la venta
            {ml.api < ml.total && ` · ${ml.total - ml.api} por el título impreso en la etiqueta (fallback)`}
          </p>
          {ml.error && (
            <p className="text-amber-600">
              ⚠️ No pude consultar la API de ML ({ml.error}) — el pack se leyó del título impreso, verificalo.
            </p>
          )}
          {ml.motivos.length > 0 && (
            <p className="text-amber-600">
              ⚠️ {ml.motivos.length} venta(s) que no se pudieron identificar solas — van al final sin
              código y NO se cuentan en el resumen: {ml.motivos.join(" · ")}
            </p>
          )}
          {ml.difieren.length > 0 && (
            <p className="text-muted-foreground">
              {ml.difieren.length} etiqueta(s) donde el título impreso y la venta no dicen lo mismo.
              Manda la venta (trae el título entero; la etiqueta viene recortada), así que se
              despachan igual — pero si esto se repite, el recorte del PDF cambió:{" "}
              {ml.difieren.join(" · ")}
            </p>
          )}
        </div>
      )}

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
              {ordenar && sinCodigo > 0 && ` · ${sinCodigo} sin código al final (venta mixta o publicación sin resolver)`}
            </span>
          </div>
          <iframe src={url} className="h-[70vh] w-full rounded border" title="Vista previa" />
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { extractLabels, packBreakdown, type Label } from "@/lib/label-picking";
import { Spinner } from "@/components/ui/spinner";
import type { PickingOrder } from "@/app/api/picking/route";

const COURIER_LABEL: Record<string, string> = { urbano: "Urbano", fixy: "Fixy", correo: "Correo", ml: "ML", flex: "Flex", "?": "¿?" };
const loc = (l: Label) => `${l.file ?? "?"} p.${l.page}`;

async function fetchOrders(ordenes: string[]): Promise<PickingOrder[]> {
  const out: PickingOrder[] = [];
  for (let i = 0; i < ordenes.length; i += 60) {
    const res = await fetch(`/api/picking?orders=${ordenes.slice(i, i + 60).join(",")}`);
    if (!res.ok) throw new Error(`Shopify: ${await res.text()}`);
    out.push(...(await res.json()).orders);
  }
  return out;
}

export default function PickingPage() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [orders, setOrders] = useState<PickingOrder[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [stats, setStats] = useState<{ pdfMs: number; crossMs: number; count: number } | null>(null);

  async function onFiles(fl: FileList) {
    setBusy(true);
    setMsg(null);
    try {
      const t0 = performance.now();
      const nuevos: Label[] = [];
      for (const f of Array.from(fl)) {
        const ls = await extractLabels(await f.arrayBuffer(), f.name);
        nuevos.push(...ls);
        setFiles((p) => [...p, `${f.name} (${ls.length} etiquetas)`]);
      }
      const tPdf = performance.now();
      const all = [...labels, ...nuevos];
      setLabels(all);
      // cruzar los N° de orden nuevos que aún no tenemos
      const tengo = new Set(orders.map((o) => o.orden));
      const pedir = [...new Set(nuevos.map((l) => l.orden).filter((x): x is string => !!x))].filter((n) => !tengo.has(n));
      if (pedir.length) {
        const res = await fetchOrders(pedir);
        setOrders((p) => [...p, ...res]);
      }
      setStats((s) => ({
        pdfMs: (s?.pdfMs ?? 0) + (tPdf - t0),
        crossMs: (s?.crossMs ?? 0) + (performance.now() - tPdf),
        count: (s?.count ?? 0) + nuevos.length,
      }));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setLabels([]); setOrders([]); setFiles([]); setMsg(null); setStats(null);
  }

  // ── Agregación ──
  // packs: unidades de cada pedido del producto → packBreakdown lo vuelve "10×1 · 15×2 · 15×4".
  const agg = new Map<string, { unidades: number; ordenes: number; packs: number[] }>();
  const bump = (p: string, u: number) => {
    const a = agg.get(p) ?? { unidades: 0, ordenes: 0, packs: [] };
    a.unidades += u; a.ordenes += 1; a.packs.push(u); agg.set(p, a);
  };
  const sinProducto: string[] = [];
  const noEncontrados: string[] = [];  // 200 pero no existe en Shopify
  const errores: string[] = [];        // 429/5xx tras reintentos → reintentable, NO es "no existe"

  // COD (Correo/Fixy/Urbano): por pedido distinto, cruzado con Shopify.
  const ordMap = new Map(orders.map((o) => [o.orden, o]));
  const distintos = [...new Set(labels.map((l) => l.orden).filter((x): x is string => !!x))];
  let ordenesOk = 0;
  for (const orden of distintos) {
    const o = ordMap.get(orden);
    if (!o || o.error) { errores.push(orden); continue; }
    if (!o.encontrado) { noEncontrados.push(orden); continue; }
    ordenesOk++;
    const productos = o.items.filter((it) => it.producto);
    if (!productos.length) { sinProducto.push(`#${orden}`); continue; }
    for (const p of new Set(productos.map((it) => it.producto as string))) {
      bump(p, productos.filter((it) => it.producto === p).reduce((s, it) => s + it.unidades, 0));
    }
  }

  // ML/Flex: producto leído de la etiqueta (cada etiqueta con producto = 1 orden). No cruza Shopify.
  // Los mixtos / multi-compra van a "revisar" (no se cuentan solos).
  const ML = (l: Label) => l.courier === "ml" || l.courier === "flex";
  const mlLabels = labels.filter((l) => ML(l) && l.producto && !l.revisar);
  for (const l of mlLabels) bump(l.producto!, l.unidades ?? 1);

  const filas = [...agg.entries()].sort((a, b) => b[1].unidades - a[1].unidades);
  const totU = filas.reduce((s, [, v]) => s + v.unidades, 0);
  const totO = ordenesOk + mlLabels.length;

  // Flags.
  const COD = new Set(["urbano", "fixy", "correo"]);
  const sinOrden = labels.filter((l) => COD.has(l.courier) && !l.orden);
  const mlRevisar = labels.filter((l) => ML(l) && l.revisar);
  const mlSinProd = labels.filter((l) => ML(l) && !l.producto && !l.revisar);
  const noRecon = labels.filter((l) => l.courier === "?").length;
  const porCourier = labels.reduce<Record<string, number>>((m, l) => ((m[l.courier] = (m[l.courier] ?? 0) + 1), m), {});

  // Para un N° de orden, de qué courier/archivo/página vino (responde "¿qué era el no encontrado?").
  const ordenLoc = (orden: string) => {
    const ls = labels.filter((l) => l.orden === orden);
    const cs = [...new Set(ls.map((l) => COURIER_LABEL[l.courier] ?? l.courier))].join("/");
    return `#${orden} (${cs} ${ls.map(loc).join(", ")})`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Picking del día</h1>
        <p className="max-w-[70ch] text-sm text-muted-foreground">
          Subí los PDF de etiquetas de cualquier courier (Correo, Fixy, Urbano). Lee el N° de orden de
          cada etiqueta, lo cruza con Shopify y te dice <b className="text-foreground">cuántas unidades
          de cada producto</b>, <b className="text-foreground">cuántas órdenes</b> y{" "}
          <b className="text-foreground">qué paquetes armar</b> (ej: 10×1 · 15×2 · 15×4). Se procesa en tu navegador.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input type="file" accept="application/pdf" multiple className="block text-sm"
          onChange={(e) => e.target.files?.length && onFiles(e.target.files)} />
        {!!labels.length && <button onClick={reset} className="text-sm text-muted-foreground underline">limpiar</button>}
      </div>

      {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Leyendo etiquetas y cruzando con Shopify…</p>}
      {msg && <p className="text-sm text-amber-600">{msg}</p>}
      {!!files.length && (
        <p className="text-xs text-muted-foreground">
          {files.join(" · ")} — {labels.length} etiquetas ·{" "}
          {Object.entries(porCourier).map(([c, n]) => `${COURIER_LABEL[c] ?? c}: ${n}`).join(" · ")}
          {stats && (
            <> · <b className="text-foreground">{((stats.pdfMs + stats.crossMs) / 1000).toFixed(1)}s</b>{" "}
            ({(stats.count / Math.max(0.001, (stats.pdfMs + stats.crossMs) / 1000)).toFixed(0)} etiq/s —
            leer PDF {(stats.pdfMs / 1000).toFixed(1)}s · cruzar Shopify {(stats.crossMs / 1000).toFixed(1)}s)</>
          )}
        </p>
      )}

      {!!filas.length && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">A despachar hoy — {totO} órdenes · {totU} unidades</h2>
          <table className="w-full max-w-2xl text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1">Producto</th>
                <th className="text-right">Órdenes</th>
                <th className="text-right">Unidades</th>
                <th className="pl-4">Paquetes a armar</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(([p, v]) => (
                <tr key={p} className="border-b">
                  <td className="py-1 font-medium">{p}</td>
                  <td className="text-right tabular-nums">{v.ordenes}</td>
                  <td className="text-right font-semibold tabular-nums">{v.unidades}</td>
                  <td className="pl-4 tabular-nums text-muted-foreground">{packBreakdown(v.packs)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1">Total</td>
                <td className="text-right tabular-nums">{totO}</td>
                <td className="text-right tabular-nums">{totU}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {mlLabels.length > 0 && (
        <p className="text-xs text-muted-foreground">
          ML/Flex ({mlLabels.length}): producto y unidades <b className="text-foreground">leídos de la etiqueta</b> (no cruzan Shopify) — verificá el pack.
        </p>
      )}

      {(sinOrden.length > 0 || errores.length > 0 || noEncontrados.length > 0 || sinProducto.length > 0 || mlRevisar.length > 0 || mlSinProd.length > 0 || noRecon > 0) && (
        <div className="space-y-1 text-sm text-amber-600">
          {sinOrden.length > 0 && <p>⚠️ {sinOrden.length} etiqueta(s) COD sin N° de orden legible ({[...new Set(sinOrden.map((l) => COURIER_LABEL[l.courier]))].join(", ")}) — {sinOrden.map(loc).join(" · ")}.</p>}
          {errores.length > 0 && <p>🔁 Error al consultar Shopify (rate-limit/transitorio, <b>reintentá subiendo de nuevo</b>): {errores.map(ordenLoc).join(", ")}</p>}
          {noEncontrados.length > 0 && <p>⚠️ No existen en Shopify (verificá el N° de orden): {noEncontrados.map(ordenLoc).join(", ")}</p>}
          {sinProducto.length > 0 && <p>⚠️ Ítems sin producto reconocido: {[...new Set(sinProducto)].join(", ")} — completá a mano.</p>}
          {mlRevisar.length > 0 && <p>⚠️ {mlRevisar.length} etiqueta(s) ML/Flex mixtas o multi-compra ({mlRevisar.map(loc).join(" · ")}) — NO se cuentan solas, revisá a mano.</p>}
          {mlSinProd.length > 0 && <p>⚠️ {mlSinProd.length} etiqueta(s) ML/Flex sin producto reconocido ({mlSinProd.map(loc).join(" · ")}) — completá a mano.</p>}
          {noRecon > 0 && <p className="text-muted-foreground">{noRecon} página(s) no reconocidas (posible mitad de etiqueta ML / hoja de resumen) — ignoradas.</p>}
        </div>
      )}
    </div>
  );
}

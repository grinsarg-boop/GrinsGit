"use client";

import { useState } from "react";
import { extractLabels, type Label } from "@/lib/label-picking";
import type { PickingOrder } from "@/app/api/picking/route";

const COURIER_LABEL: Record<string, string> = { urbano: "Urbano", fixy: "Fixy", correo: "Correo", "?": "¿?" };

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

  async function onFiles(fl: FileList) {
    setBusy(true);
    setMsg(null);
    try {
      const nuevos: Label[] = [];
      for (const f of Array.from(fl)) {
        const ls = await extractLabels(await f.arrayBuffer());
        nuevos.push(...ls);
        setFiles((p) => [...p, `${f.name} (${ls.length} etiquetas)`]);
      }
      const all = [...labels, ...nuevos];
      setLabels(all);
      // cruzar los N° de orden nuevos que aún no tenemos
      const tengo = new Set(orders.map((o) => o.orden));
      const pedir = [...new Set(nuevos.map((l) => l.orden).filter((x): x is string => !!x))].filter((n) => !tengo.has(n));
      if (pedir.length) {
        const res = await fetchOrders(pedir);
        setOrders((p) => [...p, ...res]);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setLabels([]); setOrders([]); setFiles([]); setMsg(null);
  }

  // ── Agregación (por pedido distinto) ──
  const ordMap = new Map(orders.map((o) => [o.orden, o]));
  const distintos = [...new Set(labels.map((l) => l.orden).filter((x): x is string => !!x))];
  const agg = new Map<string, { unidades: number; ordenes: number }>();
  const sinProducto: string[] = [];
  const noEncontrados: string[] = [];
  for (const orden of distintos) {
    const o = ordMap.get(orden);
    if (!o || !o.encontrado) { noEncontrados.push(orden); continue; }
    const productosDelPedido = new Set<string>();
    for (const it of o.items) {
      if (!it.producto) { sinProducto.push(`#${orden}`); continue; }
      productosDelPedido.add(it.producto);
      const a = agg.get(it.producto) ?? { unidades: 0, ordenes: 0 };
      a.unidades += it.unidades;
      agg.set(it.producto, a);
    }
    for (const p of productosDelPedido) agg.get(p)!.ordenes += 1;
  }
  const filas = [...agg.entries()].sort((a, b) => b[1].unidades - a[1].unidades);
  const totU = filas.reduce((s, [, v]) => s + v.unidades, 0);
  const totO = distintos.length - noEncontrados.length;
  const sinOrden = labels.filter((l) => !l.orden);
  const porCourier = labels.reduce<Record<string, number>>((m, l) => ((m[l.courier] = (m[l.courier] ?? 0) + 1), m), {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Picking del día</h1>
        <p className="max-w-[70ch] text-sm text-muted-foreground">
          Subí los PDF de etiquetas de cualquier courier (Correo, Fixy, Urbano). Lee el N° de orden de
          cada etiqueta, lo cruza con Shopify y te dice <b className="text-foreground">cuántas unidades
          de cada producto</b> y <b className="text-foreground">cuántas órdenes</b> hay que despachar. Se
          procesa en tu navegador.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input type="file" accept="application/pdf" multiple className="block text-sm"
          onChange={(e) => e.target.files?.length && onFiles(e.target.files)} />
        {!!labels.length && <button onClick={reset} className="text-sm text-muted-foreground underline">limpiar</button>}
      </div>

      {busy && <p className="text-sm text-muted-foreground">Leyendo etiquetas y cruzando con Shopify…</p>}
      {msg && <p className="text-sm text-amber-600">{msg}</p>}
      {!!files.length && (
        <p className="text-xs text-muted-foreground">
          {files.join(" · ")} — {labels.length} etiquetas ·{" "}
          {Object.entries(porCourier).map(([c, n]) => `${COURIER_LABEL[c] ?? c}: ${n}`).join(" · ")}
        </p>
      )}

      {!!filas.length && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">A despachar hoy — {totO} órdenes · {totU} unidades</h2>
          <table className="w-full max-w-lg text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1">Producto</th>
                <th className="text-right">Órdenes</th>
                <th className="text-right">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(([p, v]) => (
                <tr key={p} className="border-b">
                  <td className="py-1 font-medium">{p}</td>
                  <td className="text-right tabular-nums">{v.ordenes}</td>
                  <td className="text-right font-semibold tabular-nums">{v.unidades}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1">Total</td>
                <td className="text-right tabular-nums">{totO}</td>
                <td className="text-right tabular-nums">{totU}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {(sinOrden.length > 0 || noEncontrados.length > 0 || sinProducto.length > 0) && (
        <div className="space-y-1 text-sm text-amber-600">
          {sinOrden.length > 0 && <p>⚠️ {sinOrden.length} etiqueta(s) sin N° de orden legible (courier: {[...new Set(sinOrden.map((l) => COURIER_LABEL[l.courier]))].join(", ")}) — pág. {sinOrden.map((l) => l.page).join(", ")}. Puede faltar el patrón de ese courier.</p>}
          {noEncontrados.length > 0 && <p>⚠️ No encontrados en Shopify: {noEncontrados.map((o) => `#${o}`).join(", ")}</p>}
          {sinProducto.length > 0 && <p>⚠️ Ítems sin producto reconocido (keyword no matcheó): {[...new Set(sinProducto)].join(", ")} — completá a mano.</p>}
        </div>
      )}
    </div>
  );
}

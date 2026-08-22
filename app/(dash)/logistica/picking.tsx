"use client";

import { useState } from "react";
import { extractLabels, mergeVenta, type Label, type MlVenta } from "@/lib/label-picking";
import { ResumenPicking, type Bulto } from "./resumen";
import { Spinner } from "@/components/ui/spinner";
import type { PickingOrder } from "@/app/api/picking/route";

const COURIER_LABEL: Record<string, string> = { urbano: "Urbano", fixy: "Fixy", correo: "Correo", ml: "ML", flex: "Flex", "?": "¿?" };
const loc = (l: Label) => `${l.file ?? "?"} p.${l.page}`;
const ML = (l: Label) => l.courier === "ml" || l.courier === "flex";
const COD = new Set(["urbano", "fixy", "correo"]);

export async function fetchOrders(ordenes: string[]): Promise<PickingOrder[]> {
  const out: PickingOrder[] = [];
  for (let i = 0; i < ordenes.length; i += 60) {
    const res = await fetch(`/api/picking?orders=${ordenes.slice(i, i + 60).join(",")}`);
    if (!res.ok) throw new Error(`Shopify: ${await res.text()}`);
    out.push(...(await res.json()).orders);
  }
  return out;
}

// Lo que lleva cada venta de ML, preguntado a MercadoLibre. Es el equivalente de fetchOrders para
// el otro canal: la etiqueta de ML no trae N° de pedido de Shopify, trae el id de la venta.
export async function fetchVentas(ids: string[]): Promise<Record<string, MlVenta>> {
  const out: Record<string, MlVenta> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const res = await fetch(`/api/ml-picking?ids=${ids.slice(i, i + 100).join(",")}`);
    if (!res.ok) throw new Error(`ML: ${await res.text()}`);
    Object.assign(out, (await res.json()).ventas);
  }
  return out;
}

export function Picking() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [orders, setOrders] = useState<PickingOrder[]>([]);
  const [ventas, setVentas] = useState<Record<string, MlVenta>>({});
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
      setLabels((p) => [...p, ...nuevos]);
      // cruzar los N° de orden nuevos que aún no tenemos
      const tengo = new Set(orders.map((o) => o.orden));
      const pedir = [...new Set(nuevos.map((l) => l.orden).filter((x): x is string => !!x))].filter((n) => !tengo.has(n));
      // …y las ventas de ML nuevas. Si ML no contesta no se cae todo: las COD siguen cruzadas y las
      // de ML quedan con lo que dice el título impreso, avisando.
      const ventasNuevas = [...new Set(nuevos.filter(ML).map((l) => l.venta).filter((x): x is string => !!x))]
        .filter((id) => !(id in ventas));
      const [res, vs] = await Promise.all([
        pedir.length ? fetchOrders(pedir) : Promise.resolve([]),
        ventasNuevas.length ? fetchVentas(ventasNuevas).catch((e) => { setMsg(String(e.message ?? e)); return {}; }) : Promise.resolve({}),
      ]);
      if (res.length) setOrders((p) => [...p, ...res]);
      if (Object.keys(vs).length) setVentas((p) => ({ ...p, ...vs }));
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
    setLabels([]); setOrders([]); setVentas({}); setFiles([]); setMsg(null); setStats(null);
  }

  // ── Un bulto por etiqueta (COD: por pedido distinto, que es lo que se despacha junto) ──
  const bultos: Bulto[] = [];
  const sinProducto: string[] = [];
  const noEncontrados: string[] = [];  // 200 pero no existe en Shopify
  const errores: string[] = [];        // 429/5xx tras reintentos → reintentable, NO es "no existe"

  // COD (Correo/Fixy/Urbano): por pedido distinto, cruzado con Shopify.
  const ordMap = new Map(orders.map((o) => [o.orden, o]));
  const distintos = [...new Set(labels.filter((l) => COD.has(l.courier)).map((l) => l.orden).filter((x): x is string => !!x))];
  for (const orden of distintos) {
    const o = ordMap.get(orden);
    if (!o || o.error) { errores.push(orden); continue; }
    if (!o.encontrado) { noEncontrados.push(orden); continue; }
    const productos = o.items.filter((it) => it.producto);
    if (!productos.length) { sinProducto.push(`#${orden}`); bultos.push({ desglose: [] }); continue; }
    const m = new Map<string, number>();
    for (const it of productos) m.set(it.producto!, (m.get(it.producto!) ?? 0) + it.unidades);
    bultos.push({ desglose: [...m.entries()].map(([producto, unidades]) => ({ producto, unidades })) });
  }

  // ML/Flex: una etiqueta = una venta. El producto y las unidades salen de la venta en ML (misma
  // regla que el P&L); si ML no contestó, del título impreso en la etiqueta.
  const cruzadas = labels.filter(ML).map((l) => mergeVenta(l, l.venta ? ventas[l.venta] : null));
  for (const c of cruzadas) bultos.push({ desglose: c.desglose });

  // Flags — cada uno nombra dónde está el problema, para poder ir a mirarlo.
  const sinOrden = labels.filter((l) => COD.has(l.courier) && !l.orden);
  const mlSinVenta = cruzadas.filter((c) => !c.venta);
  const mlMotivos = [...new Set(cruzadas.filter((c) => c.motivo).map((c) => `p.${c.page}: ${c.motivo}`))];
  const mlSinIdentificar = cruzadas.filter((c) => !c.desglose.length);
  const mlPorTitulo = cruzadas.filter((c) => c.venta && !c.apiOk);
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
        <h1 className="font-display text-2xl font-bold tracking-tight">Picking del día</h1>
        <p className="max-w-[70ch] text-sm text-muted-foreground">
          Subí los PDF de etiquetas de cualquier courier (Correo, Fixy, Urbano) y de MercadoLibre,
          mezclados. Las de COD las cruza con Shopify por N° de pedido y las de ML con la venta en
          MercadoLibre, y te dice <b className="text-foreground">cuántas etiquetas hay de cada
          combo</b> y <b className="text-foreground">cuántas unidades de cada producto</b> salen hoy.
          Se procesa en tu navegador.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input type="file" accept="application/pdf" multiple className="block text-sm"
          onChange={(e) => e.target.files?.length && onFiles(e.target.files)} />
        {!!labels.length && <button onClick={reset} className="text-sm text-muted-foreground underline">limpiar</button>}
      </div>

      {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Leyendo etiquetas y cruzando con Shopify y MercadoLibre…</p>}
      {msg && <p className="text-sm text-amber-600">{msg}</p>}
      {!!files.length && (
        <p className="text-xs text-muted-foreground">
          {files.join(" · ")} — {labels.length} etiquetas ·{" "}
          {Object.entries(porCourier).map(([c, n]) => `${COURIER_LABEL[c] ?? c}: ${n}`).join(" · ")}
          {stats && (
            <> · <b className="text-foreground">{((stats.pdfMs + stats.crossMs) / 1000).toFixed(1)}s</b>{" "}
            ({(stats.count / Math.max(0.001, (stats.pdfMs + stats.crossMs) / 1000)).toFixed(0)} etiq/s —
            leer PDF {(stats.pdfMs / 1000).toFixed(1)}s · cruzar {(stats.crossMs / 1000).toFixed(1)}s)</>
          )}
        </p>
      )}

      <ResumenPicking
        bultos={bultos}
        sinResolver={bultos.filter((b) => !b.desglose.length).length}
      />

      {mlPorTitulo.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {mlPorTitulo.length} etiqueta(s) de ML no se pudieron consultar contra la venta y se
          contaron por el título impreso — verificá el pack: {mlPorTitulo.map(loc).join(" · ")}
        </p>
      )}

      {(sinOrden.length > 0 || errores.length > 0 || noEncontrados.length > 0 || sinProducto.length > 0 || mlSinVenta.length > 0 || mlMotivos.length > 0 || mlSinIdentificar.length > 0 || noRecon > 0) && (
        <div className="space-y-1 text-sm text-amber-600">
          {sinOrden.length > 0 && <p>⚠️ {sinOrden.length} etiqueta(s) COD sin N° de orden legible ({[...new Set(sinOrden.map((l) => COURIER_LABEL[l.courier]))].join(", ")}) — {sinOrden.map(loc).join(" · ")}.</p>}
          {errores.length > 0 && <p>🔁 Error al consultar Shopify (rate-limit/transitorio, <b>reintentá subiendo de nuevo</b>): {errores.map(ordenLoc).join(", ")}</p>}
          {noEncontrados.length > 0 && <p>⚠️ No existen en Shopify (verificá el N° de orden): {noEncontrados.map(ordenLoc).join(", ")}</p>}
          {sinProducto.length > 0 && <p>⚠️ Ítems sin producto reconocido: {[...new Set(sinProducto)].join(", ")} — completá a mano.</p>}
          {mlSinVenta.length > 0 && <p>⚠️ {mlSinVenta.length} etiqueta(s) de ML sin id de venta legible — {mlSinVenta.map(loc).join(" · ")}.</p>}
          {mlMotivos.length > 0 && <p>⚠️ Ventas de ML que no se pudieron identificar solas: {mlMotivos.join(" · ")}</p>}
          {mlSinIdentificar.length > 0 && <p>⚠️ {mlSinIdentificar.length} etiqueta(s) de ML sin identificar — NO están contadas arriba: {mlSinIdentificar.map(loc).join(" · ")}.</p>}
          {noRecon > 0 && <p className="text-muted-foreground">{noRecon} página(s) no reconocidas (posible mitad de etiqueta ML / hoja de resumen) — ignoradas.</p>}
        </div>
      )}
    </div>
  );
}

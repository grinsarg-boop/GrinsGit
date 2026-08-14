"use client";

import { useMemo, useState } from "react";
import {
  buildCsv, needsSucursal, normalizeRow, parseCsv, pedidoToRow, productoCode,
  rowErrors, toSucursal, type CorreoRow, type ShopifyPedido,
} from "@/lib/correo";
import { Dropzone } from "@/components/ui/dropzone";
import { Button } from "@/components/ui/button";

type Sucursal = { c: string; l: string; p: string; d: string };

async function fetchPedidos(orders: string[]): Promise<{ pedidos: ShopifyPedido[]; notFound: string[] }> {
  // El endpoint acepta hasta 60 por request → chunkear (audit C#10, antes un PDF de >60 fallaba entero).
  const pedidos: ShopifyPedido[] = [];
  const notFound: string[] = [];
  for (let i = 0; i < orders.length; i += 60) {
    const res = await fetch(`/api/correo/pedidos?orders=${orders.slice(i, i + 60).join(",")}`);
    if (!res.ok) throw new Error(`Shopify: ${await res.text()}`);
    const j = await res.json();
    pedidos.push(...j.pedidos);
    notFound.push(...j.notFound);
  }
  return { pedidos, notFound };
}

export function download(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Herramienta 1: estampar código de producto en las etiquetas ──────────────

function Etiquetas() {
  const [pdf, setPdf] = useState<ArrayBuffer | null>(null);
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null);
  const [entries, setEntries] = useState<{ page: number; orden: string | null; code: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(f: File) {
    setBusy(true);
    setMsg(null);
    setEntries([]);
    setFileMeta({ name: f.name, size: f.size });
    try {
      const bytes = await f.arrayBuffer();
      setPdf(bytes);
      const { extractOrders } = await import("@/lib/correo-pdf");
      const orders = await extractOrders(bytes);
      const found = [...new Set(orders.filter(Boolean))] as string[];
      if (!found.length) throw new Error("no encontré números de pedido (#NNNNN) en el PDF");
      const { pedidos, notFound } = await fetchPedidos(found);
      const codeByOrden = new Map(pedidos.map((p) => [p.orden, productoCode(p) ?? ""]));
      setEntries(orders.map((orden, i) => ({ page: i + 1, orden, code: codeByOrden.get(orden ?? "") ?? "" })));
      if (notFound.length) setMsg(`sin datos en Shopify: ${notFound.join(", ")} — completá el código a mano`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function stamp() {
    if (!pdf) return;
    const { stampCodes } = await import("@/lib/correo-pdf");
    const out = await stampCodes(pdf, entries.map((e) => e.code.trim().toUpperCase() || null));
    download("etiquetas_con_producto.pdf", new Blob([out as BlobPart], { type: "application/pdf" }));
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Etiquetas de Correo → código de producto</h2>
      <p className="text-sm text-muted-foreground">
        Subí el PDF de etiquetas de MiCorreo: lee el nº de pedido de cada una, busca en Shopify qué
        contiene y estampa el código (B3 = BeeVenom x3) en el recuadro vacío al pie. Editable antes
        de descargar.
      </p>
      <Dropzone
        accept="application/pdf"
        busy={busy}
        files={fileMeta ? [fileMeta] : []}
        onFiles={(fl) => fl[0] && onFile(fl[0])}
        onClear={() => { setPdf(null); setEntries([]); setMsg(null); setFileMeta(null); }}
      />
      {msg && <p className="text-sm text-amber-600">{msg}</p>}
      {entries.length > 0 && (
        <>
          <table className="text-sm">
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className="border-b">
                  <td className="py-1 pr-4 text-muted-foreground">pág. {e.page}</td>
                  <td className="pr-4">{e.orden ? `#${e.orden}` : "sin pedido"}</td>
                  <td>
                    <input
                      value={e.code}
                      placeholder="B3"
                      aria-label={`Código de producto (página ${e.page}${e.orden ? `, pedido #${e.orden}` : ""})`}
                      className="w-16 rounded border px-2 py-0.5"
                      onChange={(ev) =>
                        setEntries((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, code: ev.target.value } : x)),
                        )
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button onClick={stamp}>Estampar y descargar PDF</Button>
        </>
      )}
    </section>
  );
}

// ── Herramienta 2: CSV de carga masiva ───────────────────────────────────────

function CargaMasiva() {
  const [rows, setRows] = useState<CorreoRow[]>([]);
  const [ordersText, setOrdersText] = useState("");
  const [sucursales, setSucursales] = useState<Sucursal[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadSucursales() {
    if (sucursales) return sucursales;
    const data = (await import("@/lib/correo-sucursales.json")).default as Sucursal[];
    setSucursales(data);
    return data;
  }

  async function addRows(nuevas: CorreoRow[]) {
    if (nuevas.some(needsSucursal)) await loadSucursales();
    setRows((prev) => {
      const seen = new Set(prev.map((r) => r.orden));
      return [...prev, ...nuevas.filter((r) => !r.orden || !seen.has(r.orden))];
    });
  }

  async function onCsv(f: File) {
    setMsg(null);
    try {
      await addRows(parseCsv(await f.text()).map(normalizeRow));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function addPedidos() {
    const orders = ordersText.split(/[,\s]+/).map((s) => s.replace(/\D/g, "")).filter(Boolean);
    if (!orders.length) return;
    setBusy(true);
    setMsg(null);
    try {
      const { pedidos, notFound } = await fetchPedidos(orders);
      await addRows(pedidos.map(pedidoToRow));
      setOrdersText("");
      if (notFound.length) setMsg(`no encontrados en Shopify: ${notFound.join(", ")}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const errores = useMemo(() => rows.map(rowErrors), [rows]);
  const ok = rows.length > 0 && errores.every((e) => e.length === 0);

  function candidatas(row: CorreoRow): Sucursal[] {
    if (!sucursales) return [];
    const loc = row.localidad.toUpperCase();
    const prov = sucursales.filter((s) => s.p === row.provincia);
    const exact = prov.filter((s) => s.l === loc);
    return (exact.length ? exact : prov.filter((s) => s.l.includes(loc) || loc.includes(s.l))).slice(0, 20);
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">CSV carga masiva MiCorreo</h2>
      <p className="text-sm text-muted-foreground">
        Subí un borrador (21 columnas, separado por ;) y/o agregá pedidos por número desde Shopify.
        Aplica la receta completa: ASCII, CP de 4 dígitos, peso con punto, CRLF. Todo va a
        domicilio; sucursal solo si al pedido le faltan datos de dirección.
      </p>
      <div className="space-y-3">
        <Dropzone
          accept=".csv,text/csv"
          onFiles={(fl) => fl[0] && onCsv(fl[0])}
          hint="borrador de 21 columnas separado por ;"
        />
        {/* grupo input+botón pegado (audit §5): mismo alto, sin gap, radios sólo a los extremos */}
        <div className="flex items-center">
          <input
            value={ordersText}
            onChange={(e) => setOrdersText(e.target.value)}
            placeholder="pedidos: 16072, 15807…"
            aria-label="Números de pedido de Shopify"
            className="h-9 w-56 rounded-l-md border border-r-0 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            onClick={addPedidos}
            disabled={busy}
            className="h-9 rounded-r-md border bg-secondary px-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            {busy ? "Buscando…" : "Agregar de Shopify"}
          </button>
        </div>
      </div>
      {msg && <p className="text-sm text-amber-600">{msg}</p>}
      {rows.length > 0 && (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1">Pedido</th><th>Nombre</th><th>Destino</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b align-top">
                  <td className="py-1 pr-2">{r.orden || "—"}</td>
                  <td className="pr-2">{r.nombre}</td>
                  <td className="pr-2">
                    {r.sucursal
                      ? `sucursal ${r.sucursal}`
                      : `${r.calle} ${r.altura}, ${r.localidad} (${r.provincia}) CP ${r.cp}`}
                  </td>
                  <td>
                    {needsSucursal(r) ? (
                      <select
                        aria-label="Elegir sucursal de Correo"
                        className="rounded border px-1 py-0.5"
                        defaultValue=""
                        onChange={(e) =>
                          e.target.value &&
                          setRows((prev) => prev.map((x, j) => (j === i ? toSucursal(x, e.target.value) : x)))
                        }
                      >
                        <option value="">elegir sucursal…</option>
                        {candidatas(r).map((s) => (
                          <option key={s.c} value={s.c}>{`${s.c} — ${s.d}, ${s.l}`}</option>
                        ))}
                      </select>
                    ) : errores[i].length ? (
                      <div className="space-y-1">
                        {/* Shopify a veces manda un teléfono que splitPhone no puede partir → "cel inválido".
                            Editable acá para no trabar todo el CSV por una fila. Sin dirección completa
                            → cae al selector de sucursal de arriba (needsSucursal). */}
                        {errores[i].includes("cel inválido") && (
                          <div className="flex items-center gap-1">
                            <input
                              value={r.area}
                              onChange={(ev) =>
                                setRows((prev) => prev.map((x, j) => (j === i ? { ...x, area: ev.target.value.replace(/\D/g, "") } : x)))
                              }
                              placeholder="área"
                              aria-label={`Código de área del pedido ${r.orden}`}
                              className="w-14 rounded border px-2 py-0.5"
                            />
                            <input
                              value={r.cel}
                              onChange={(ev) =>
                                setRows((prev) => prev.map((x, j) => (j === i ? { ...x, cel: ev.target.value.replace(/\D/g, "") } : x)))
                              }
                              placeholder="celular"
                              aria-label={`Celular del pedido ${r.orden}`}
                              className="w-28 rounded border px-2 py-0.5"
                            />
                          </div>
                        )}
                        <span className="text-red-600">{errores[i].join(" · ")}</span>
                      </div>
                    ) : (
                      <span className="text-green-700">ok</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-3">
            <Button
              disabled={!ok}
              onClick={() =>
                download(
                  `correo_SUBIR_carga_masiva_${new Date().toISOString().slice(0, 10)}.csv`,
                  new Blob([buildCsv(rows)], { type: "text/csv" }),
                )
              }
            >
              Descargar CSV cargable
            </Button>
            <button onClick={() => setRows([])} className="text-sm text-muted-foreground underline">
              limpiar
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export function CorreoTools() {
  return (
    <div className="space-y-10">
      <h1 className="font-display text-2xl font-bold tracking-tight">Correo Argentino</h1>
      <CargaMasiva />
      <Etiquetas />
    </div>
  );
}

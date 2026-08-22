"use client";

import { Fragment } from "react";

// El resumen de picking, uno solo para los tres tabs: cuántas etiquetas hay de cada combo y
// cuántas unidades salen en total. Es lo que el depósito necesita leer antes de tocar una caja,
// así que se arma igual sea el PDF de COD o el de MercadoLibre.
//
// Un bulto = una etiqueta. `desglose` es lo que va adentro; son varias entradas solo cuando la
// venta es mixta, y ahí esa etiqueta cuenta en el combo de CADA producto (que es lo correcto para
// armar: hay que ir a buscar a las dos góndolas). Por eso el total de arriba usa la cantidad de
// etiquetas distintas y no la suma de la columna.

export type Bulto = { desglose: { producto: string; unidades: number }[] };

type Fila = { producto: string; combo: number; etiquetas: number; unidades: number };

export function filasResumen(bultos: Bulto[]): Fila[] {
  const m = new Map<string, Fila>();
  for (const b of bultos) {
    for (const d of b.desglose) {
      const k = `${d.producto}|${d.unidades}`;
      const f = m.get(k) ?? { producto: d.producto, combo: d.unidades, etiquetas: 0, unidades: 0 };
      f.etiquetas += 1;
      f.unidades += d.unidades;
      m.set(k, f);
    }
  }
  return [...m.values()].sort((a, b) => a.producto.localeCompare(b.producto) || a.combo - b.combo);
}

export function ResumenPicking({ bultos, sinResolver = 0 }: { bultos: Bulto[]; sinResolver?: number }) {
  const filas = filasResumen(bultos);
  if (!filas.length) return null;
  const etiquetas = bultos.filter((b) => b.desglose.length).length;
  const unidades = filas.reduce((s, f) => s + f.unidades, 0);
  const porProducto = new Map<string, { etiquetas: number; unidades: number }>();
  for (const f of filas) {
    const a = porProducto.get(f.producto) ?? { etiquetas: 0, unidades: 0 };
    a.etiquetas += f.etiquetas; a.unidades += f.unidades;
    porProducto.set(f.producto, a);
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">
        A despachar — {etiquetas} etiqueta{etiquetas === 1 ? "" : "s"} · {unidades} unidades
        {sinResolver > 0 && <span className="font-normal text-amber-600"> · {sinResolver} sin identificar</span>}
      </h2>
      <table className="w-full max-w-xl text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-1">Producto</th>
            <th>Combo</th>
            <th className="text-right">Etiquetas</th>
            <th className="text-right">Unidades</th>
          </tr>
        </thead>
        <tbody>
          {[...porProducto.entries()].map(([producto, tot]) => {
            const combos = filas.filter((f) => f.producto === producto);
            return (
              <Fragment key={producto}>
                {combos.map((f) => (
                  <tr key={f.combo} className="border-b">
                    <td className="py-1 font-medium">{f.producto}</td>
                    <td className="tabular-nums text-muted-foreground">×{f.combo}</td>
                    <td className="text-right tabular-nums">{f.etiquetas}</td>
                    <td className="text-right font-semibold tabular-nums">{f.unidades}</td>
                  </tr>
                ))}
                {combos.length > 1 && (
                  <tr className="border-b text-muted-foreground">
                    <td className="py-1 pl-3 text-xs" colSpan={2}>subtotal {producto}</td>
                    <td className="text-right text-xs tabular-nums">{tot.etiquetas}</td>
                    <td className="text-right text-xs tabular-nums">{tot.unidades}</td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          <tr className="font-semibold">
            <td className="py-1" colSpan={2}>Total</td>
            <td className="text-right tabular-nums">{filas.reduce((s, f) => s + f.etiquetas, 0)}</td>
            <td className="text-right tabular-nums">{unidades}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

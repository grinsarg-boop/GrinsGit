"use client";

import { useState, useTransition } from "react";
import { AlertDialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { redirigirUrbano } from "@/app/(dash)/trabados/actions";

// Redirección de una pieza Urbano en tránsito a una dirección corregida (wbs/rescate). Dos pasos:
// "Previsualizar" muestra el JSON EXACTO que se envía (sin password); "Confirmar y enviar" recién
// ahí llama la API. Editar un campo borra el preview → obliga a re-previsualizar antes de mandar.
const FIELDS: readonly (readonly [string, string])[] = [
  ["piece", "Guía / código de pieza"], ["nombre", "Destinatario (nombre)"],
  ["direccion", "Calle"], ["altura", "Altura"], ["codigoPostal", "CP (4 dígitos)"],
  ["localidad", "Localidad"], ["provincia", "Provincia"],
  ["piso", "Piso (opc.)"], ["departamento", "Depto (opc.)"], ["observaciones", "Observaciones (opc.)"],
];
const cls = "w-full rounded-md border bg-background px-2 py-1.5 text-sm";

type Preview = { url: string; body: unknown };
type Sent = { httpOk: boolean; status: string; message: string };

export function UrbanoRedirigir() {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const buildFd = (confirmar: boolean) => {
    const fd = new FormData();
    for (const [k] of FIELDS) fd.set(k, vals[k] ?? "");
    if (confirmar) fd.set("confirmar", "1");
    return fd;
  };

  const run = (confirmar: boolean) =>
    start(async () => {
      setError(null);
      const r = await redirigirUrbano(buildFd(confirmar));
      if (!r.ok) { setError(r.error); return; }
      if ("preview" in r) { setSent(null); setPreview(r.preview); }
      else { setPreview(null); setSent(r.sent); }
    });

  const edit = (k: string, v: string) => {
    setVals((prev) => ({ ...prev, [k]: v }));
    setPreview(null); // cambió un dato → hay que volver a previsualizar antes de enviar
    setSent(null);
  };

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="text-sm font-medium">Redirigir dirección (Urbano)</div>
        <p className="text-xs text-muted-foreground">
          Redirige una pieza <b>en tránsito</b> a una dirección corregida (wbs/rescate). Previsualizás
          el envío exacto y recién ahí confirmás. <b>Piece = número de guía de Urbano</b> — confirmá cuál
          identificador acepta en el primer uso real.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {FIELDS.map(([k, ph]) => (
            <input
              key={k} className={cls} placeholder={ph} value={vals[k] ?? ""}
              onChange={(e) => edit(k, e.target.value)}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={pending} onClick={() => run(false)}>Previsualizar</Button>
          {preview && (
            <AlertDialog.Root>
              <AlertDialog.Trigger asChild>
                <Button variant="destructive" disabled={pending}>Confirmar y enviar a Urbano</Button>
              </AlertDialog.Trigger>
              <AlertDialog.Portal>
                <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
                <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-5 shadow-xl">
                  <AlertDialog.Title className="text-base font-semibold">¿Redirigir esta pieza en Urbano?</AlertDialog.Title>
                  <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
                    Acción real sobre un envío en tránsito. Se redirige la pieza <b>{vals.piece}</b> a
                    nombre de <b>{vals.nombre}</b> — {vals.direccion} {vals.altura}, {vals.localidad} (CP{" "}
                    {vals.codigoPostal}), {vals.provincia}.
                  </AlertDialog.Description>
                  <div className="mt-5 flex justify-end gap-2">
                    <AlertDialog.Cancel asChild>
                      <Button variant="outline" size="sm">Cancelar</Button>
                    </AlertDialog.Cancel>
                    <AlertDialog.Action asChild>
                      <Button variant="destructive" size="sm" onClick={() => run(true)}>Sí, enviar</Button>
                    </AlertDialog.Action>
                  </div>
                </AlertDialog.Content>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          )}
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}

        {preview && (
          <div className="space-y-1 rounded-md border p-3">
            <div className="text-xs text-muted-foreground">
              POST <code>{preview.url}</code> — la password se agrega server-side, no está acá:
            </div>
            <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
{JSON.stringify(preview.body, null, 2)}
            </pre>
          </div>
        )}

        {sent && (
          <div className={sent.httpOk && sent.status === "succeeded"
            ? "text-sm text-emerald-600 dark:text-emerald-400"
            : "text-sm text-destructive"}>
            Urbano: {sent.status} — {sent.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

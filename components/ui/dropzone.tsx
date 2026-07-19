"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 animate-spin" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const fmtSize = (b: number) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

// Zona de arrastrar-y-soltar que reemplaza el <input type=file> nativo (audit §7).
// Muestra estado con archivo(s) cargado(s) (nombre + tamaño + quitar) y estado procesando.
export function Dropzone({
  accept,
  multiple = false,
  busy = false,
  files = [],
  onFiles,
  onClear,
  hint,
  className,
}: {
  accept?: string;
  multiple?: boolean;
  busy?: boolean;
  files?: { name: string; size: number }[];
  onFiles: (files: FileList) => void;
  onClear?: () => void;
  hint?: React.ReactNode;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const open = () => inputRef.current?.click();

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Arrastrá o hacé clic para elegir un archivo"
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
        }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed p-6 text-center text-sm outline-none transition-all duration-150 ease-out motion-safe:active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          over ? "border-ring bg-accent motion-safe:scale-[1.01]" : "hover:border-ring/60 hover:bg-accent/50",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          // Reseteo el value para que re-elegir por click la MISMA ruta vuelva a disparar change.
          onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.currentTarget.value = ""; }}
        />
        {busy ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Spinner /> Procesando en tu navegador…
          </span>
        ) : (
          <>
            <span className="text-muted-foreground">
              Arrastrá el {accept?.includes("csv") ? "archivo" : "PDF"} acá o{" "}
              <span className="font-medium text-foreground">hacé clic para elegir</span>
            </span>
            {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
          </>
        )}
      </div>

      {files.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="truncate font-medium">{f.name}</span>
              <span className="text-xs text-muted-foreground">{fmtSize(f.size)}</span>
              {onClear && i === files.length - 1 && (
                <button
                  type="button"
                  onClick={onClear}
                  className="ml-auto text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

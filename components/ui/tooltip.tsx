"use client";

import * as React from "react";
import { Tooltip as T } from "radix-ui";
import { cn } from "@/lib/utils";

// Ícono "?" de ayuda (14px), opacidad 60% → 100% en hover/focus (audit §8).
function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

// Panel de ayuda transversal (audit §8 + Parte 2). Sin `children` = trigger es el ícono "?";
// con `children` = ese nodo es el trigger (para envolver badges, celdas, etc.).
// Radix Tooltip da hover+focus, role=tooltip y aria-describedby; delay 150ms.
export function Tip({
  tip,
  children,
  label = "Ayuda",
  side = "top",
  className,
}: {
  tip: React.ReactNode;
  children?: React.ReactNode;
  label?: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}) {
  return (
    <T.Provider delayDuration={150}>
      <T.Root>
        <T.Trigger asChild>
          {children ? (
            <span
              tabIndex={0}
              className={cn(
                "cursor-help rounded outline-none focus-visible:ring-2 focus-visible:ring-ring",
                className,
              )}
            >
              {children}
            </span>
          ) : (
            <button
              type="button"
              aria-label={label}
              className={cn(
                "inline-flex shrink-0 rounded-full align-middle text-muted-foreground/70 outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                className,
              )}
            >
              <HelpIcon />
            </button>
          )}
        </T.Trigger>
        <T.Portal>
          <T.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            className="z-50 max-w-[280px] rounded-lg border bg-popover px-3.5 py-3 text-[13px] leading-[1.45] text-popover-foreground shadow-lg"
          >
            {tip}
            <T.Arrow className="fill-popover" />
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}

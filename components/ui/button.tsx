import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Anillo de foco §6: sólido, opacidad plena, con gap de 2px (ring-offset) — visible sobre fondo oscuro.
  // Movimiento: todo detrás de `motion-safe:` — con "reducir movimiento" del SO queda solo el cambio de
  // color. El press (scale) va en la base para que TODAS las variantes se sientan igual al tocarlas.
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:active:scale-[0.97] motion-safe:active:duration-75 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 motion-safe:[&_svg]:transition-transform",
  {
    variants: {
      variant: {
        // Los rellenos levantan 1px y ganan sombra al pasar el mouse; al apretar bajan.
        default:
          "bg-primary text-primary-foreground font-semibold shadow-xs hover:brightness-110 hover:shadow-sm motion-safe:hover:-translate-y-px active:brightness-95 motion-safe:active:translate-y-0",
        // Acción pesada (recompute/backfill): outline naranja, NO relleno — no grita. Pide modal de confirmación.
        // Usa el token `heavy` (naranja), distinto de `destructive` (rojo = pérdidas/errores).
        destructive:
          "border border-heavy bg-transparent text-heavy hover:bg-heavy/15 hover:border-heavy/70 dark:text-heavy-foreground focus-visible:ring-heavy/30",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground hover:shadow-sm motion-safe:hover:-translate-y-px active:shadow-xs motion-safe:active:translate-y-0 dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 hover:shadow-sm motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        // El subrayado crece desde la izquierda en vez de aparecer de golpe.
        link: "relative text-primary underline-offset-4 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-200 hover:after:scale-x-100 motion-reduce:after:transition-none motion-reduce:hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

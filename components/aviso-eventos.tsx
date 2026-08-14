import Link from "next/link";
import { fmtDate } from "@/lib/format";
import { SELECT_EVENTOS, enRango, esFranja, type Evento } from "@/lib/eventos";
import { supabaseAdmin } from "@/lib/supabase";

// Aviso de "dato no comparable" arriba de las tablas cuyo rango cruza una FRANJA (migración 065).
// Es la mitad de F1-10 que no es un gráfico: si el rango elegido pisa un período donde el dato venía
// mal, la tabla lo tiene que decir en vez de mentir en silencio. Los eventos puntuales no avisan acá
// —son una marca en las curvas, no un problema de comparabilidad— salvo que caigan justo en el rango,
// donde alcanzan una línea al pie.
//
// Server component con su propia query (patrón de RitmoCouriers): si la 065 no está aplicada, la
// query falla y no se dibuja nada. Nunca puede tirar la página.
export async function AvisoEventos({ from, to }: { from: string; to: string }) {
  const { data } = await supabaseAdmin().from("eventos")
    .select(SELECT_EVENTOS).lte("fecha", to).order("fecha", { ascending: false });
  const evs = enRango((data ?? []) as Evento[], from, to);
  if (!evs.length) return null;

  // Una línea al pie de los filtros, no una caja por franja: el aviso depende del rango elegido —no
  // es un problema del sistema, así que no va a la campanita de la nav— pero tampoco justifica media
  // pantalla. Franjas primero (las que rompen la comparación), después los puntuales.
  const franjas = evs.filter(esFranja);
  const items = [
    ...franjas.map((e) => ({
      k: e.fecha + "f",
      cuando: `${fmtDate(e.fecha)}→${fmtDate(e.fecha_fin!)}`,
      texto: e.texto,
      rompe: true,
    })),
    ...evs.filter((e) => !esFranja(e)).map((e) => ({
      k: e.fecha, cuando: fmtDate(e.fecha), texto: e.texto, rompe: false,
    })),
  ];

  // Colapsado: el texto de las franjas es largo (párrafos enteros explicando por qué el dato no
  // sirve) y estaba corrido en una sola línea arriba de todo, empujando el panel hacia abajo. El
  // titular queda visible —que es la alarma— y el porqué está a un click, una línea por evento.
  return (
    <details className="group text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span className="font-medium text-amber-700 dark:text-amber-500">
          ⚑ En el rango: {items.length} {items.length === 1 ? "aviso" : "avisos"}
        </span>
        {franjas.length > 0 && <span>· hay tramos que no se pueden comparar</span>}
        <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
      </summary>
      <ul className="mt-1.5 space-y-1 border-l-2 pl-3 text-muted-foreground">
        {items.map((it) => (
          <li key={it.k}>
            <span className={it.rompe ? "font-medium text-amber-700 dark:text-amber-500" : "font-medium text-foreground"}>
              {it.cuando}
            </span>{" "}
            {it.rompe && <span className="text-amber-700 dark:text-amber-500">dato no comparable — </span>}
            {it.texto}
          </li>
        ))}
        <li>
          <Link href="/config" className="underline underline-offset-2 hover:text-foreground">editar eventos</Link>
        </li>
      </ul>
    </details>
  );
}

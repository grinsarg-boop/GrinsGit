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

  const franjas = evs.filter(esFranja);
  const puntuales = evs.filter((e) => !esFranja(e));

  return (
    <div className="space-y-2">
      {franjas.map((e) => (
        <div key={e.id} className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <span className="font-medium text-amber-700 dark:text-amber-500">
            ⚑ Dato no comparable · {fmtDate(e.fecha)} → {fmtDate(e.fecha_fin!)}
          </span>
          <span className="ml-1 text-muted-foreground">{e.texto}</span>
        </div>
      ))}
      {puntuales.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">⚑ En el rango:</span>{" "}
          {puntuales.map((e) => `${fmtDate(e.fecha)} ${e.texto}`).join(" · ")}{" "}
          <Link href="/config" className="underline underline-offset-2">editar eventos</Link>
        </p>
      )}
    </div>
  );
}

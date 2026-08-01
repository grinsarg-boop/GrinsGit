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
  const texto = [
    ...evs.filter(esFranja).map((e) => `dato no comparable ${fmtDate(e.fecha)}→${fmtDate(e.fecha_fin!)}: ${e.texto}`),
    ...evs.filter((e) => !esFranja(e)).map((e) => `${fmtDate(e.fecha)} ${e.texto}`),
  ].join(" · ");

  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium text-amber-700 dark:text-amber-500">⚑ En el rango:</span> {texto}{" "}
      <Link href="/config" className="underline underline-offset-2">editar eventos</Link>
    </p>
  );
}

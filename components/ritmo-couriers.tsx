import { Tip } from "@/components/ui/tooltip";
import { supabaseAdmin } from "@/lib/supabase";

// Franja "ritmos normales": cuánto tarda cada courier medido de nuestro propio historial
// (RPC courier_tiempos, 042). Su función es que las barras rojas / INMADURO de los últimos
// días no asusten: a los 7 días de despacho Urbano solo ~1/3 de la cohorte tiene desenlace.
// Server component; si la RPC no está aplicada, no renderiza nada.
type Tiempo = {
  courier: string; muestra: number;
  venta_despacho_med: number | null;
  entrega_med: number | null; entrega_p80: number | null; entrega_p90: number | null;
  devolucion_med: number | null;
  res_7d: number | null; res_14d: number | null; res_21d: number | null;
};

const N = (v: number | null) => (v == null ? null : Math.round(Number(v)));
const pct = (v: number | null) => (v == null ? "?" : `${Math.round(Number(v) * 100)}%`);

export async function RitmoCouriers({ courier }: { courier?: string | null }) {
  const { data } = await supabaseAdmin().rpc("courier_tiempos");
  const tiempos = ((data ?? []) as Tiempo[]).filter((t) => !courier || t.courier === courier);
  if (!tiempos.length) return null;

  const frase = (t: Tiempo) => {
    const nombre = t.courier === "urbano" ? "Urbano" : "Fixy";
    if (N(t.entrega_med) === 0) {
      return `${nombre}: entrega y resuelve el mismo día del despacho (${pct(t.res_7d)} con desenlace a los 7 días)`;
    }
    return (
      `${nombre}: entrega mediana ${N(t.entrega_med)} días (8 de cada 10 antes de los ${N(t.entrega_p80)}); ` +
      `a los 7 días solo ${pct(t.res_7d)} de la cohorte tiene desenlace y a los 21 ${pct(t.res_21d)}` +
      (t.devolucion_med != null ? ` — las devoluciones tardan mediana ${N(t.devolucion_med)} días` : "")
    );
  };

  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden>⏱</span>
      <span>
        <b className="text-foreground">Ritmos normales</b> — {tiempos.map(frase).join(". ")}. Por eso
        los últimos días siempre se ven rojos e inmaduros: es la espera esperada, no pérdida.
        <Tip tip="Medido de nuestro propio historial de guías (se recalcula solo): entrega = despachadas en los últimos 45 días; % con desenlace por edad = cohortes con 25-80 días (todas con tiempo de sobra para madurar). La cola larga son las devoluciones, que tardan semanas en confirmarse. Si un día viejo sigue muy por debajo de estos ritmos, ahí sí: mirá /trabados." />
      </span>
    </p>
  );
}

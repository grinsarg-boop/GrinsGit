import { Card, CardContent } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import { TrabadosTabla, type TrabadoRow } from "@/components/trabados-tabla";
import { UrbanoRedirigir } from "@/components/urbano-redirigir";
import { fmtMoney } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase";

export const revalidate = 60;

// Los pedidos que frenan la madurez: guías en la calle sin desenlace y sin movimiento hace 14+
// días — los mismos que /ventas marca con "!" (predicado compartido vía trabados_list, migr 038).
// El objetivo es que esta página esté VACÍA: cada guía resuelta (reclamo mediante) cierra su
// cohorte y la madurez del día llega al 100%.
type Trabado = {
  courier: string; tracking: string; order_number: string | null; customer_name: string | null;
  province: string | null; product: string | null; cod_amount: number | null;
  dispatched_at: string; status_canonical: string; status_raw: string | null;
  last_move: string; dias: number;
};

const COURIER: Record<string, string> = { urbano: "Urbano", fixy: "Fixy" };
const seguimientoUrbano = (tk: string) =>
  `https://www.urbano.com.ar/webservice/cespecifica/?shi_codigo=${Number(process.env.URBANO_SHIPPER) || 4362}&cli_codigo=${tk}`;

export default async function Trabados() {
  const { data, error } = await supabaseAdmin().rpc("trabados_list");
  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          No pude leer los trabados ({error.message}). Si dice que la función no existe, falta
          aplicar la migración 038 en el SQL Editor.
        </CardContent>
      </Card>
    );
  }
  const rows = (data ?? []) as Trabado[];
  const codTotal = rows.reduce((s, r) => s + Number(r.cod_amount ?? 0), 0);
  const porCourier = rows.reduce<Record<string, number>>((m, r) => ((m[r.courier] = (m[r.courier] ?? 0) + 1), m), {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          Trabados
          <Tip tip="Guías despachadas que siguen sin desenlace y no registran ningún movimiento de estado hace 14+ días — las mismas que /ventas marca con '!'. Son pedidos para RECLAMAR a la logística: cada uno que se resuelve cierra su cohorte y la madurez del día llega al 100%. El objetivo es que esta página esté vacía. Tocá la guía de Urbano para abrir su seguimiento y reclamar." />
        </h1>
        <p className="text-sm text-muted-foreground">
          {rows.length === 0
            ? "Nada trabado — todas las cohortes maduran solas. 🎉"
            : `${rows.length} guías sin movimiento hace 14+ días · ${fmtMoney(codTotal)} de COD frenado · ${Object.entries(porCourier).map(([c, n]) => `${COURIER[c] ?? c}: ${n}`).join(" · ")}`}
        </p>
      </div>

      {rows.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <TrabadosTabla
              rows={rows.map((r): TrabadoRow => ({
                ...r,
                href: r.courier === "urbano" ? seguimientoUrbano(r.tracking) : null,
              }))}
            />
          </CardContent>
        </Card>
      )}

      <UrbanoRedirigir />
    </div>
  );
}

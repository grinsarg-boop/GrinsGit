import { revalidatePath } from "next/cache";
import { Tip } from "@/components/ui/tooltip";
import { SaveButton } from "@/components/save-button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Descripciones cortas de cada setting (para no editar a ciegas). Lo que no esté acá se muestra igual.
const SETTING_HELP: Record<string, string> = {
  commission_pct: "Comisión sobre COD entregado, por courier. Ej: {\"urbano\":0.052,\"fixy\":0.01}",
  mp_fee_pct: "Fee de MercadoPago sobre las señas (0.10 = 10%).",
  fixy_cpa_multiplier: "Peso de Fixy en el reparto del gasto de Ads (1.4).",
  urbano_freight_mult: "Multiplicador tarifa→costo final de Urbano (1.29).",
  urbano_freight_fallback: "Costo de flete Urbano cuando no hay tarifa ni promedio (ARS).",
  correo_flete: "Flete medio de Correo Argentino por despacho (ARS).",
  cuotas_commission: "Comisión MP 3 cuotas sin interés (0.18 = 18%).",
  maturity_days: "Días para madurar la cohorte, por courier. Ej: {\"urbano\":10,\"fixy\":7,\"correo\":10}",
  prior_window_days: "Ventana (días) del prior de entrega.",
  prior_min_n: "N mínimo para confiar en el prior por cohorte.",
  freight_avg_window_days: "Ventana del promedio rolling de flete Urbano.",
  fixy_freight_default: "Flete Fixy por defecto (ARS) cuando el CP/provincia no está mapeado.",
  fixy_freight_by_prov: "Flete Fixy por provincia (ARS). {\"BUENOS AIRES\":8753, ...}",
  fixy_freight_by_cp: "Flete Fixy por código postal (ARS). {\"1414\":5198, ...} — ~250 CPs.",
  alert_rules: "Umbrales de las alertas (no toca el P&L).",
};
// Settings que NO se editan acá: son runtime/secreto, no configuración.
const HIDDEN = new Set(["ml_token"]);

const RECOMPUTE_DAYS = 60;
async function recompute(db: ReturnType<typeof supabaseAdmin>) {
  const from = new Date(Date.now() - RECOMPUTE_DAYS * 86400_000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  await db.rpc("recompute_priors");
  await db.rpc("recompute_daily_pnl", { p_from: from, p_to: to });
}

// Editar el costo de un (producto, pack). Marca is_estimated=false (es un dato real cargado).
async function saveCost(formData: FormData) {
  "use server";
  const product_id = Number(formData.get("product_id"));
  const pack = Number(formData.get("pack"));
  const unit_cost = Number(formData.get("unit_cost"));
  if (!product_id || !pack || !Number.isFinite(unit_cost) || unit_cost < 0) return;
  const db = supabaseAdmin();
  await db.from("product_costs").upsert({ product_id, pack, unit_cost, is_estimated: false }, { onConflict: "product_id,pack" });
  await recompute(db);
  revalidatePath("/config"); revalidatePath("/");
}

// Editar un setting (valor = JSON válido: número escalar u objeto). Recalcula el P&L.
async function saveSetting(formData: FormData) {
  "use server";
  const key = String(formData.get("key"));
  const raw = String(formData.get("value") ?? "").trim();
  if (!key || HIDDEN.has(key) || !raw) return;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return; } // JSON inválido → no guarda (evita romper el recompute)
  const db = supabaseAdmin();
  await db.from("settings").upsert({ key, value });
  // fixy_freight_* solo afecta estimaciones nuevas (fixy-discover), no requiere recompute inmediato.
  if (!key.startsWith("fixy_freight")) await recompute(db);
  revalidatePath("/config"); revalidatePath("/");
}

// Eventos anotados sobre las series (065). No tocan el P&L: son contexto para leerlo, así que no
// disparan recompute. Un evento con "hasta" es una FRANJA de dato no comparable y además avisa arriba
// de las tablas cuyo rango la cruza; sin "hasta" es una marca puntual en los gráficos.
async function saveEvento(formData: FormData) {
  "use server";
  const fecha = String(formData.get("fecha") ?? "");
  const fin = String(formData.get("fecha_fin") ?? "").trim();
  const texto = String(formData.get("texto") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !texto) return;
  if (fin && (!/^\d{4}-\d{2}-\d{2}$/.test(fin) || fin < fecha)) return;
  await supabaseAdmin().from("eventos").upsert(
    { fecha, fecha_fin: fin || null, texto }, { onConflict: "fecha,texto" });
  revalidatePath("/config"); revalidatePath("/"); revalidatePath("/tendencias");
}

async function borrarEvento(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  if (!id) return;
  await supabaseAdmin().from("eventos").delete().eq("id", id);
  revalidatePath("/config"); revalidatePath("/"); revalidatePath("/tendencias");
}

const fmtVal = (v: unknown) => (v !== null && typeof v === "object" ? JSON.stringify(v, null, 2) : JSON.stringify(v));

export default async function ConfigPage() {
  const db = supabaseAdmin();
  const [{ data: settings }, { data: costs }, { data: products }, { data: eventos }] = await Promise.all([
    db.from("settings").select("key, value").order("key"),
    db.from("product_costs").select("product_id, pack, unit_cost, is_estimated"),
    db.from("products").select("id, name").eq("active", true).order("name"),
    db.from("eventos").select("id, fecha, fecha_fin, texto").order("fecha", { ascending: false }),
  ]);
  const eventoRows = (eventos ?? []) as { id: number; fecha: string; fecha_fin: string | null; texto: string }[];
  const pname = new Map((products ?? []).map((p) => [p.id, p.name as string]));
  const costRows = ((costs ?? []) as { product_id: number; pack: number; unit_cost: number; is_estimated: boolean }[])
    .sort((a, b) => (pname.get(a.product_id) ?? "").localeCompare(pname.get(b.product_id) ?? "") || a.pack - b.pack);
  const settingRows = ((settings ?? []) as { key: string; value: unknown }[]).filter((s) => !HIDDEN.has(s.key));

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Configuración</h1>
        <p className="max-w-[70ch] text-sm text-muted-foreground">
          Variables que alimentan el P&amp;L. Editar un costo o parámetro <b className="text-foreground">recalcula el P&amp;L</b> (últimos {RECOMPUTE_DAYS} días) y pisa los valores actuales. Los fletes Fixy solo afectan estimaciones nuevas.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          Costos de producto
          <Tip tip="Costo TOTAL del pack en ARS (no unitario). Los packs sin costo real se estiman como pack1×N y se marcan 'estimado'; cargá el real para fijarlo." />
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Pack</TableHead>
              <TableHead>Costo total (ARS)</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {costRows.map((c) => (
              <TableRow key={`${c.product_id}-${c.pack}`}>
                <TableCell className="font-medium">{pname.get(c.product_id) ?? `#${c.product_id}`}</TableCell>
                <TableCell className="text-right tabular-nums">×{c.pack}</TableCell>
                <TableCell colSpan={2}>
                  <form action={saveCost} className="flex items-center gap-2">
                    <input type="hidden" name="product_id" value={c.product_id} />
                    <input type="hidden" name="pack" value={c.pack} />
                    <input type="number" name="unit_cost" defaultValue={c.unit_cost} min={0} step="1"
                      className="w-28 rounded border bg-background px-2 py-1 text-sm tabular-nums" />
                    {c.is_estimated && <span className="text-xs text-amber-600 dark:text-amber-500">estimado</span>}
                    <SaveButton />
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">+ agregar costo de un pack nuevo</summary>
          <form action={saveCost} className="mt-2 flex flex-wrap items-center gap-2">
            <select name="product_id" required defaultValue="" className="rounded border bg-background px-2 py-1 text-sm">
              <option value="" disabled>producto…</option>
              {(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="number" name="pack" required min={1} step="1" placeholder="pack" className="w-20 rounded border bg-background px-2 py-1 text-sm" />
            <input type="number" name="unit_cost" required min={0} step="1" placeholder="costo ARS" className="w-28 rounded border bg-background px-2 py-1 text-sm" />
            <SaveButton>Agregar</SaveButton>
          </form>
        </details>
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          Eventos
          <Tip tip="Blackouts y cambios de régimen anotados sobre las curvas. Sin 'hasta' es una marca punteada en los gráficos ('acá pasó algo'); con 'hasta' es una FRANJA de dato no comparable, que además avisa arriba de las tablas cuyo rango la cruza. No tocan el P&L: son contexto para leerlo, así que no recalculan nada." />
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Desde</TableHead>
              <TableHead className="w-28">Hasta</TableHead>
              <TableHead>Qué pasó</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {eventoRows.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="tabular-nums">{e.fecha}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{e.fecha_fin ?? "—"}</TableCell>
                <TableCell className="text-sm">{e.texto}</TableCell>
                <TableCell>
                  <form action={borrarEvento}>
                    <input type="hidden" name="id" value={e.id} />
                    <button type="submit" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-destructive">borrar</button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
            {!eventoRows.length && (
              <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground">Sin eventos cargados</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <form action={saveEvento} className="flex flex-wrap items-center gap-2">
          <input type="date" name="fecha" required aria-label="Desde" className="rounded border bg-background px-2 py-1 text-sm" />
          <input type="date" name="fecha_fin" aria-label="Hasta (opcional, para una franja)" className="rounded border bg-background px-2 py-1 text-sm" />
          <input type="text" name="texto" required placeholder="qué pasó ese día" className="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-sm" />
          <SaveButton>Agregar</SaveButton>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          Parámetros del P&amp;L
          <Tip tip={"Cada valor es JSON: un número (0.1) o un objeto como {\"urbano\":0.052}. Si el JSON es inválido no guarda, para no romper el recálculo."} />
        </h2>
        <div className="space-y-3">
          {settingRows.map((s) => (
            <form key={s.key} action={saveSetting} className="flex flex-wrap items-start gap-3 border-b pb-3">
              <input type="hidden" name="key" value={s.key} />
              <div className="w-56 shrink-0">
                <div className="font-mono text-sm">{s.key}</div>
                {SETTING_HELP[s.key] && <div className="text-xs text-muted-foreground">{SETTING_HELP[s.key]}</div>}
              </div>
              <textarea name="value" defaultValue={fmtVal(s.value)} rows={typeof s.value === "object" && s.value !== null ? Math.min(8, Object.keys(s.value).length + 1) : 1}
                className="min-w-0 flex-1 rounded border bg-background px-2 py-1 font-mono text-xs" />
              <SaveButton />
            </form>
          ))}
        </div>
      </section>
    </main>
  );
}

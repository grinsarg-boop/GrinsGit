import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchCashflow, porMes, saldos, balance5050 } from "@/lib/cashflow";
import { fetchStock, inventarioSafe } from "@/lib/stock";

// Herramientas del asistente = las RPCs de lectura de Supabase, tal cual.
// El modelo elige la función y completa los args (p_from/p_to/p_courier/p_producto);
// el run() la ejecuta con service_role (bypassa RLS) y devuelve el JSON crudo.
//
// ponytail: NO se crea SQL nuevo — estas RPCs ya existen y las usan los paneles.
// El único agregado es el wrapper que las expone como tools.

const DATE = { type: "string" as const, description: "Fecha YYYY-MM-DD (ej 2026-07-01)" };
const COURIER = {
  type: "string" as const,
  enum: ["urbano", "fixy", "correo", "ml"],
  description: "Canal. Omitir = todos.",
};
const PRODUCTO = {
  type: "integer" as const,
  description: "id de producto (ver catálogo en el system prompt). Omitir = todos.",
};

type Prop = Record<string, unknown>;
type Cfg = {
  rpc: string;
  description: string;
  properties?: Record<string, Prop>;
  required?: string[];
};

function rpcTool(cfg: Cfg) {
  return betaTool({
    name: cfg.rpc,
    description: cfg.description,
    inputSchema: {
      type: "object",
      properties: cfg.properties ?? {},
      required: cfg.required ?? [],
      additionalProperties: false,
    },
    run: async (input: Record<string, unknown>) => {
      const args: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input ?? {})) {
        if (v !== undefined && v !== null && v !== "") args[k] = v;
      }
      const { data, error } = await supabaseAdmin().rpc(cfg.rpc, args);
      if (error) return `ERROR de ${cfg.rpc}: ${error.message}`;
      // Cap defensivo: menos filas = menos JSON por turno = loop más rápido. El modelo acota el rango.
      const rows = Array.isArray(data) ? data.slice(0, 80) : data;
      const note = Array.isArray(data) && data.length > 80 ? ` [truncado: ${data.length} filas, mostrando 80; acotá el rango o agrupá]` : "";
      return JSON.stringify(rows) + note;
    },
  });
}

export const chatTools = [
  rpcTool({
    rpc: "dashboard_days",
    description: "P&L por día de DESPACHO (el panel Resumen). Usá para 'cómo viene', totales por día despachado, revenue/profit conf y est, ads, flete, comisiones.",
    properties: { p_from: DATE, p_courier: COURIER },
    required: ["p_from"],
  }),
  rpcTool({
    rpc: "sales_days",
    description: "P&L por día de VENTA (el panel Ventas). Usá cuando la pregunta es por fecha de venta/generación del pedido, no por despacho.",
    properties: { p_from: DATE, p_courier: COURIER },
    required: ["p_from"],
  }),
  rpcTool({
    rpc: "sales_by_product",
    description: "P&L por día de venta agrupado por courier × producto. Usá para comparar productos o canales en un rango.",
    properties: { p_from: DATE, p_to: DATE, p_courier: COURIER },
    required: ["p_from", "p_to"],
  }),
  rpcTool({
    rpc: "analisis_pnl",
    description: "P&L por despacho agrupado por courier × producto en un rango: revenue, flete, comisiones, costo_producto, ads, profit_conf/est, percepciones.",
    properties: { p_from: DATE, p_to: DATE, p_courier: COURIER },
    required: ["p_from", "p_to"],
  }),
  rpcTool({
    rpc: "analisis_zonas",
    description: "Rentabilidad por PROVINCIA: guias, entregadas, devueltas, cod_cobrado, flete, flete_perdido, comisiones, costo_producto, margen_bruto, margen_neto. Usá para '¿qué zona conviene?'.",
    properties: { p_from: DATE, p_to: DATE, p_courier: COURIER, p_producto: PRODUCTO },
    required: ["p_from", "p_to"],
  }),
  rpcTool({
    rpc: "analisis_packs",
    description: "Rentabilidad por TAMAÑO DE PACK (1/2/3 unidades): guias, entregadas, devueltas, margen_bruto/neto. p_min = muestra mínima (default 40).",
    properties: {
      p_from: DATE, p_to: DATE, p_courier: COURIER, p_producto: PRODUCTO,
      p_min: { type: "integer", description: "muestra mínima de guías por pack (default 40)" },
    },
    required: ["p_from", "p_to"],
  }),
  rpcTool({
    rpc: "analisis_maduracion",
    description: "Curva de MADURACIÓN de la tasa de entrega por días desde despacho (una cohorte madura ~21 días). Usá para saber cuán confiable es un dato reciente.",
    properties: { p_desde: DATE, p_courier: COURIER, p_producto: PRODUCTO },
    required: ["p_desde"],
  }),
  rpcTool({
    rpc: "analisis_desenlaces",
    description: "Desglose de DESENLACES (estado final: entregada/devuelta/en tránsito/etc) con guías y cod por estado.",
    properties: { p_from: DATE, p_to: DATE, p_courier: COURIER, p_producto: PRODUCTO },
    required: ["p_from", "p_to"],
  }),
  rpcTool({
    rpc: "anuncios_pnl",
    description: "P&L por ANUNCIO de Meta (ad_id): pedidos, despachadas, entregadas, cod_cobrado, spend, por campaña/adset. Usá para CPA y calidad por anuncio. OJO: ads de ML NO están acá.",
    properties: { p_from: DATE, p_to: DATE },
    required: ["p_from", "p_to"],
  }),
  rpcTool({
    rpc: "courier_tiempos",
    description: "Tiempos de entrega por courier: mediana venta→despacho, entrega med/p80/p90, devolución, y resolución a 7/14/21 días. Sin args.",
  }),
  rpcTool({
    rpc: "urbano_cobranza",
    description: "Ventanas de cobranza de Urbano (giro los martes, neto de 5,547%): ventana, fecha_pago, guías, cod_bruto, comisión, neto.",
    properties: { p_desde: DATE },
    required: ["p_desde"],
  }),
  rpcTool({
    rpc: "fixy_cobranza",
    description: "Liquidación diaria de Fixy: día, guías, cod_bruto, neto.",
    properties: { p_desde: DATE },
    required: ["p_desde"],
  }),
  rpcTool({
    rpc: "trabados_list",
    description: "Envíos TRABADOS (>14 días sin resolver): courier, tracking, orden, cliente, provincia, producto, cod, días. Sin args.",
  }),
  rpcTool({
    rpc: "ml_a_liquidar",
    description: "Monto de MercadoLibre pendiente de liquidar. Sin args.",
  }),
  rpcTool({
    rpc: "urbano_sin_guia",
    description: "Envíos de Urbano despachados que TODAVÍA no tienen número de guía (para reclamar/descubrir). p_since = desde cuándo mirar.",
    properties: { p_since: DATE, p_limit: { type: "integer", description: "máx filas (default 150)" } },
    required: ["p_since"],
  }),
  // Caja y Stock viven en OTRAS bases (Cashflow / Stock); no son RPCs → run() propio que reusa
  // las libs de los paneles /caja y /stock. Sin args (devuelven el resumen completo).
  betaTool({
    name: "caja_resumen",
    description: "Estado de la CAJA real (app Cashflow, panel /caja): saldos por caja, por mes (ingresos, estructura, ajustes, retiros, ya_modelado, por categoría) y retiros 50/50 de los socios (Fran/Santi). Usá para plata en mano, estructura, cuánto retiró cada socio, neto real.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
    run: async () => {
      try {
        const { movs, cajas, cats } = await fetchCashflow();
        return JSON.stringify({
          saldos: saldos(movs, cajas).map((s) => ({ caja: s.caja.nombre, saldo: s.saldo, moneda: s.caja.moneda })),
          por_mes: porMes(movs, cats),
          retiros_socios: balance5050(movs, cajas), // una entrada por moneda; no mezclar ARS con USD
        });
      } catch (e) {
        return `Error leyendo caja: ${(e as Error).message}`;
      }
    },
  }),
  betaTool({
    name: "stock_resumen",
    description: "Estado del STOCK/inventario (panel /stock): valor total del inventario, stock por material (con mínimo y alerta de bajo stock) y stock por producto terminado. Usá para insumos, faltantes, valor de inventario.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
    run: async () => {
      try {
        const { materiales, productos } = await fetchStock();
        const valor = await inventarioSafe();
        return JSON.stringify({
          valor_inventario: valor,
          materiales: materiales.map((m) => ({ nombre: m.nombre, stock: m.stock, minimo: m.stock_minimo, bajo: Number(m.stock) <= Number(m.stock_minimo) })),
          productos: productos.map((p) => ({ nombre: p.nombre, stock: p.stock })),
        });
      } catch (e) {
        return `Error leyendo stock: ${(e as Error).message}`;
      }
    },
  }),
];

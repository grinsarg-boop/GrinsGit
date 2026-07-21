// Textos de los tooltips que describen la MISMA fórmula del P&L en las 4 páginas de datos.
// Viven acá porque si divergen mienten: pasó con "confirmado", que decía "plata que ya cobraste, neta de
// Ads" cuando en realidad ya tiene descontado también flete, comisiones y costo de producto — invitaba a
// restar dos veces las columnas Envío y Comis.
//
// La fórmula real (026_ml_ads.sql:224 y 032 sales_rows):
//   profit_confirmado = cod_entregado + senas_netas − flete − comisiones − costo_producto − ads
//   profit_estimado   = profit_confirmado + proyección de lo que sigue en la calle

export const TIP_FLETE =
  "Gasto de envío final. Es hundido: se paga por TODA guía despachada, se entregue o no — por eso no baja cuando sube la tasa de entrega. Correo: flete plano por orden pagada. ML: flete real de Mercado Envíos o Flex. Informativo: ya está descontado del profit.";

export const TIP_COMIS =
  "Comisión final del courier por cobrar en puerta (Urbano y Fixy), solo sobre lo efectivamente entregado — la de lo que sigue en la calle todavía no se cuenta. Correo: fee REAL de MercadoPago del pago conciliado (transferencia ~8%, Mercado Crédito ~7,6%, tarjeta 3 sin interés ~22%; el 18% plano queda solo para pagos aún no conciliados). ML: comisión real de la venta. Informativo: ya está descontada del profit.";

export const TIP_PERCEP =
  "Percepciones de IVA e IIBB que MercadoLibre/MercadoPago facturan sobre sus servicios (comisiones, envíos y publicidad) — SOLO canal ML, ~18% de esos cargos. Por día: estimadas con la tasa calibrada contra la factura real hasta que se sube el Reporte_Facturacion del mes en /sync, que las reemplaza por el valor exacto. Son pagos a cuenta de impuestos (criterio conservador: se cuentan como costo hasta que el contador diga lo contrario). Informativo: ya están descontadas del profit.";

export const TIP_CONFIRMADO =
  "Profit ya cerrado: lo cobrado menos envío, comisiones, costo de producto y Ads. NO es el monto cobrado — las columnas Envío y Comis. son informativas y ya están restadas acá, no las restes de nuevo. Puede dar negativo de forma temporal cuando todavía gastaste más en Ads de lo que maduró en ventas; se corrige a medida que las guías se entregan.";

export const TIP_ESTIMADO =
  "El confirmado más la proyección de las guías que siguen en la calle, según tu tasa de entrega histórica. Ya tiene todos los costos descontados (envío, comisiones, producto y Ads).";

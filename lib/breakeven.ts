// Break-even: la línea contra la que se juzga cada día de pauta. Las definiciones son del
// Playbook-Faris §8 — no se inventaron acá:
//
//   contribución pre-pauta = profit estimado + pauta   (lo que queda antes de gastar en ads)
//   break-even MER         = facturación / contribución   ( = 1 / tasa de contribución )
//   break-even CPA         = contribución / órdenes generadas
//
// Sale de datos que ya están en `sales_days` (#34: "se calculan de `profit_est + ads`"), así que no
// hace falta RPC nueva: la fórmula vive en un solo lugar y el panel la aplica sobre las filas que
// ya trajo.
//
// Se calcula sobre el rango que se está mirando, no como constante en `settings`, porque se mueve
// con la TASA DE ENTREGA mucho más que con cualquier decisión de puja: $8.768 en mayo → $14.276 en
// julio (+63%) casi solo por entrega. Un umbral fijo en la base envejece en semanas.
//
// ponytail: umbral plano sobre todo el rango. Si el rango cruza un cambio grande de entrega, el
// promedio miente hacia el medio — ahí la mejora es una ventana móvil de 30 días, no una constante.
export type FilaBE = { generadas: number; revenueEst: number; ads: number; profitEst: number };

export type BreakEven = {
  contribucion: number;
  tasa: number;      // contribución / facturación
  mer: number;       // break-even MER — NaN si no hay contribución positiva
  cpa: number;       // break-even CPA — NaN si no hubo órdenes
};

export function breakEven(filas: FilaBE[]): BreakEven {
  let rev = 0, ads = 0, profit = 0, gen = 0;
  for (const f of filas) {
    rev += f.revenueEst; ads += f.ads; profit += f.profitEst; gen += f.generadas;
  }
  const contribucion = profit + ads;
  return {
    contribucion,
    tasa: rev > 0 ? contribucion / rev : 0,
    // Contribución ≤ 0 = no hay MER que alcance: cada peso de pauta destruye plata. NaN, no Infinity:
    // el panel esconde la línea en vez de dibujarla en el infinito.
    mer: contribucion > 0 && rev > 0 ? rev / contribucion : NaN,
    cpa: gen > 0 && contribucion > 0 ? contribucion / gen : NaN,
  };
}

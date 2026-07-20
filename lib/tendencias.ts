// Media móvil TRAILING de ventana w: promedio de los últimos w puntos, definida recién desde el
// punto w-1 (antes no hay ventana completa → null, la línea arranca donde el número es real).
export const mediaMovil = (vals: number[], w: number): (number | null)[] =>
  vals.map((_, i) =>
    i < w - 1 ? null : vals.slice(i - w + 1, i + 1).reduce((s, v) => s + v, 0) / w,
  );

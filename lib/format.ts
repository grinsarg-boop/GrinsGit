// Formato AR-friendly (§6): $ 1.234.567 · porcentajes 1 decimal · fechas dd/mm
const money = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

export const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : `$ ${money.format(Math.round(n))}`;

export const fmtPct = (n: number | null | undefined) =>
  n == null ? "—" : `${(n * 100).toFixed(1).replace(".", ",")}%`;

export const fmtDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export const fmtRatio = (n: number | null | undefined) =>
  n == null ? "—" : n.toFixed(2).replace(".", ",");

export const daysAgoIso = (n: number) =>
  new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);

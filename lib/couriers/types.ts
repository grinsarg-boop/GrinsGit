// El único adapter del proyecto (SPEC §5.4): dos implementaciones reales desde el día 1.
export type CourierEvent = {
  courier: "urbano" | "urbano_ant" | "fixy";   // urbano_ant = cuenta de pago anticipado (104)
  tracking: string;
  order_ref?: string;
  province?: string;
  status_raw: string;
  occurred_at: string;
  tarifa?: number;
  importe?: number;
  raw?: unknown;
};

// events + warnings de fetch (fallos de auth/HTTP/tanda). El sync los sube a logSyncRun para que un
// token vencido o una tanda caída NO se vean como 'ok' — eran errores silenciosos (audit tema A).
export type FetchStatusesResult = {
  events: CourierEvent[];
  warnings: unknown[];
};

export interface CourierClient {
  fetchStatuses(trackings: string[]): Promise<FetchStatusesResult>;
}

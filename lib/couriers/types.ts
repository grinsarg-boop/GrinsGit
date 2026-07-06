// El único adapter del proyecto (SPEC §5.4): dos implementaciones reales desde el día 1.
export type CourierEvent = {
  courier: "urbano" | "fixy";
  tracking: string;
  order_ref?: string;
  province?: string;
  status_raw: string;
  occurred_at: string;
  tarifa?: number;
  importe?: number;
  raw?: unknown;
};

export interface CourierClient {
  fetchStatuses(trackings: string[]): Promise<CourierEvent[]>;
}

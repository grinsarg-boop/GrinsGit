import { afterEach, describe, expect, it } from "vitest";
import { badCronAuth } from "./supabase";

const req = (auth?: string) =>
  new Request("http://local/api/sync/x", auth ? { headers: { authorization: auth } } : undefined);

describe("badCronAuth", () => {
  const prev = process.env.CRON_SECRET;
  afterEach(() => {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });

  it("sin CRON_SECRET seteado rechaza todo con 500 — 'Bearer undefined' no pasa", () => {
    delete process.env.CRON_SECRET;
    expect(badCronAuth(req("Bearer undefined"))?.status).toBe(500);
    expect(badCronAuth(req())?.status).toBe(500);
  });

  it("token equivocado o ausente → 401", () => {
    process.env.CRON_SECRET = "s3cr3t";
    expect(badCronAuth(req("Bearer nope"))?.status).toBe(401);
    expect(badCronAuth(req())?.status).toBe(401);
  });

  it("token correcto → pasa (null)", () => {
    process.env.CRON_SECRET = "s3cr3t";
    expect(badCronAuth(req("Bearer s3cr3t"))).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { adLabel, campaignLabel } from "./ad-label";

describe("campaignLabel", () => {
  it("parsea la convención estructurada", () => {
    expect(campaignLabel("abo-cv01-beevenom-03-beevenom")).toEqual({ label: "Beevenom · ABO", tipo: "ABO", producto: "Beevenom" });
    expect(campaignLabel("cbo-cv02-natures-01-naturessunrise-bsas")).toEqual({ label: "Nature's · CBO · BSAS", tipo: "CBO", producto: "Nature's" });
  });
  it("resuelve los legacy sueltos vía alias", () => {
    expect(campaignLabel("Nu - Nubba ABO")).toEqual({ label: "Nubba · ABO", tipo: "ABO", producto: "Nubba" });
    expect(campaignLabel("Bee Venom | CBO").label).toBe("Beevenom · CBO");
  });
  it("acorta lo que no matchea, sin dejar el slug crudo largo", () => {
    const r = campaignLabel("Campaña rara sin convención 122118938169156780");
    expect(r.label.length).toBeLessThanOrEqual(30);
    expect(r.label).not.toContain("122118938169156780");
  });
  it("null → sin atribución", () => {
    expect(campaignLabel(null).label).toBe("(sin atribución)");
  });
});

describe("adLabel", () => {
  it("parsea ángulo · formato · versión · audiencia y stripea el ID de Meta", () => {
    expect(adLabel("abo-cv01-beevenom-03-angv01-video-v02-mix25-45-122118938169156780"))
      .toEqual({ label: "áng01 · video v02 · mix25-45", formato: "video" });
    expect(adLabel("abo-cv01-natures-01-angv02-foto-base-v03-mujeres25-45"))
      .toEqual({ label: "áng02 · foto v03 · mujeres25-45", formato: "foto" });
  });
  it("free-form viejo: acorta y adivina formato", () => {
    const r = adLabel("Intenso V3 Realista");
    expect(r.label.length).toBeLessThanOrEqual(28);
  });
});

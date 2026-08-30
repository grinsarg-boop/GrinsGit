import { describe, expect, it } from "vitest";
import { mlNotifRow } from "@/lib/ml";

const SELLER = "262382468";
const aviso = {
  _id: "abc123",
  topic: "catalog_item_competition_status",
  resource: "/items/MLA3692036796",
  user_id: 262382468,
  application_id: 6959316803656,
  sent: "2026-08-25T12:16:00.000Z",
  attempts: 1,
};

describe("mlNotifRow", () => {
  it("acepta un aviso de nuestro vendedor y guarda el payload entero", () => {
    const row = mlNotifRow(aviso, SELLER);
    expect(row).toMatchObject({
      notif_id: "abc123",
      topic: "catalog_item_competition_status",
      resource: "/items/MLA3692036796",
      user_id: 262382468,
      sent: "2026-08-25T12:16:00.000Z",
      attempts: 1,
    });
    expect(row?.payload).toEqual(aviso);
  });

  // La frontera de confianza: la ruta es pública y ML no firma.
  it("descarta el aviso de otro vendedor", () => {
    expect(mlNotifRow({ ...aviso, user_id: 999 }, SELLER)).toBeNull();
  });

  it("descarta TODO si falta ML_SELLER_ID en vez de dejar la tabla abierta", () => {
    expect(mlNotifRow(aviso, undefined)).toBeNull();
    expect(mlNotifRow(aviso, "")).toBeNull();
  });

  it("descarta lo que no es una notificación", () => {
    for (const basura of [null, "hola", 42, {}, { topic: "items" }, { resource: "/items/X" }])
      expect(mlNotifRow(basura, SELLER)).toBeNull();
  });

  it("sin _id deduplica por topic+resource+sent (ML reintenta con los mismos tres)", () => {
    const sinId: Record<string, unknown> = { ...aviso };
    delete sinId._id;
    expect(mlNotifRow(sinId, SELLER)?.notif_id).toBe(
      "catalog_item_competition_status:/items/MLA3692036796:2026-08-25T12:16:00.000Z",
    );
  });

  it("no confunde un user_id string con uno numérico", () => {
    expect(mlNotifRow({ ...aviso, user_id: "262382468" }, SELLER)).not.toBeNull();
  });
});

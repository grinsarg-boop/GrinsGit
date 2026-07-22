import { describe, expect, it } from "vitest";
import { parseMarkdown, tokenizeInline } from "./markdown";

describe("markdown", () => {
  it("tokeniza negrita, itálica y código", () => {
    expect(tokenizeInline("hola **Fixy** y `x` e _y_")).toEqual([
      { k: "text", v: "hola " },
      { k: "b", v: "Fixy" },
      { k: "text", v: " y " },
      { k: "code", v: "x" },
      { k: "text", v: " e " },
      { k: "i", v: "y" },
    ]);
  });

  it("negrita sin cerrar (streaming) se deja literal", () => {
    expect(tokenizeInline("**parcial")).toEqual([{ k: "text", v: "**parcial" }]);
  });

  it("separa párrafos y listas", () => {
    const b = parseMarkdown("Intro\n- uno\n- **dos**\n\nfin");
    expect(b.map((x) => x.type)).toEqual(["p", "ul", "p"]);
    expect(b[1]).toMatchObject({ type: "ul", items: [[{ k: "text", v: "uno" }], [{ k: "b", v: "dos" }]] });
  });

  it("lista numerada y título", () => {
    const b = parseMarkdown("## Resumen\n1. a\n2. b");
    expect(b[0]).toMatchObject({ type: "h" });
    expect(b[1]).toMatchObject({ type: "ol" });
  });
});

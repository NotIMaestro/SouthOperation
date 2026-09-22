import { describe, expect, it } from "vitest";
import { packageDraftSchema, packageErrorMessage, qrTokenSchema, statusLabels } from "./types";

const draft = { description: "ציוד לדוגמה", origin: "מחסן בדיוני", destination: "מרכז בדיוני", responsiblePerson: "אחראי לדוגמה", status: "CREATED", contents: ["מסך לדוגמה"] };

describe("Hebrew package localization", () => {
  it("provides Hebrew labels for every status", () => {
    expect(Object.values(statusLabels)).toHaveLength(6);
    for (const label of Object.values(statusLabels)) expect(label).toMatch(/[א-ת]/);
  });
  it.each([
    { description: "" }, { description: "א".repeat(161) }, { description: null },
    { contents: [] }, { contents: Array(31).fill("פריט") }, { contents: null }, { status: "invalid" },
  ])("returns Hebrew validation messages for %j", (change) => {
    const parsed = packageDraftSchema.safeParse({ ...draft, ...change });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(packageErrorMessage(parsed.error)).toMatch(/[א-ת]/);
  });
  it("preserves the QR payload contract and localizes unexpected failures", () => {
    expect(qrTokenSchema.parse(" PKG:A7F3K9M2 ")).toBe("PKG:A7F3K9M2");
    expect(packageErrorMessage(new Error("Network error"))).toBe("שירות החבילות אינו זמין כרגע. נסו שוב בעוד רגע.");
  });
});

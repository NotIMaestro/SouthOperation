import { describe, expect, it } from "vitest";
import { createMockPackageService, GENERATED_PACKAGES_KEY } from "./mock-service";
import { type PackageDraft } from "./types";

const draft: PackageDraft = { description: "Demo kit", origin: "Fictional A", destination: "Fictional B", responsiblePerson: "Demo Keeper", status: "CREATED", contents: ["Sample item"] };
function setup() {
  const saved = new Map<string, string>();
  const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value); }, removeItem: (key: string) => { saved.delete(key); } };
  const options = { storage: () => storage, delayMs: 0 };
  return { saved, storage, options, service: createMockPackageService(options) };
}

describe("mock package service", () => {
  it("contains ten valid unique samples with all six statuses", async () => {
    const { service } = setup();
    const records = await service.getAllPackages();
    expect(records).toHaveLength(10);
    for (const key of ["id", "packageNumber", "qrToken"] as const) expect(new Set(records.map((p) => p[key])).size).toBe(10);
    expect(new Set(records.map((p) => p.status)).size).toBe(6);
  });
  it("returns the same package for a valid token and a trimmed number", async () => {
    const { service } = setup();
    expect(await service.findPackageByQrToken("  PKG:A7F3K9M2 ")).toEqual(await service.findPackageByPackageNumber(" 100001 "));
  });
  it.each(["", "https://example.test", "PKG:abc12345", "PKG:ABC", "<script>", "PKG:" + "A".repeat(33)])("rejects invalid QR input %s", async (value) => {
    await expect(setup().service.findPackageByQrToken(value)).rejects.toThrow();
  });
  it.each(["", "123", "100001x", "-10001", "000001", "100001 OR 1=1"])("rejects invalid manual input %s", async (value) => {
    await expect(setup().service.findPackageByPackageNumber(value)).rejects.toThrow();
  });
  it("returns null for valid unknown identifiers", async () => {
    const { service } = setup();
    expect(await service.findPackageByQrToken("PKG:ZZZZZZZZ")).toBeNull();
    expect(await service.findPackageByPackageNumber("999999")).toBeNull();
  });
  it("generates multiple unique records and retrieves each through both methods", async () => {
    const { service } = setup();
    const records = await Promise.all(Array.from({ length: 25 }, () => service.generatePackage(draft)));
    const all = await service.getAllPackages();
    expect(all).toHaveLength(35);
    for (const key of ["id", "packageNumber", "qrToken"] as const) expect(new Set(all.map((p) => p[key])).size).toBe(35);
    for (const record of records) {
      expect(await service.findPackageByQrToken(record.qrToken)).toEqual(record);
      expect(await service.findPackageByPackageNumber(record.packageNumber)).toEqual(record);
    }
  });
  it("survives a fresh service instance and resets only generated records", async () => {
    const { service, saved, options } = setup();
    saved.set("unrelated-setting", "keep");
    const record = await service.generatePackage(draft);
    const afterRefresh = createMockPackageService(options);
    expect(await afterRefresh.findPackageByPackageNumber(record.packageNumber)).toEqual(record);
    await afterRefresh.resetGeneratedPackages();
    expect(await service.findPackageByQrToken(record.qrToken)).toBeNull();
    expect(await service.getAllPackages()).toHaveLength(10);
    expect(saved.get("unrelated-setting")).toBe("keep");
  });
  it("retries collisions in any identifier across both sources", async () => {
    const { options } = setup();
    let attempt = 0;
    const candidates = [
      { id: "mock-001", packageNumber: "800001", qrToken: "PKG:NEWTEST1" },
      { id: "new-a", packageNumber: "100001", qrToken: "PKG:NEWTEST2" },
      { id: "new-b", packageNumber: "800002", qrToken: "PKG:A7F3K9M2" },
      { id: "new-c", packageNumber: "800003", qrToken: "PKG:NEWTEST3" },
      { id: "new-c", packageNumber: "800004", qrToken: "PKG:NEWTEST4" },
      { id: "new-d", packageNumber: "800003", qrToken: "PKG:NEWTEST5" },
      { id: "new-e", packageNumber: "800005", qrToken: "PKG:NEWTEST3" },
      { id: "new-f", packageNumber: "800006", qrToken: "PKG:NEWTEST6" },
    ];
    const service = createMockPackageService({ ...options, identifiers: () => candidates[attempt++] });
    expect((await service.generatePackage(draft)).id).toBe("new-c");
    expect((await service.generatePackage(draft)).id).toBe("new-f");
    expect(attempt).toBe(8);
  });
  it("reports exhausted collisions and invalid drafts without writing", async () => {
    const { options, saved } = setup();
    const service = createMockPackageService({ ...options, identifiers: () => ({ id: "mock-001", packageNumber: "100001", qrToken: "PKG:A7F3K9M2" }) });
    await expect(service.generatePackage(draft)).rejects.toThrow("מזהים ייחודיים");
    await expect(service.generatePackage({ ...draft, description: "   " })).rejects.toThrow();
    expect(saved.size).toBe(0);
  });
  it("detects corrupted storage and allows resetting it", async () => {
    const { service, saved } = setup();
    saved.set(GENERATED_PACKAGES_KEY, "not json");
    await expect(service.getAllPackages()).rejects.toThrow("פגום");
    await service.resetGeneratedPackages();
    expect(await service.getAllPackages()).toHaveLength(10);
  });
  it("reports storage failures without claiming a successful generation", async () => {
    const { options, storage, saved } = setup();
    storage.setItem = () => { throw new Error("quota"); };
    await expect(createMockPackageService(options).generatePackage(draft)).rejects.toThrow("לא נוצרה חבילה");
    expect(saved.size).toBe(0);
  });
});

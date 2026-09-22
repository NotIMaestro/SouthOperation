import { describe, expect, it, vi } from "vitest";
import data from "./mock-collection.json";
import { CONFIRMATIONS_KEY, createMockCollectionService } from "./mock-service";
import { getCurrentUser } from "./current-user";
import { collectionPackageSchema } from "./types";
import { createMockPackageService } from "@/lib/packages/mock-service";

function setup() {
  const memory = new Map<string, string>();
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: vi.fn((key: string, value: string) => { memory.set(key, value); }), removeItem: vi.fn((key: string) => { memory.delete(key); }) };
  const options = { storage: () => storage, source: async () => [], delayMs: 0, now: () => "2026-09-22T12:00:00Z" };
  return { service: createMockCollectionService(options), memory, storage, options };
}
const user = "user-001";
describe("collection ownership and persistence", () => {
  it("has valid fictional fixtures with unique identities and multiple products", () => {
    expect(data.users).toHaveLength(2);
    for (const field of ["id", "packageNumber", "qrToken", "barcodeValue"] as const) expect(new Set(data.packages.map((item) => item[field])).size).toBe(10);
    data.packages.forEach((item) => { expect(collectionPackageSchema.safeParse(item).success).toBe(true); expect(item.products.length).toBeGreaterThanOrEqual(2); });
    expect(getCurrentUser().id).toBe(user);
    expect(Object.isFrozen(getCurrentUser())).toBe(true);
  });
  it("returns only the current user's five pending and two confirmed packages", async () => {
    const { service } = setup();
    expect(await service.getPendingPackagesForUser(user)).toHaveLength(5);
    expect(await service.getConfirmedPackagesForUser(user)).toHaveLength(2);
    const snapshot = await service.getPackagesForUser(user);
    expect([...snapshot.pending, ...snapshot.confirmed].every((item) => item.assignedUserId === user)).toBe(true);
  });
  it("rejects spoofed user identity on every operation", async () => {
    const { service } = setup();
    const calls = [service.getPackagesForUser("user-002"), service.getPendingPackagesForUser("user-002"), service.getConfirmedPackagesForUser("user-002"), service.findPackageForUserByScannedValue("user-002", data.packages[7].qrToken), service.findPackageForUserByPackageNumber("user-002", "100008"), service.confirmPackagesForUser("user-002", ["mock-008"])];
    expect((await Promise.allSettled(calls)).every((item) => item.status === "rejected")).toBe(true);
  });
  it.each(["100008", "999999"])("does not disclose unavailable package %s", async (number) => {
    const { service } = setup();
    expect(await service.findPackageForUserByPackageNumber(user, number)).toBeNull();
  });
  it.each([data.packages[7].qrToken, data.packages[7].barcodeValue, "PKG:UNKNOWN1"])("does not disclose unavailable scanned value %s", async (value) => {
    expect(await setup().service.findPackageForUserByScannedValue(user, value)).toBeNull();
  });
  it.each([data.packages[0].qrToken, data.packages[0].barcodeValue])("finds pending package through %s without confirming", async (value) => {
    const { service, storage } = setup();
    expect((await service.findPackageForUserByScannedValue(user, ` ${value} `))?.packageNumber).toBe("100001");
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("trims numbers and rejects untrusted inputs", async () => {
    const { service } = setup();
    expect((await service.findPackageForUserByPackageNumber(user, " 100001 "))?.id).toBe("mock-001");
    for (const value of ["", "1000", "000001", "<script>"]) await expect(service.findPackageForUserByPackageNumber(user, value)).rejects.toThrow();
    for (const value of ["https://example.test", "PKG:bad", "100001", "7290001000011"]) await expect(service.findPackageForUserByScannedValue(user, value)).rejects.toThrow();
  });
  it("atomically confirms multiple packages, persists timestamps and survives service recreation", async () => {
    const { service, storage, options } = setup();
    const before = JSON.stringify(data);
    const next = await service.confirmPackagesForUser(user, ["mock-001", "mock-002"]);
    expect(next.pending).toHaveLength(3); expect(next.confirmed).toHaveLength(4);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    const restored = await createMockCollectionService(options).getPackagesForUser(user);
    expect(restored).toEqual(next);
    expect(restored.confirmed.find((item) => item.id === "mock-001")).toMatchObject({ confirmedByUserId: user, confirmedAt: options.now(), status: "CONFIRMED_RECEIVED" });
    expect(JSON.stringify(data)).toBe(before);
  });
  it.each([["mock-001", "mock-008"], ["mock-001", "missing"], ["mock-001", "mock-006"], ["mock-001", "mock-001"], []])("rejects invalid batches without partial writes: %j", async (...ids) => {
    const { service, storage } = setup();
    await expect(service.confirmPackagesForUser(user, ids)).rejects.toThrow();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(await service.getPendingPackagesForUser(user)).toHaveLength(5);
  });
  it("prevents repeated and concurrent confirmations", async () => {
    const { service, storage } = setup();
    const outcomes = await Promise.allSettled([service.confirmPackagesForUser(user, ["mock-001"]), service.confirmPackagesForUser(user, ["mock-001"])]);
    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    await expect(service.confirmPackagesForUser(user, ["mock-001"])).rejects.toThrow("כבר אושרה");
  });
  it("fails visibly when saving is unavailable, retaining pending packages", async () => {
    const { service, storage } = setup(); storage.setItem.mockImplementation(() => { throw new Error("Quota"); });
    await expect(service.confirmPackagesForUser(user, ["mock-001"])).rejects.toThrow("לא נשמר");
    expect(await service.getPendingPackagesForUser(user)).toHaveLength(5);
  });
  it("resets only confirmation overrides, preserving generated packages and seed approvals", async () => {
    const { service, memory } = setup(); memory.set("south-operation.demo-packages.v1", "keep");
    await service.confirmPackagesForUser(user, ["mock-001"]); await service.resetConfirmations();
    expect(memory.has(CONFIRMATIONS_KEY)).toBe(false);
    expect(memory.get("south-operation.demo-packages.v1")).toBe("keep");
    expect((await service.getPackagesForUser(user)).confirmed).toHaveLength(2);
  });
  it("does not trust confirmations written under a different user", async () => {
    const { service, memory } = setup();
    memory.set(CONFIRMATIONS_KEY, JSON.stringify([{ id: "mock-001", confirmedByUserId: "user-002", confirmedAt: "2026-09-22T12:00:00Z" }]));
    expect(await service.getPendingPackagesForUser(user)).toHaveLength(5);
  });
  it("reports corrupt storage and allows demo recovery", async () => {
    const { service, memory } = setup(); memory.set(CONFIRMATIONS_KEY, "invalid");
    await expect(service.getPackagesForUser(user)).rejects.toThrow("לא ניתן לקרוא");
    await service.resetConfirmations(); expect(await service.getPendingPackagesForUser(user)).toHaveLength(5);
  });
  it("integrates packages created by the existing QR generator", async () => {
    const { options, storage } = setup();
    const packages = createMockPackageService({ storage: () => storage, delayMs: 0 });
    const generated = await packages.generatePackage({ description: "ערכת הדגמה", origin: "מוצא בדיוני", destination: "יעד בדיוני", responsiblePerson: "אחראי לדוגמה", status: "CREATED", contents: ["מוצר א", "מוצר ב"] });
    const service = createMockCollectionService({ ...options, source: packages.getAllPackages });
    const found = await service.findPackageForUserByScannedValue(user, generated.qrToken);
    expect(found).toMatchObject({ id: generated.id, packageNumber: generated.packageNumber, assignedUserId: user, status: "AWAITING_USER_CONFIRMATION" });
    expect(found?.products).toHaveLength(2);
    expect((await service.confirmPackagesForUser(user, [generated.id])).confirmed.some((item) => item.id === generated.id)).toBe(true);
  });
});

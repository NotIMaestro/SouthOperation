import { describe, expect, it, vi } from "vitest";
import data from "./mock-transports.json";
import collection from "@/lib/pickup/mock-collection.json";
import { createMockTransportService } from "./mock-service";
import { TRANSPORTS_KEY, emptyDeliveryFilters, manifestSchema, transportSchema, type DeliveryFilters, type TransportDraft } from "./types";

const user = "user-001";
function setup() {
  const memory = new Map<string, string>();
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: vi.fn((key: string, value: string) => { memory.set(key, value); }), removeItem: (key: string) => { memory.delete(key); } };
  const seed = { transports: data.transports.map((entry) => transportSchema.parse(entry)), packages: data.packages.map((entry) => manifestSchema.parse(entry)) };
  const base = collection.packages.map((entry) => manifestSchema.parse(entry));
  const options = { seed, storage: () => storage, source: async () => structuredClone(base), delayMs: 0, now: () => "2026-09-23T22:30:00Z" };
  return { service: createMockTransportService(options), options, storage, memory, seed, base };
}
const draft: TransportDraft = {
  createdBy: "יוצר הדגמה", sourceCity: "עיר בדיונית א", sourceUnit: "מוצא לדוגמה", sourceBuilding: "מבנה א", sourceRoom: "1",
  destinationCity: "עיר בדיונית ב", destinationUnit: "יעד לדוגמה", destinationBuilding: "מבנה ב", destinationRoom: "2",
  date: "2026-09-25T11:00", packageCount: 2, packageSummary: "פריט משרדי לדוגמה",
};
describe("shared transportation and receiving repository", () => {
  it("preserves transport identities and nested package/product relationships", async () => {
    const { service, seed, base } = setup();
    expect(seed.transports.map((entry) => entry.id)).toEqual(expect.arrayContaining(["TR-024", "TR-023", "TR-022"]));
    const packages = [...base, ...seed.packages];
    const used = seed.transports.flatMap((entry) => entry.packageIds);
    expect(new Set(used).size).toBe(used.length);
    for (const entry of seed.transports) {
      expect(entry.packageIds.length).toBeGreaterThanOrEqual(2);
      entry.packageIds.forEach((id) => expect(packages.find((pack) => pack.id === id)?.products.length).toBeGreaterThanOrEqual(2));
    }
    const result = await service.searchDeliveriesForUser(user, emptyDeliveryFilters);
    expect(result.pending).toHaveLength(6); expect(result.confirmed).toHaveLength(3);
    const details = await service.getDeliveryWithPackages(user, "TR-025");
    expect(details.packageIds).toEqual(["mock-001", "mock-002"]);
    expect(details.packages[0].products).toEqual(collection.packages[0].products);
  });
  it.each([
    [{ date: "2026-09-23" }, ["TR-025", "TR-026"]],
    [{ deliveryNumber: " tr-02 " }, ["TR-025", "TR-026", "TR-027", "TR-028", "TR-029"]],
    [{ packageNumber: " 100001 " }, ["TR-025"]],
    [{ packageNumber: "001" }, ["TR-025", "TR-027", "TR-028", "TR-029", "TR-030"]],
    [{ date: "2026-09-23", deliveryNumber: "TR-02", packageNumber: "100003" }, ["TR-026"]],
    [{ date: "2026-09-24", deliveryNumber: "TR-025", packageNumber: "100001" }, []],
    [{ packageNumber: "100008" }, []],
    [{ deliveryNumber: "TR-033" }, []],
  ])("filters pending with AND and keeps confirmed unchanged: %j", async (filters, expected) => {
    const result = await setup().service.searchDeliveriesForUser(user, { ...emptyDeliveryFilters, ...filters } as DeliveryFilters);
    expect(result.pending.map((entry) => entry.id)).toEqual(expected);
    expect(result.pendingTotal).toBe(6); expect(result.confirmed).toHaveLength(3);
  });
  it("clears filtering without changing the underlying pending list", async () => {
    const { service } = setup();
    await service.searchDeliveriesForUser(user, { ...emptyDeliveryFilters, deliveryNumber: "missing" });
    expect((await service.searchDeliveriesForUser(user, emptyDeliveryFilters)).pending).toHaveLength(6);
  });
  it("rejects malformed filters and treats HTML as text", async () => {
    const { service } = setup();
    await expect(service.searchDeliveriesForUser(user, { ...emptyDeliveryFilters, date: "2026-02-30" })).rejects.toThrow();
    await expect(service.searchDeliveriesForUser(user, { ...emptyDeliveryFilters, deliveryNumber: "a".repeat(41) })).rejects.toThrow();
    expect((await service.searchDeliveriesForUser(user, { ...emptyDeliveryFilters, deliveryNumber: "<script>" })).pending).toHaveLength(0);
  });
  it("refuses identity spoofing for reads, details, confirms, creation and status updates", async () => {
    const { service } = setup();
    const results = await Promise.allSettled([
      service.getTransportsForUser("user-002"), service.getPendingDeliveriesForUser("user-002"), service.getConfirmedDeliveriesForUser("user-002"),
      service.searchDeliveriesForUser("user-002", emptyDeliveryFilters), service.getDeliveryWithPackages("user-002", "TR-033"),
      service.confirmDeliveriesForUser("user-002", ["TR-033"]), service.createTransport("user-002", draft),
      service.updateTransportStatus("user-002", "TR-024", "transit", "רכב", "דוגמה"),
    ]);
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect((await service.getTransportsForUser(user)).some((entry) => entry.id === "TR-033")).toBe(false);
  });
  it.each(["TR-033", "TR-999"])("does not expose details of an unavailable delivery: %s", async (id) => {
    await expect(setup().service.getDeliveryWithPackages(user, id)).rejects.toThrow("ההובלה אינה זמינה למשתמש הנוכחי.");
  });
  it("confirms a batch atomically with timestamps, restores it after refresh and shares it with transportation", async () => {
    const { service, options, storage } = setup(); const original = JSON.stringify(data);
    const result = await service.confirmDeliveriesForUser(user, ["TR-025", "TR-026"]);
    expect(result.pending).toHaveLength(4); expect(result.confirmed).toHaveLength(5);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    const restored = createMockTransportService(options);
    expect(await restored.searchDeliveriesForUser(user, emptyDeliveryFilters)).toEqual(result);
    expect((await restored.getTransportsForUser(user)).find((entry) => entry.id === "TR-025")).toMatchObject({
      status: "arrived", receiptStatus: "RECEIVED_CONFIRMED", confirmedByUserId: user, confirmedAt: options.now(), actualDeliveryDate: "2026-09-23",
    });
    expect(JSON.stringify(data)).toBe(original);
  });
  it.each([[[]], [["TR-025", "TR-025"]], [["TR-025", "TR-033"]], [["TR-025", "TR-999"]], [["TR-025", "TR-022"]], [["TR-025", "TR-023"]]])("rejects invalid batches without partial writes: %j", async (ids) => {
    const { service, storage } = setup();
    await expect(service.confirmDeliveriesForUser(user, ids)).rejects.toThrow();
    expect(storage.setItem).not.toHaveBeenCalled(); expect(await service.getPendingDeliveriesForUser(user)).toHaveLength(6);
  });
  it("prevents duplicate confirmations across service instances", async () => {
    const { service, options, storage } = setup();
    const second = createMockTransportService(options);
    const results = await Promise.allSettled([service.confirmDeliveriesForUser(user, ["TR-025"]), second.confirmDeliveriesForUser(user, ["TR-025"])]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1); expect(storage.setItem).toHaveBeenCalledTimes(1);
    await expect(service.confirmDeliveriesForUser(user, ["TR-025"])).rejects.toThrow("כבר אושרה");
  });
  it("fails clearly on missing references and does not partially confirm", async () => {
    const { service, seed, storage } = setup();
    seed.transports.find((entry) => entry.id === "TR-026")!.packageIds = ["missing"];
    await expect(service.getDeliveryWithPackages(user, "TR-026")).rejects.toThrow("חסרים פרטי חבילה");
    await expect(service.confirmDeliveriesForUser(user, ["TR-025", "TR-026"])).rejects.toThrow("חסרים פרטי חבילה");
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("does not expose another receiver's package through a manipulated relationship", async () => {
    const { service, seed } = setup(); seed.transports.find((entry) => entry.id === "TR-025")!.packageIds = ["mock-008"];
    await expect(service.getDeliveryWithPackages(user, "TR-025")).rejects.toThrow("אינה זמינה למשתמש");
    await expect(service.confirmDeliveriesForUser(user, ["TR-025"])).rejects.toThrow("אינה זמינה למשתמש");
  });
  it("retains pending status if localStorage saving fails", async () => {
    const { service, storage } = setup(); storage.setItem.mockImplementation(() => { throw new Error("Quota"); });
    await expect(service.confirmDeliveriesForUser(user, ["TR-025"])).rejects.toThrow("שגיאה בשמירת");
    expect(await service.getPendingDeliveriesForUser(user)).toHaveLength(6);
  });
  it("creates, transports and receives the same record and packages", async () => {
    const { service, options } = setup(); const created = await service.createTransport(user, draft);
    expect(created.packageCount).toBe(2); expect(created.status).toBe("waiting");
    await expect(service.updateTransportStatus(user, created.id, "arrived", "רכב", "דוגמה")).rejects.toThrow("סדר השלבים");
    await expect(service.updateTransportStatus(user, created.id, "transit", "", "")).rejects.toThrow("סוג רכב");
    await service.updateTransportStatus(user, created.id, "transit", "משאית", "רכב הדגמה");
    await service.updateTransportStatus(user, created.id, "arrived", "משאית", "רכב הדגמה");
    const details = await createMockTransportService(options).getDeliveryWithPackages(user, created.id);
    expect(details.packages).toHaveLength(2); expect(details.actualDeliveryDate).toBe("2026-09-24");
    expect(details.receiptStatus).toBe("AWAITING_RECEIPT_CONFIRMATION");
    await service.confirmDeliveriesForUser(user, [created.id]);
    await expect(service.updateTransportStatus(user, created.id, "transit", "משאית", "דוגמה")).rejects.toThrow("כבר הגיעה");
  });
  it("validates creation dates and package counts", async () => {
    const { service } = setup();
    await expect(service.createTransport(user, { ...draft, date: "2026-09-25T99:00" })).rejects.toThrow();
    await expect(service.createTransport(user, { ...draft, packageCount: -1 })).rejects.toThrow();
  });
  it("recovers corrupted transport storage without changing pickup confirmations", async () => {
    const { service, memory } = setup(); memory.set(TRANSPORTS_KEY, "bad"); memory.set("south-operation.pickup-confirmations.v1", "keep");
    await expect(service.getTransportsForUser(user)).rejects.toThrow("לא ניתן לקרוא"); await service.resetDemo();
    expect(await service.getPendingDeliveriesForUser(user)).toHaveLength(6);
    expect(memory.get("south-operation.pickup-confirmations.v1")).toBe("keep");
  });
});

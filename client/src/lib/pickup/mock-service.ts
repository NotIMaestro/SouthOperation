import { z } from "zod";
import { getAllPackages } from "@/lib/packages/service";
import { PackageServiceError, packageNumberSchema, type PackageRecord } from "@/lib/packages/types";
import data from "./mock-collection.json";
import { getCurrentUser } from "./current-user";
import { COLLECTION_CHANGED, CONFIRMATIONS_KEY, collectionPackageSchema, scannedValueSchema, type CollectionPackage, type CollectionService, type CollectionSnapshot } from "./types";

export { CONFIRMATIONS_KEY } from "./types";
const seed = z.array(collectionPackageSchema).parse(data.packages);
const confirmationsSchema = z.array(z.object({
  id: z.string().min(1).max(100), confirmedAt: z.iso.datetime(), confirmedByUserId: z.string().min(1),
}).strict()).max(1100);
type Confirmations = z.infer<typeof confirmationsSchema>;
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createMockCollectionService(options: {
  storage?: () => StorageLike; source?: () => Promise<PackageRecord[]>; delayMs?: number; now?: () => string;
} = {}): CollectionService {
  const source = options.source ?? getAllPackages;
  const storage = options.storage ?? (() => window.localStorage);
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, options.delayMs ?? 220));
  const identity = (userId: string) => {
    if (userId !== getCurrentUser().id) throw new PackageServiceError("החבילה אינה זמינה לאישור.");
    return getCurrentUser().id;
  };
  const read = (): Confirmations => {
    try {
      const raw = storage().getItem(CONFIRMATIONS_KEY);
      const entries = confirmationsSchema.parse(raw ? JSON.parse(raw) : []);
      if (new Set(entries.map((item) => item.id)).size !== entries.length) throw new Error("Duplicate confirmation");
      return entries;
    } catch { throw new PackageServiceError("לא ניתן לקרוא את האישורים השמורים. אפשרו אחסון בדפדפן או אפסו את אישורי ההדגמה באזור הפיתוח."); }
  };
  const notify = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(COLLECTION_CHANGED)); };
  async function assigned(userId: string): Promise<CollectionPackage[]> {
    const currentId = identity(userId);
    await wait();
    // Canonical identifiers come from the existing package repository/generator.
    // Fixed demo assignments take precedence; newly generated demo packages are
    // projected as arrived for the current demo user, with one of each item.
    const canonical = await source();
    const known = new Set(seed.map((item) => item.id));
    const generated = canonical.filter((item) => !known.has(item.id)).map((item): CollectionPackage => ({
      id: item.id, packageNumber: item.packageNumber, qrToken: item.qrToken,
      barcodeValue: `729000${item.packageNumber}0`, assignedUserId: currentId,
      description: item.description, origin: item.origin, destination: item.destination,
      status: "AWAITING_USER_CONFIRMATION", arrivedAt: item.createdAt, confirmedAt: null, confirmedByUserId: null,
      products: item.contents.map((name, index) => ({ id: `${item.id}-product-${index}`, name, quantity: 1 })),
    }));
    return structuredClone([...seed, ...generated].filter((item) => item.assignedUserId === currentId));
  }
  function snapshot(packages: CollectionPackage[], changes: Confirmations): CollectionSnapshot {
    const records = packages.map((item): CollectionPackage => {
      const confirmation = changes.find((entry) => entry.id === item.id && entry.confirmedByUserId === item.assignedUserId);
      return confirmation && item.status === "AWAITING_USER_CONFIRMATION"
        ? { ...item, ...confirmation, status: "CONFIRMED_RECEIVED" } : item;
    });
    return {
      pending: records.filter((item) => item.status === "AWAITING_USER_CONFIRMATION"),
      confirmed: records.filter((item) => item.status === "CONFIRMED_RECEIVED")
        .sort((a, b) => (b.confirmedAt ?? "").localeCompare(a.confirmedAt ?? "")),
    };
  }
  async function getPackagesForUser(userId: string) { return snapshot(await assigned(userId), read()); }
  async function find(userId: string, field: "packageNumber" | "qrToken" | "barcodeValue", value: string) {
    const { pending, confirmed } = await getPackagesForUser(userId);
    return [...pending, ...confirmed].find((item) => item[field] === value) ?? null;
  }
  async function locked<T>(action: () => T): Promise<T> {
    if (typeof window !== "undefined" && typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request(CONFIRMATIONS_KEY, action);
    return action(); // No await inside the read/validate/write transaction.
  }
  return {
    getPackagesForUser,
    async getPendingPackagesForUser(userId) { return (await getPackagesForUser(userId)).pending; },
    async getConfirmedPackagesForUser(userId) { return (await getPackagesForUser(userId)).confirmed; },
    async findPackageForUserByScannedValue(userId, value) {
      identity(userId);
      const parsed = scannedValueSchema.parse(value);
      return find(userId, parsed.startsWith("PKG:") ? "qrToken" : "barcodeValue", parsed);
    },
    async findPackageForUserByPackageNumber(userId, number) {
      identity(userId);
      return find(userId, "packageNumber", packageNumberSchema.parse(number));
    },
    async confirmPackagesForUser(userId, ids) {
      identity(userId);
      if (!Array.isArray(ids) || !ids.length || ids.length > 1100 || ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length) {
        throw new PackageServiceError("בחרו חבילות תקינות לאישור.");
      }
      const requested = [...ids];
      const packages = await assigned(userId);
      return locked(() => {
        const changes = read();
        const state = snapshot(packages, changes);
        // Validate the entire batch before writing anything (including ownership).
        for (const id of requested) {
          if (!packages.some((item) => item.id === id)) throw new PackageServiceError("החבילה אינה זמינה לאישור.");
          if (state.confirmed.some((item) => item.id === id)) throw new PackageServiceError("החבילה כבר אושרה בעבר.");
        }
        const confirmedAt = options.now?.() ?? new Date().toISOString();
        const next = [...changes, ...requested.map((id) => ({ id, confirmedAt, confirmedByUserId: getCurrentUser().id }))];
        try { storage().setItem(CONFIRMATIONS_KEY, JSON.stringify(confirmationsSchema.parse(next))); }
        catch { throw new PackageServiceError("האישור לא נשמר. בדקו שהאחסון בדפדפן זמין ונסו שוב."); }
        notify();
        return snapshot(packages, next);
      });
    },
    async resetConfirmations() {
      if (process.env.NODE_ENV === "production") throw new PackageServiceError("איפוס אישורי הדגמה זמין בסביבת פיתוח בלבד.");
      await wait();
      await locked(() => {
        try { storage().removeItem(CONFIRMATIONS_KEY); }
        catch { throw new PackageServiceError("לא ניתן לאפס את אישורי ההדגמה בדפדפן."); }
        notify();
      });
    },
  };
}

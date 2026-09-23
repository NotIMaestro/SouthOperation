import { z } from "zod";
import data from "./mock-transports.json";
import { getCurrentUser } from "@/lib/pickup/current-user";
import { getPackageManifests } from "@/lib/packages/manifests";
import {
  TRANSPORTS_CHANGED, TRANSPORTS_KEY, TransportServiceError, deliveryDate, emptyDeliveryFilters,
  filterSchema, manifestSchema, transportDraftSchema, transportSchema, transportStatusLabels,
  type DeliveryFilters, type PackageManifest, type ReceivingSnapshot, type TransportItem, type TransportRecord, type TransportService,
} from "./types";

const stateSchema = z.object({ records: z.array(transportSchema).max(1000), packages: z.array(manifestSchema).max(3000) });
type State = z.infer<typeof stateSchema>;
type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const unique = <T>(items: T[], key: (item: T) => string) => new Set(items.map(key)).size === items.length;
function item(record: TransportRecord): TransportItem {
  return { ...record, route: `${record.sourceCity} > ${record.destinationCity}`, packageCount: record.packageIds.length, statusLabel: transportStatusLabels[record.status] };
}

/** Shared by transportation and receiving. Mutations re-read under the same lock. */
export function createMockTransportService(options: {
  storage?: () => StoragePort; source?: () => Promise<PackageManifest[]>; delayMs?: number; now?: () => string;
  seed?: { transports: TransportRecord[]; packages: PackageManifest[] };
} = {}): TransportService {
  const seed = options.seed ?? { transports: z.array(transportSchema).parse(data.transports), packages: z.array(manifestSchema).parse(data.packages) };
  const storage = options.storage ?? (() => window.localStorage);
  const source = options.source ?? getPackageManifests;
  const now = options.now ?? (() => new Date().toISOString());
  const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now()));
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, options.delayMs ?? 220));
  function identity(userId: string) {
    if (userId !== getCurrentUser().id) throw new TransportServiceError("ההובלה אינה זמינה למשתמש הנוכחי.");
  }
  function read(): State {
    try {
      const raw = storage().getItem(TRANSPORTS_KEY);
      const state = stateSchema.parse(raw ? JSON.parse(raw) : { records: [], packages: [] });
      if (!unique(state.records, (entry) => entry.id) || !unique(state.packages, (entry) => entry.id)) throw new Error("Duplicates");
      // An override cannot reassign a fixed transport to another receiver.
      if (state.records.some((entry) => {
        const original = seed.transports.find((candidate) => candidate.id === entry.id);
        return original && (original.assignedReceiverUserId !== entry.assignedReceiverUserId || original.packageIds.join() !== entry.packageIds.join());
      })) throw new Error("Invalid override");
      return state;
    } catch { throw new TransportServiceError("לא ניתן לקרוא את נתוני ההובלות השמורים. אפשרו אחסון בדפדפן או אפסו את נתוני ההדגמה באזור הפיתוח."); }
  }
  function all(state: State) {
    return structuredClone([...state.records, ...seed.transports.filter((entry) => !state.records.some((saved) => saved.id === entry.id))]);
  }
  function owned(state: State, userId: string) { identity(userId); return all(state).filter((entry) => entry.assignedReceiverUserId === userId); }
  function get(state: State, userId: string, id: string) {
    identity(userId);
    const record = owned(state, userId).find((entry) => entry.id === id);
    if (!record) throw new TransportServiceError("ההובלה אינה זמינה למשתמש הנוכחי.");
    return record;
  }
  function packages(state: State, base: PackageManifest[]) {
    const result = [...base, ...seed.packages, ...state.packages];
    if (!unique(result, (entry) => entry.id) || !unique(result, (entry) => entry.packageNumber)) throw new TransportServiceError("נמצאו מזהי חבילות כפולים בנתוני ההובלות.");
    return result;
  }
  function resolve(record: TransportRecord, available: PackageManifest[]) {
    return record.packageIds.map((id) => {
      const found = available.find((entry) => entry.id === id);
      if (!found) throw new TransportServiceError(`חסרים פרטי חבילה בהובלה ${record.id}. לא ניתן לאשר את ההובלה עד להשלמת הנתונים.`);
      if (found.assignedUserId !== record.assignedReceiverUserId) throw new TransportServiceError("אחת החבילות אינה זמינה למשתמש הנוכחי. ההובלה לא אושרה.");
      return structuredClone(found);
    });
  }
  function snapshot(state: State, userId: string, filters: DeliveryFilters, base: PackageManifest[]): ReceivingSnapshot {
    const scoped = owned(state, userId);
    const pending = scoped.filter((entry) => entry.receiptStatus === "AWAITING_RECEIPT_CONFIRMATION");
    const available = packages(state, base);
    return {
      pending: pending.filter((entry) => (!filters.date || deliveryDate(entry) === filters.date)
        && entry.id.toLowerCase().includes(filters.deliveryNumber.toLowerCase())
        && (!filters.packageNumber || resolve(entry, available).some((pack) => pack.packageNumber.toLowerCase().includes(filters.packageNumber.toLowerCase())))).map(item),
      confirmed: scoped.filter((entry) => entry.receiptStatus === "RECEIVED_CONFIRMED")
        .sort((a, b) => (b.confirmedAt ?? "").localeCompare(a.confirmedAt ?? "")).map(item),
      pendingTotal: pending.length,
    };
  }
  function write(state: State) {
    try { storage().setItem(TRANSPORTS_KEY, JSON.stringify(stateSchema.parse(state))); }
    catch { throw new TransportServiceError("אירעה שגיאה בשמירת ההובלה. בדקו שהאחסון בדפדפן זמין ונסו שוב."); }
    if (typeof window !== "undefined") window.dispatchEvent(new Event(TRANSPORTS_CHANGED));
  }
  async function locked<T>(action: () => T): Promise<T> {
    if (typeof window !== "undefined" && navigator.locks) return navigator.locks.request(TRANSPORTS_KEY, action);
    return action();
  }
  function replace(state: State, records: TransportRecord[]): State {
    return { ...state, records: [...state.records.filter((entry) => !records.some((record) => record.id === entry.id)), ...records] };
  }
  async function searchDeliveriesForUser(userId: string, raw: DeliveryFilters) {
    identity(userId); const filters = filterSchema.parse(raw); await wait();
    const base = await source(); return snapshot(read(), userId, filters, base);
  }
  return {
    async getTransportsForUser(userId) { identity(userId); await wait(); return owned(read(), userId).map(item); },
    async getPendingDeliveriesForUser(userId) { return (await searchDeliveriesForUser(userId, emptyDeliveryFilters)).pending; },
    async getConfirmedDeliveriesForUser(userId) { return (await searchDeliveriesForUser(userId, emptyDeliveryFilters)).confirmed; },
    searchDeliveriesForUser,
    async getDeliveryWithPackages(userId, id) {
      identity(userId); await wait(); const base = await source(); const state = read(); const record = get(state, userId, id);
      return { ...item(record), packages: resolve(record, packages(state, base)) };
    },
    async confirmDeliveriesForUser(userId, ids, rawFilters = emptyDeliveryFilters) {
      identity(userId); const filters = filterSchema.parse(rawFilters);
      if (!Array.isArray(ids) || !ids.length || ids.length > 1000 || !unique(ids, (id) => id) || ids.some((id) => typeof id !== "string")) throw new TransportServiceError("בחרו הובלות תקינות לאישור.");
      const requested = [...ids]; await wait(); const base = await source();
      return locked(() => {
        const state = read(); const available = packages(state, base);
        const records = requested.map((id) => {
          const record = get(state, userId, id);
          if (record.receiptStatus === "RECEIVED_CONFIRMED") throw new TransportServiceError("ההובלה כבר אושרה בעבר.");
          if (record.status !== "arrived" || record.receiptStatus !== "AWAITING_RECEIPT_CONFIRMATION") throw new TransportServiceError("ההובלה עדיין אינה זמינה לאישור קבלה.");
          resolve(record, available); return record;
        });
        const confirmedAt = now();
        const next = replace(state, records.map((record) => ({ ...record, receiptStatus: "RECEIVED_CONFIRMED", confirmedAt, confirmedByUserId: getCurrentUser().id, actualDeliveryDate: record.actualDeliveryDate ?? today() })));
        const result = snapshot(next, userId, filters, base);
        write(next); return result;
      });
    },
    async updateTransportStatus(userId, id, status, vehicleType, vehicleNumber) {
      identity(userId); await wait();
      return locked(() => {
        const state = read(); const record = get(state, userId, id);
        if (record.status === "arrived") throw new TransportServiceError("לא ניתן לשנות הובלה שכבר הגיעה ליעד.");
        if (!((record.status === "waiting" && (status === "waiting" || status === "transit")) || (record.status === "transit" && (status === "transit" || status === "arrived")))) throw new TransportServiceError("יש לעדכן את ההובלה לפי סדר השלבים.");
        if (status !== "waiting" && (!vehicleType.trim() || !vehicleNumber.trim())) throw new TransportServiceError("יש למלא סוג רכב ומספר רכב.");
        const updated = transportSchema.parse({ ...record, status, vehicleType: vehicleType.trim() || undefined, vehicleNumber: vehicleNumber.trim() || undefined,
          receiptStatus: status === "arrived" ? "AWAITING_RECEIPT_CONFIRMATION" : "NOT_READY", actualDeliveryDate: status === "arrived" ? today() : null });
        write(replace(state, [updated])); return item(updated);
      });
    },
    async createTransport(userId, raw) {
      identity(userId); const draft = transportDraftSchema.parse(raw); await wait(); const base = await source();
      return locked(() => {
        const state = read(); const existing = all(state); const available = packages(state, base);
        const nextNumber = Math.max(24, ...existing.map((entry) => Number(entry.id.slice(3)))) + 1;
        const id = `TR-${String(nextNumber).padStart(3, "0")}`;
        let packageNumber = Math.max(100000, ...available.map((entry) => Number(entry.packageNumber))) + 1;
        if (packageNumber + draft.packageCount - 1 > 999999) throw new TransportServiceError("לא נותרו מספרי חבילות זמינים להדגמה.");
        const created = Array.from({ length: draft.packageCount }, (_, index): PackageManifest => ({
          id: `${id}-package-${index + 1}`, packageNumber: String(packageNumber++), description: `חבילת הדגמה ${index + 1}: ${draft.packageSummary}`.slice(0, 160), assignedUserId: userId,
          products: [{ id: `${id}-product-${index + 1}`, name: draft.packageSummary, quantity: 1 }],
        }));
        const record = transportSchema.parse({ ...draft, id, title: "הובלה חדשה", packageIds: created.map((pack) => pack.id), status: "waiting", receiptStatus: "NOT_READY", assignedReceiverUserId: userId, confirmedAt: null, confirmedByUserId: null, actualDeliveryDate: null });
        write({ records: [...state.records, record], packages: [...state.packages, ...created] }); return item(record);
      });
    },
    async resetDemo() {
      if (process.env.NODE_ENV === "production") throw new TransportServiceError("איפוס נתוני ההדגמה זמין בפיתוח בלבד.");
      await wait(); await locked(() => {
        try { storage().removeItem(TRANSPORTS_KEY); }
        catch { throw new TransportServiceError("לא ניתן לאפס את נתוני ההובלות."); }
        if (typeof window !== "undefined") window.dispatchEvent(new Event(TRANSPORTS_CHANGED));
      });
    },
  };
}

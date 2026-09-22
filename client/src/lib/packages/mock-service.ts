import { z } from "zod";
import seed from "./mock-packages.json";
import {
  packageDraftSchema, packageNumberSchema, packageSchema, PackageServiceError, qrTokenSchema,
  type PackageRecord, type PackageService,
} from "./types";

export const GENERATED_PACKAGES_KEY = "south-operation.demo-packages.v1";
type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Identifiers = Pick<PackageRecord, "id" | "packageNumber" | "qrToken">;

function unique(records: PackageRecord[]) {
  return (["id", "packageNumber", "qrToken"] as const).every((key) => new Set(records.map((p) => p[key])).size === records.length);
}
const staticPackages = z.array(packageSchema).parse(seed);
if (!unique(staticPackages)) throw new Error("Static demo package identifiers must be unique.");

function randomIdentifiers(): Identifiers {
  return {
    id: crypto.randomUUID(),
    packageNumber: String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000),
    qrToken: `PKG:${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
  };
}

/** Browser-only persistence is resolved lazily, never during server rendering. */
export function createMockPackageService(options: {
  storage?: () => StoragePort;
  delayMs?: number;
  identifiers?: () => Identifiers;
} = {}): PackageService {
  const storage = options.storage ?? (() => window.localStorage);
  const delay = () => new Promise<void>((resolve) => setTimeout(resolve, options.delayMs ?? 350));
  const identifiers = options.identifiers ?? randomIdentifiers;

  function read(): PackageRecord[] {
    try {
      const raw = storage().getItem(GENERATED_PACKAGES_KEY);
      const generated = raw ? z.array(packageSchema).max(1000).parse(JSON.parse(raw)) : [];
      if (!unique([...generated, ...staticPackages])) throw new Error("Duplicate stored identifiers");
      return generated;
    } catch {
      throw new PackageServiceError("Local demo storage is unavailable or damaged. Enable browser storage, or reset locally generated packages in the generator.");
    }
  }
  function all() { return [...read(), ...structuredClone(staticPackages)]; }

  // Web Locks serialize read/check/write across tabs. The fallback has no async gap
  // in its critical section and guarantees uniqueness in this application session.
  async function writeLocked<T>(action: () => T): Promise<T> {
    if (typeof window !== "undefined" && navigator.locks) {
      return navigator.locks.request(GENERATED_PACKAGES_KEY, action);
    }
    return action();
  }

  return {
    async getAllPackages() { await delay(); return all(); },
    async findPackageByQrToken(value) {
      const token = qrTokenSchema.parse(value);
      await delay();
      return all().find((p) => p.qrToken === token) ?? null;
    },
    async findPackageByPackageNumber(value) {
      const number = packageNumberSchema.parse(value);
      await delay();
      return all().find((p) => p.packageNumber === number) ?? null;
    },
    async generatePackage(input) {
      const draft = packageDraftSchema.parse(input);
      await delay();
      return writeLocked(() => {
        const generated = read();
        if (generated.length >= 1000) throw new PackageServiceError("Demo storage is full. Reset locally generated packages before creating more.");
        const existing = [...generated, ...staticPackages];
        for (let attempt = 0; attempt < 40; attempt++) {
          const ids = identifiers();
          if (existing.some((p) => p.id === ids.id || p.packageNumber === ids.packageNumber || p.qrToken === ids.qrToken)) continue;
          const now = new Date().toISOString();
          const record = packageSchema.parse({ ...draft, ...ids, createdAt: now, updatedAt: now });
          try { storage().setItem(GENERATED_PACKAGES_KEY, JSON.stringify([...generated, record])); }
          catch { throw new PackageServiceError("Could not save this demo package. Browser storage may be full or disabled. No package was created."); }
          return record;
        }
        throw new PackageServiceError("Could not generate unique identifiers. Please try again.");
      });
    },
    async resetGeneratedPackages() {
      await delay();
      await writeLocked(() => {
        try { storage().removeItem(GENERATED_PACKAGES_KEY); }
        catch { throw new PackageServiceError("Could not reset local demo storage. Check browser storage permissions and retry."); }
      });
    },
  };
}

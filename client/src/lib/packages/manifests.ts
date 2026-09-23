import collectionSeed from "@/lib/pickup/mock-collection.json";
import { getCurrentUser } from "@/lib/pickup/current-user";
import { getAllPackages } from "./service";
import type { PackageManifest } from "@/lib/transports/types";

/** Read existing package identities and product quantities without reading or
 * changing package-collection confirmation state. */
export async function getPackageManifests(): Promise<PackageManifest[]> {
  return (await getAllPackages()).map((item) => {
    const seed = collectionSeed.packages.find((record) => record.id === item.id);
    return {
      id: item.id, packageNumber: item.packageNumber, description: item.description,
      assignedUserId: seed?.assignedUserId ?? getCurrentUser().id,
      products: seed ? structuredClone(seed.products) : item.contents.map((name, index) => ({ id: `${item.id}-${index}`, name, quantity: 1 })),
    };
  });
}

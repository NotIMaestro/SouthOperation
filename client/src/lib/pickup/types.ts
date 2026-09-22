import { z } from "zod";
import { packageNumberSchema, qrTokenSchema } from "@/lib/packages/types";

export const CONFIRMATIONS_KEY = "south-operation.pickup-confirmations.v1";
export const COLLECTION_CHANGED = "south-operation:pickup-changed";

// Code 128 labels use a separate namespace from the six-digit manual number.
export const barcodeValueSchema = z.string().trim().regex(/^729000[1-9][0-9]{5}0$/, "ערך הברקוד אינו תקין.");
export const scannedValueSchema = z.string().trim().refine(
  (value) => qrTokenSchema.safeParse(value).success || barcodeValueSchema.safeParse(value).success,
  "הקוד אינו תקין. סרקו קוד QR של חבילה או ברקוד מתווית החבילה.",
);
export const collectionPackageSchema = z.object({
  id: z.string().min(1), packageNumber: packageNumberSchema, qrToken: qrTokenSchema,
  barcodeValue: barcodeValueSchema, assignedUserId: z.string().min(1),
  description: z.string().min(1), origin: z.string().min(1), destination: z.string().min(1),
  status: z.enum(["AWAITING_USER_CONFIRMATION", "CONFIRMED_RECEIVED"]),
  products: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), quantity: z.number().int().positive() })).min(1),
  arrivedAt: z.iso.datetime(), confirmedAt: z.iso.datetime().nullable(), confirmedByUserId: z.string().nullable(),
});
export type CollectionPackage = z.infer<typeof collectionPackageSchema>;
export type CollectionSnapshot = { pending: CollectionPackage[]; confirmed: CollectionPackage[] };
export interface CollectionService {
  getPackagesForUser(userId: string): Promise<CollectionSnapshot>;
  getPendingPackagesForUser(userId: string): Promise<CollectionPackage[]>;
  getConfirmedPackagesForUser(userId: string): Promise<CollectionPackage[]>;
  findPackageForUserByScannedValue(userId: string, value: string): Promise<CollectionPackage | null>;
  findPackageForUserByPackageNumber(userId: string, number: string): Promise<CollectionPackage | null>;
  confirmPackagesForUser(userId: string, ids: string[]): Promise<CollectionSnapshot>;
  resetConfirmations(): Promise<void>;
}

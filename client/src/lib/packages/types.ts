import { z } from "zod";

export const packageStatuses = ["CREATED", "WAITING_FOR_PICKUP", "IN_TRANSIT", "RECEIVED", "DELIVERED", "ISSUE_REPORTED"] as const;
export const statusLabels: Record<PackageStatus, string> = {
  CREATED: "Created", WAITING_FOR_PICKUP: "Waiting for pickup", IN_TRANSIT: "In transit",
  RECEIVED: "Received", DELIVERED: "Delivered", ISSUE_REPORTED: "Issue reported",
};
export type PackageStatus = typeof packageStatuses[number];
export const qrTokenSchema = z.string().trim().regex(/^PKG:[A-Z0-9]{8,32}$/, "Use a package QR containing PKG: followed by 8–32 uppercase letters or digits.");
export const packageNumberSchema = z.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter a six-digit package number, such as 100001.");
const textField = z.string().trim().min(1, "Complete all package fields.").max(160, "Use at most 160 characters per field.");
export const packageDraftSchema = z.object({
  description: textField, origin: textField, destination: textField, responsiblePerson: textField,
  status: z.enum(packageStatuses),
  contents: z.array(textField).min(1).max(30),
});
export const packageSchema = packageDraftSchema.extend({
  id: z.string().min(1).max(100), packageNumber: packageNumberSchema, qrToken: qrTokenSchema,
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
});
export type PackageRecord = z.infer<typeof packageSchema>;
export type PackageDraft = z.infer<typeof packageDraftSchema>;

/** Replace the service implementation with HTTP calls; pages depend only on this contract. */
export interface PackageService {
  findPackageByQrToken(token: string): Promise<PackageRecord | null>;
  findPackageByPackageNumber(number: string): Promise<PackageRecord | null>;
  getAllPackages(): Promise<PackageRecord[]>;
  generatePackage(draft: PackageDraft): Promise<PackageRecord>;
  resetGeneratedPackages(): Promise<void>;
}

export class PackageServiceError extends Error {}
export function packageErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Check the package fields.";
  if (error instanceof PackageServiceError) return error.message;
  return "The package service is unavailable. Please retry in a moment.";
}

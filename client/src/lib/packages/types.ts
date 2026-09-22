import { z } from "zod";

export const packageStatuses = ["CREATED", "WAITING_FOR_PICKUP", "IN_TRANSIT", "RECEIVED", "DELIVERED", "ISSUE_REPORTED"] as const;
export const statusLabels: Record<PackageStatus, string> = {
  CREATED: "נוצרה", WAITING_FOR_PICKUP: "ממתינה לאיסוף", IN_TRANSIT: "בהעברה",
  RECEIVED: "התקבלה", DELIVERED: "נמסרה", ISSUE_REPORTED: "דווחה תקלה",
};
export type PackageStatus = typeof packageStatuses[number];
export const qrTokenSchema = z.string().trim().regex(/^PKG:[A-Z0-9]{8,32}$/, "יש להשתמש בקוד QR של חבילה: הקידומת PKG: ואחריה 8–32 אותיות לטיניות גדולות או ספרות.");
export const packageNumberSchema = z.string().trim().regex(/^[1-9][0-9]{5}$/, "יש להזין מספר חבילה בן שש ספרות, למשל 100001.");
const textField = z.string({ error: "יש להזין טקסט בכל שדה." }).trim().min(1, "יש למלא את כל פרטי החבילה.").max(160, "ניתן להזין עד 160 תווים בכל שדה.");
export const packageDraftSchema = z.object({
  description: textField, origin: textField, destination: textField, responsiblePerson: textField,
  status: z.enum(packageStatuses, { error: "יש לבחור מצב חבילה תקין." }),
  contents: z.array(textField, { error: "יש להזין רשימת פריטים." }).min(1, "יש להזין לפחות פריט אחד בתכולת החבילה.").max(30, "ניתן להזין עד 30 פריטים בחבילה."),
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
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "בדקו את פרטי החבילה.";
  if (error instanceof PackageServiceError) return error.message;
  return "שירות החבילות אינו זמין כרגע. נסו שוב בעוד רגע.";
}

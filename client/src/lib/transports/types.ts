import { z } from "zod";

export const TRANSPORTS_KEY = "south-operation.transports.v1";
export const TRANSPORTS_CHANGED = "south-operation:transports-changed";
export const transportStatusLabels = { waiting: "ממתין לאיסוף", transit: "בדרך ליעד", arrived: "הגיע ליעד" };
const text = z.string().trim().min(1, "יש למלא את פרטי ההובלה.").max(160, "ניתן להזין עד 160 תווים.");
const localDateTime = z.string().refine((value) => /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) && z.iso.date().safeParse(value.slice(0, 10)).success, "יש להזין תאריך מסירה תקין.");
export const manifestSchema = z.object({
  id: text, packageNumber: z.string().regex(/^[1-9][0-9]{5}$/), description: text, assignedUserId: text,
  products: z.array(z.object({ id: text, name: text, quantity: z.number().int().positive() })).min(1),
});
export type PackageManifest = z.infer<typeof manifestSchema>;
export const transportSchema = z.object({
  id: z.string().regex(/^TR-[0-9]{3,8}$/), title: text, date: localDateTime,
  status: z.enum(["waiting", "transit", "arrived"]), createdBy: text,
  sourceCity: text, sourceUnit: text, sourceBuilding: text, sourceRoom: text,
  destinationCity: text, destinationUnit: text, destinationBuilding: text, destinationRoom: text,
  packageIds: z.array(text).min(1).max(100), packageSummary: text,
  vehicleType: text.optional(), vehicleNumber: text.optional(), assignedReceiverUserId: text,
  receiptStatus: z.enum(["NOT_READY", "AWAITING_RECEIPT_CONFIRMATION", "RECEIVED_CONFIRMED"]),
  actualDeliveryDate: z.iso.date().nullable(), confirmedAt: z.iso.datetime().nullable(), confirmedByUserId: text.nullable(),
}).refine((item) => new Set(item.packageIds).size === item.packageIds.length, "חבילה משויכת פעמיים להובלה.")
  .refine((item) => item.status === "arrived" ? item.receiptStatus !== "NOT_READY" : item.receiptStatus === "NOT_READY", "מצב ההובלה אינו תואם לקבלה.")
  .refine((item) => item.receiptStatus === "RECEIVED_CONFIRMED"
    ? !!item.confirmedAt && item.confirmedByUserId === item.assignedReceiverUserId && !!item.actualDeliveryDate
    : item.confirmedAt === null && item.confirmedByUserId === null, "פרטי האישור אינם תקינים.");
export type TransportRecord = z.infer<typeof transportSchema>;
// Extends the existing transport page model with real package relationships.
export type TransportItem = TransportRecord & { route: string; statusLabel: string; packageCount: number };
export type DeliveryDetails = TransportItem & { packages: PackageManifest[] };
export const filterSchema = z.object({
  date: z.union([z.literal(""), z.iso.date({ error: "יש להזין תאריך מסירה תקין." })]).default(""),
  deliveryNumber: z.string().trim().max(40, "מספר הזיהוי ארוך מדי.").default(""),
  packageNumber: z.string().trim().max(40, "מספר הזיהוי ארוך מדי.").default(""),
});
export type DeliveryFilters = z.infer<typeof filterSchema>;
export const emptyDeliveryFilters: DeliveryFilters = { date: "", deliveryNumber: "", packageNumber: "" };
export type ReceivingSnapshot = { pending: TransportItem[]; confirmed: TransportItem[]; pendingTotal: number };
export const transportDraftSchema = z.object({
  createdBy: text, sourceCity: text, sourceUnit: text, sourceBuilding: text, sourceRoom: text,
  destinationCity: text, destinationUnit: text, destinationBuilding: text, destinationRoom: text,
  date: localDateTime,
  packageCount: z.number().int().min(1).max(30, "ניתן להוסיף עד 30 חבילות להובלה."), packageSummary: text,
});
export type TransportDraft = z.infer<typeof transportDraftSchema>;
export interface TransportService {
  getTransportsForUser(userId: string): Promise<TransportItem[]>;
  getPendingDeliveriesForUser(userId: string): Promise<TransportItem[]>;
  getConfirmedDeliveriesForUser(userId: string): Promise<TransportItem[]>;
  searchDeliveriesForUser(userId: string, filters: DeliveryFilters): Promise<ReceivingSnapshot>;
  getDeliveryWithPackages(userId: string, id: string): Promise<DeliveryDetails>;
  confirmDeliveriesForUser(userId: string, ids: string[], filters?: DeliveryFilters): Promise<ReceivingSnapshot>;
  createTransport(userId: string, draft: TransportDraft): Promise<TransportItem>;
  updateTransportStatus(userId: string, id: string, status: TransportRecord["status"], vehicleType: string, vehicleNumber: string): Promise<TransportItem>;
  resetDemo(): Promise<void>;
}
export class TransportServiceError extends Error {}
export function transportErrorMessage(error: unknown) {
  if (error instanceof TransportServiceError) return error.message;
  if (error instanceof z.ZodError) {
    const message = error.issues[0]?.message ?? "";
    return /[\u0590-\u05FF]/.test(message) ? message : "בדקו את פרטי ההובלה ואת ערכי הסינון.";
  }
  return "שירות ההובלות אינו זמין כרגע. נסו שוב.";
}
export const deliveryDate = (item: TransportRecord) => item.actualDeliveryDate ?? item.date.slice(0, 10);
export function displayDeliveryDate(value: string) { return value.split("-").reverse().join("."); }

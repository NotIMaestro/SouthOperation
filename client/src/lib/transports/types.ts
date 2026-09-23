import type { listReceivingForGroup } from "@south-operation/server/receiving";
import { z } from "zod";

import type { Serialized } from "@/lib/api-client";

export type ReceivingSnapshot = Serialized<Awaited<ReturnType<typeof listReceivingForGroup>>>;
export type Delivery = ReceivingSnapshot["pending"][number];
export type ArrivedUnit = Delivery["units"][number];
export type ArrivedItem = ArrivedUnit["items"][number];
export type ReceiptIssue = { packingUnitItemId: string; issueType: "damaged" | "missing"; quantity: number; note?: string };
export type FilteredReceiving = ReceivingSnapshot & { pendingTotal: number };

export const filterSchema = z.object({
  date: z.union([z.literal(""), z.iso.date({ error: "יש להזין תאריך מסירה תקין." })]).default(""),
  deliveryNumber: z.string().trim().max(40, "מספר הזיהוי ארוך מדי.").default(""),
  packageNumber: z.string().trim().max(40, "מספר הזיהוי ארוך מדי.").default(""),
});
export type DeliveryFilters = z.infer<typeof filterSchema>;
export const emptyDeliveryFilters: DeliveryFilters = { date: "", deliveryNumber: "", packageNumber: "" };

export class TransportServiceError extends Error {}
export function transportErrorMessage(error: unknown) {
  if (error instanceof TransportServiceError) return error.message;
  if (error instanceof z.ZodError) {
    const message = error.issues[0]?.message ?? "";
    return /[֐-׿]/.test(message) ? message : "בדקו את ערכי הסינון.";
  }
  return "שירות ההובלות אינו זמין כרגע. נסו שוב.";
}

const israelDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" });
/** Arrival day in Israel as YYYY-MM-DD, matching the date filter's value. */
export const deliveryDate = (delivery: Delivery) => (delivery.arrivedAt ? israelDate.format(new Date(delivery.arrivedAt)) : "");
/** Damaged and missing item totals reported for a delivery at receipt. */
export function deliveryIssueTotals(delivery: Delivery) {
  const issues = delivery.units.flatMap((unit) => unit.items.flatMap((item) => item.issues));
  const total = (type: ReceiptIssue["issueType"]) => issues.filter((issue) => issue.issueType === type).reduce((sum, issue) => sum + issue.quantity, 0);
  return { damaged: total("damaged"), missing: total("missing") };
}
export function displayDeliveryDate(value: string) { return value ? value.split("-").reverse().join(".") : "—"; }

import type { listPickupForGroup } from "@south-operation/server/receiving";
import { z } from "zod";

import type { Serialized } from "@/lib/api-client";

export type CollectionSnapshot = Serialized<Awaited<ReturnType<typeof listPickupForGroup>>>;
export type CollectionPackage = CollectionSnapshot["pending"][number];

export const unitNumberSchema = z.string().trim()
  .regex(/^[0-9]{1,5}$/, "יש להזין מספר יחידת אריזה תקין, עד חמש ספרות.")
  .transform((value) => value.padStart(5, "0"));

export class PickupServiceError extends Error {}
export function pickupErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "בדקו את מספר היחידה.";
  if (error instanceof PickupServiceError) return error.message;
  return "שירות האיסוף אינו זמין כרגע. נסו שוב בעוד רגע.";
}

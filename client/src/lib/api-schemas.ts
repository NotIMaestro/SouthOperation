import { z } from "zod";

export const uuidSchema = z.uuid();

export const createGroupSchema = z
  .object({
    groupCodeId: z.uuid(),
    name: z.string().trim().min(1).max(160),
    contactName: z.string().trim().min(1).max(160).optional(),
    contactPhone: z.string().trim().min(5).max(32).optional(),
  })
  .strict();

export const createRoomSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).optional(),
    locationId: z.uuid().optional(),
    managerName: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

export const createReportSchema = z
  .object({
    groupId: z.uuid(),
    roomId: z.uuid(),
    subcategoryId: z.uuid(),
    quantity: z.number().int().nonnegative().max(1_000_000),
    serialNumber: z.string().trim().min(1).max(160).optional(),
    notes: z.string().trim().max(4000).optional(),
    purpose: z.string().trim().max(2000).optional(),
    target: z.string().trim().max(2000).optional(),
    expiresAt: z.iso.datetime().transform((value) => new Date(value)).optional(),
  })
  .strict()
  .refine((input) => !input.serialNumber || input.quantity === 1, {
    message: "A serialized report must have quantity 1.",
    path: ["quantity"],
  });

const packingUnitTypeSchema = z.enum([
  "professional_carton",
  "personal_carton",
  "pallet",
  "dolav",
  "bulk",
]);

export const createPackingUnitSchema = z.object({ unitType: packingUnitTypeSchema }).strict();

export const setPackingUnitItemsSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            mappingReportId: z.uuid(),
            quantity: z.number().int().positive().max(1_000_000),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();

export const closePackingUnitSchema = z
  .object({
    destinationBuilding: z.string().trim().min(1).max(160),
    destinationFloor: z.string().trim().min(1).max(60).optional(),
    destinationRoom: z.string().trim().min(1).max(160),
  })
  .strict();

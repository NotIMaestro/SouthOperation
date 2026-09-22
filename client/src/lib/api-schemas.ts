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

export const createTransportSchema = z
  .object({
    createdByName: z.string().trim().min(1).max(160),
    sourceCity: z.string().trim().min(1).max(160),
    sourceUnit: z.string().trim().min(1).max(160),
    sourceBuilding: z.string().trim().min(1).max(160),
    sourceRoom: z.string().trim().min(1).max(160),
    destinationCity: z.string().trim().min(1).max(160),
    destinationUnit: z.string().trim().min(1).max(160),
    destinationBuilding: z.string().trim().min(1).max(160),
    destinationRoom: z.string().trim().min(1).max(160),
    packageCount: z.number().int().positive().max(10_000),
    packageSummary: z.string().trim().max(2000).optional(),
    scheduledAt: z.iso.datetime().transform((value) => new Date(value)).optional(),
  })
  .strict();

export const updateTransportStatusSchema = z
  .object({
    status: z.enum(["transit", "arrived"]),
    vehicleType: z.string().trim().min(1).max(60).optional(),
    vehicleNumber: z.string().trim().min(1).max(60).optional(),
  })
  .strict();

export const assignPackingUnitTransportSchema = z.object({ transportId: z.uuid() }).strict();

export const packingUnitNumberSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{1,5}$/, "יש להזין מספר יחידת אריזה תקין.")
  .transform((value) => value.padStart(5, "0"));

import { z } from "zod";

export const uuidSchema = z.uuid();

export const userRoleSchema = z.enum(["pending", "admin", "manager", "commander", "operator"]);
export const membershipRoleSchema = z.enum(["manager", "commander", "operator"]);

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

export const addTransportPackagesSchema = z
  .object({
    packageCount: z.number().int().positive().max(10_000),
    packageSummary: z.string().trim().min(1).max(2000),
  })
  .strict();

const uniqueIds = (max: number) =>
  z
    .array(z.uuid())
    .min(1)
    .max(max)
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate identifiers.");

export const receiptIssueSchema = z
  .object({
    packingUnitItemId: z.uuid(),
    issueType: z.enum(["damaged", "missing"]),
    quantity: z.number().int().positive().max(1_000_000),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const confirmReceiptSchema = z
  .object({
    transportIds: uniqueIds(200),
    issues: z
      .array(receiptIssueSchema)
      .max(2000)
      .refine(
        (issues) => new Set(issues.map((issue) => `${issue.packingUnitItemId}:${issue.issueType}`)).size === issues.length,
        "Each item can be reported once per issue type.",
      )
      .default([]),
  })
  .strict();

export const confirmPickupSchema = z.object({ packingUnitIds: uniqueIds(1000) }).strict();

export const assignPackingUnitTransportSchema = z.object({ transportId: z.uuid() }).strict();

export const packingUnitNumberSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{1,5}$/, "יש להזין מספר יחידת אריזה תקין.")
  .transform((value) => value.padStart(5, "0"));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

export const updateRoomSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    description: optionalText(2000),
    locationId: z.uuid().nullable().optional(),
    managerName: optionalText(160),
  })
  .strict();

export const updateRoomStatusSchema = z.object({ status: z.enum(["in_progress", "completed"]) }).strict();

export const addMembershipSchema = z
  .object({
    userId: z.uuid(),
    role: z.enum(["manager", "commander", "operator"]),
  })
  .strict();

export const createCatalogEntrySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("item_type"), name: z.string().trim().min(1).max(120) }).strict(),
  z
    .object({
      kind: z.literal("category"),
      itemTypeId: z.uuid(),
      name: z.string().trim().min(1).max(160),
      isSpecial: z.boolean().optional(),
    })
    .strict(),
  z.object({ kind: z.literal("subcategory"), categoryId: z.uuid(), name: z.string().trim().min(1).max(160) }).strict(),
]);

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", [
  "pending",
  "admin",
  "manager",
  "commander",
  "operator",
]);

export const membershipRole = pgEnum("membership_role", [
  "manager",
  "commander",
  "operator",
]);

export const roomStatus = pgEnum("room_status", [
  "unstarted",
  "in_progress",
  "completed",
  "archived",
]);

export const reportStatus = pgEnum("report_status", [
  "draft",
  "submitted",
  "approved",
  "rejected",
]);

export const outboxStatus = pgEnum("outbox_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const roomPackingStatus = pgEnum("room_packing_status", [
  "not_started",
  "in_packing",
  "paused",
  "closed",
]);

export const packingUnitType = pgEnum("packing_unit_type", [
  "professional_carton",
  "personal_carton",
  "pallet",
  "dolav",
  "bulk",
]);

export const packingUnitStatus = pgEnum("packing_unit_status", [
  "awaiting_packing",
  "packing_in_progress",
  "closed",
]);

export const transportStatus = pgEnum("transport_status", [
  "waiting",
  "transit",
  "arrived",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalSubject: varchar("external_subject", { length: 128 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    role: userRole("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_external_subject_uidx").on(table.externalSubject),
    uniqueIndex("users_email_uidx").on(table.email),
    index("users_active_role_idx").on(table.isActive, table.role),
  ],
);

export const groupCodes = pgTable(
  "group_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 32 }).notNull(),
    description: varchar("description", { length: 160 }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("group_codes_code_uidx").on(table.code),
    index("group_codes_archive_idx").on(table.archivedAt),
  ],
);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupCodeId: uuid("group_code_id")
      .notNull()
      .references(() => groupCodes.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 160 }).notNull(),
    contactName: varchar("contact_name", { length: 160 }),
    contactPhone: varchar("contact_phone", { length: 32 }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("groups_code_name_uidx").on(table.groupCodeId, table.name),
    index("groups_code_archive_idx").on(table.groupCodeId, table.archivedAt),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    role: membershipRole("role").notNull(),
    assignedBy: uuid("assigned_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.groupId] }),
    index("memberships_group_archive_idx").on(table.groupId, table.archivedAt),
    index("memberships_user_archive_idx").on(table.userId, table.archivedAt),
  ],
);

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 160 }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("locations_name_uidx").on(table.name),
    index("locations_archive_idx").on(table.archivedAt),
  ],
);

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "restrict",
    }),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    managerName: varchar("manager_name", { length: 160 }),
    status: roomStatus("status").notNull().default("unstarted"),
    packingStatus: roomPackingStatus("packing_status")
      .notNull()
      .default("not_started"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("rooms_group_name_uidx").on(table.groupId, table.name),
    index("rooms_group_archive_idx").on(table.groupId, table.archivedAt),
    index("rooms_location_idx").on(table.locationId),
    check(
      "rooms_status_timestamps_check",
      sql`(${table.status} = 'unstarted' AND ${table.startedAt} IS NULL AND ${table.completedAt} IS NULL) OR (${table.status} = 'in_progress' AND ${table.startedAt} IS NOT NULL AND ${table.completedAt} IS NULL) OR (${table.status} IN ('completed', 'archived') AND ${table.startedAt} IS NOT NULL AND ${table.completedAt} IS NOT NULL)`,
    ),
  ],
);

export const itemTypes = pgTable(
  "item_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("item_types_name_uidx").on(table.name)],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemTypeId: uuid("item_type_id").references(() => itemTypes.id, {
      onDelete: "restrict",
    }),
    name: varchar("name", { length: 160 }).notNull(),
    isSpecial: boolean("is_special").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("categories_item_type_name_uidx").on(
      table.itemTypeId,
      table.name,
    ),
    index("categories_archive_idx").on(table.archivedAt),
  ],
);

export const subcategories = pgTable(
  "subcategories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 160 }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("subcategories_category_name_uidx").on(
      table.categoryId,
      table.name,
    ),
    index("subcategories_category_archive_idx").on(
      table.categoryId,
      table.archivedAt,
    ),
  ],
);

export const mappingReports = pgTable(
  "mapping_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    subcategoryId: uuid("subcategory_id")
      .notNull()
      .references(() => subcategories.id, { onDelete: "restrict" }),
    status: reportStatus("status").notNull().default("draft"),
    quantity: integer("quantity").notNull().default(1),
    serialNumber: varchar("serial_number", { length: 160 }),
    notes: text("notes"),
    purpose: text("purpose"),
    target: text("target"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    reportedBy: uuid("reported_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("mapping_reports_serial_uidx")
      .on(table.serialNumber)
      .where(sql`${table.serialNumber} IS NOT NULL`),
    index("mapping_reports_room_archive_idx").on(table.roomId, table.archivedAt),
    index("mapping_reports_subcategory_idx").on(table.subcategoryId),
    index("mapping_reports_status_idx").on(table.status),
    check("mapping_reports_quantity_check", sql`${table.quantity} >= 0`),
    check(
      "mapping_reports_serial_quantity_check",
      sql`${table.serialNumber} IS NULL OR ${table.quantity} = 1`,
    ),
  ],
);

export const sequenceCounters = pgTable("sequence_counters", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: integer("value").notNull().default(0),
});

export const transports = pgTable(
  "transports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    transportNumber: varchar("transport_number", { length: 10 }).notNull(),
    status: transportStatus("status").notNull().default("waiting"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdByName: varchar("created_by_name", { length: 160 }).notNull(),
    sourceCity: varchar("source_city", { length: 160 }).notNull(),
    sourceUnit: varchar("source_unit", { length: 160 }).notNull(),
    sourceBuilding: varchar("source_building", { length: 160 }).notNull(),
    sourceRoom: varchar("source_room", { length: 160 }).notNull(),
    destinationCity: varchar("destination_city", { length: 160 }).notNull(),
    destinationUnit: varchar("destination_unit", { length: 160 }).notNull(),
    destinationBuilding: varchar("destination_building", { length: 160 }).notNull(),
    destinationRoom: varchar("destination_room", { length: 160 }).notNull(),
    packageCount: integer("package_count").notNull().default(0),
    packageSummary: text("package_summary"),
    vehicleType: varchar("vehicle_type", { length: 60 }),
    vehicleNumber: varchar("vehicle_number", { length: 60 }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    transitAt: timestamp("transit_at", { withTimezone: true }),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    receivedByUserId: uuid("received_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("transports_transport_number_uidx").on(table.transportNumber),
    index("transports_group_status_idx").on(table.groupId, table.status),
    index("transports_group_archive_idx").on(table.groupId, table.archivedAt),
    check(
      "transports_status_check",
      sql`(${table.status} = 'waiting' AND ${table.transitAt} IS NULL AND ${table.arrivedAt} IS NULL) OR (${table.status} = 'transit' AND ${table.transitAt} IS NOT NULL AND ${table.vehicleType} IS NOT NULL AND ${table.vehicleNumber} IS NOT NULL AND ${table.arrivedAt} IS NULL) OR (${table.status} = 'arrived' AND ${table.transitAt} IS NOT NULL AND ${table.arrivedAt} IS NOT NULL)`,
    ),
    check(
      "transports_receipt_check",
      sql`(${table.receivedAt} IS NULL AND ${table.receivedByUserId} IS NULL) OR (${table.status} = 'arrived' AND ${table.receivedAt} IS NOT NULL AND ${table.receivedByUserId} IS NOT NULL)`,
    ),
  ],
);

export const packingUnits = pgTable(
  "packing_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    unitType: packingUnitType("unit_type").notNull(),
    status: packingUnitStatus("status").notNull().default("awaiting_packing"),
    unitNumber: varchar("unit_number", { length: 5 }),
    destinationBuilding: varchar("destination_building", { length: 160 }),
    destinationFloor: varchar("destination_floor", { length: 60 }),
    destinationRoom: varchar("destination_room", { length: 160 }),
    transportId: uuid("transport_id").references(() => transports.id, { onDelete: "set null" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    collectedAt: timestamp("collected_at", { withTimezone: true }),
    collectedByUserId: uuid("collected_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("packing_units_unit_number_uidx")
      .on(table.unitNumber)
      .where(sql`${table.unitNumber} IS NOT NULL`),
    index("packing_units_room_archive_idx").on(table.roomId, table.archivedAt),
    index("packing_units_status_idx").on(table.status),
    index("packing_units_transport_idx").on(table.transportId),
    check(
      "packing_units_status_check",
      sql`(${table.status} IN ('awaiting_packing', 'packing_in_progress') AND ${table.unitNumber} IS NULL AND ${table.closedAt} IS NULL) OR (${table.status} = 'closed' AND ${table.unitNumber} IS NOT NULL AND ${table.closedAt} IS NOT NULL AND ${table.destinationBuilding} IS NOT NULL AND ${table.destinationRoom} IS NOT NULL)`,
    ),
    check(
      "packing_units_collection_check",
      sql`(${table.collectedAt} IS NULL AND ${table.collectedByUserId} IS NULL) OR (${table.status} = 'closed' AND ${table.collectedAt} IS NOT NULL AND ${table.collectedByUserId} IS NOT NULL)`,
    ),
  ],
);

export const packingUnitItems = pgTable(
  "packing_unit_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packingUnitId: uuid("packing_unit_id")
      .notNull()
      .references(() => packingUnits.id, { onDelete: "restrict" }),
    mappingReportId: uuid("mapping_report_id")
      .notNull()
      .references(() => mappingReports.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("packing_unit_items_unit_report_uidx").on(
      table.packingUnitId,
      table.mappingReportId,
    ),
    index("packing_unit_items_report_idx").on(table.mappingReportId),
    check("packing_unit_items_quantity_check", sql`${table.quantity} > 0`),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: uuid("entity_id"),
    groupId: uuid("group_id").references(() => groups.id, {
      onDelete: "restrict",
    }),
    requestId: varchar("request_id", { length: 80 }).notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_events_group_time_idx").on(table.groupId, table.occurredAt),
    index("audit_events_actor_time_idx").on(
      table.actorUserId,
      table.occurredAt,
    ),
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const exportOutbox = pgTable(
  "export_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    groupId: uuid("group_id").references(() => groups.id, {
      onDelete: "restrict",
    }),
    payload: jsonb("payload").notNull(),
    status: outboxStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    index("export_outbox_dispatch_idx").on(table.status, table.availableAt),
    index("export_outbox_group_idx").on(table.groupId),
    check("export_outbox_attempts_check", sql`${table.attempts} >= 0`),
  ],
);

export type UserRole = (typeof userRole.enumValues)[number];
export type MembershipRole = (typeof membershipRole.enumValues)[number];
export type RoomStatus = (typeof roomStatus.enumValues)[number];
export type ReportStatus = (typeof reportStatus.enumValues)[number];
export type RoomPackingStatus = (typeof roomPackingStatus.enumValues)[number];
export type PackingUnitType = (typeof packingUnitType.enumValues)[number];
export type PackingUnitStatus = (typeof packingUnitStatus.enumValues)[number];
export type TransportStatus = (typeof transportStatus.enumValues)[number];

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

export const transportUnitStatus = pgEnum("transport_unit_status", [
  "loading",
  "in_transit",
  "released",
]);

export const packingUnitStatus = pgEnum("packing_unit_status", [
  "closed",
  "in_transit",
  "received",
  "missing",
  "surplus_review",
]);

export const itemMovementStatus = pgEnum("item_movement_status", [
  "unassigned",
  "packed",
  "in_transit",
  "received",
  "missing",
  "distributed",
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
    movementStatus: itemMovementStatus("movement_status")
      .notNull()
      .default("unassigned"),
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

export const transportUnits = pgTable(
  "transport_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    licensePlate: varchar("license_plate", { length: 32 }).notNull(),
    status: transportUnitStatus("status").notNull().default("loading"),
    version: integer("version").notNull().default(1),
    departedAt: timestamp("departed_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("transport_units_group_status_idx").on(table.groupId, table.status),
    index("transport_units_license_plate_idx").on(table.licensePlate),
    check("transport_units_version_check", sql`${table.version} > 0`),
    check(
      "transport_units_status_timestamps_check",
      sql`(${table.status} = 'loading' AND ${table.departedAt} IS NULL AND ${table.releasedAt} IS NULL) OR (${table.status} = 'in_transit' AND ${table.departedAt} IS NOT NULL AND ${table.releasedAt} IS NULL) OR (${table.status} = 'released' AND ${table.departedAt} IS NOT NULL AND ${table.releasedAt} IS NOT NULL)`,
    ),
  ],
);

export const packingUnits = pgTable(
  "packing_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    serialNumber: varchar("serial_number", { length: 5 }).notNull(),
    status: packingUnitStatus("status").notNull().default("closed"),
    originRoomId: uuid("origin_room_id").references(() => rooms.id, {
      onDelete: "restrict",
    }),
    destination: varchar("destination", { length: 240 }),
    itemCount: integer("item_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("packing_units_serial_number_uidx").on(table.serialNumber),
    index("packing_units_group_status_idx").on(table.groupId, table.status),
    check(
      "packing_units_serial_number_check",
      sql`${table.serialNumber} ~ '^[0-9]{5}$'`,
    ),
    check("packing_units_item_count_check", sql`${table.itemCount} >= 0`),
  ],
);

export const transportPackingUnits = pgTable(
  "transport_packing_units",
  {
    transportUnitId: uuid("transport_unit_id")
      .notNull()
      .references(() => transportUnits.id, { onDelete: "restrict" }),
    packingUnitId: uuid("packing_unit_id")
      .notNull()
      .references(() => packingUnits.id, { onDelete: "restrict" }),
    loadedAt: timestamp("loaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    receivedBy: uuid("received_by").references(() => users.id, {
      onDelete: "restrict",
    }),
  },
  (table) => [
    primaryKey({ columns: [table.transportUnitId, table.packingUnitId] }),
    index("transport_packing_units_packing_idx").on(table.packingUnitId),
  ],
);

export const packingUnitItems = pgTable(
  "packing_unit_items",
  {
    packingUnitId: uuid("packing_unit_id")
      .notNull()
      .references(() => packingUnits.id, { onDelete: "restrict" }),
    mappingReportId: uuid("mapping_report_id")
      .notNull()
      .references(() => mappingReports.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.packingUnitId, table.mappingReportId] }),
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
export type TransportUnitStatus = (typeof transportUnitStatus.enumValues)[number];
export type PackingUnitStatus = (typeof packingUnitStatus.enumValues)[number];
export type ItemMovementStatus = (typeof itemMovementStatus.enumValues)[number];

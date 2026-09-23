import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDb } from "../db";
import {
  auditEvents,
  categories,
  exportOutbox,
  itemTypes,
  mappingReports,
  packingUnitItems,
  packingUnits,
  rooms,
  subcategories,
} from "../db/schema";
import type { Actor } from "../lib/authorization";
import { HttpError } from "../lib/errors";

export type CreateReportInput = {
  roomId: string;
  subcategoryId: string;
  quantity: number;
  serialNumber?: string;
  notes?: string;
  purpose?: string;
  target?: string;
  expiresAt?: Date;
};

export async function listReports(groupId: string) {
  return getDb()
    .select({
      id: mappingReports.id,
      roomId: mappingReports.roomId,
      subcategoryId: mappingReports.subcategoryId,
      status: mappingReports.status,
      quantity: mappingReports.quantity,
      serialNumber: mappingReports.serialNumber,
      createdAt: mappingReports.createdAt,
    })
    .from(mappingReports)
    .innerJoin(rooms, eq(mappingReports.roomId, rooms.id))
    .where(
      and(
        eq(rooms.groupId, groupId),
        isNull(rooms.archivedAt),
        isNull(mappingReports.archivedAt),
      ),
    )
    .orderBy(desc(mappingReports.createdAt));
}

/** Total mapped item quantity (not report rows) across the groups' live rooms. */
export async function countMappedItemsForGroups(groupIds: string[]) {
  if (groupIds.length === 0) return 0;

  const [row] = await getDb()
    .select({ value: sql<number>`coalesce(sum(${mappingReports.quantity}), 0)`.mapWith(Number) })
    .from(mappingReports)
    .innerJoin(rooms, eq(mappingReports.roomId, rooms.id))
    .where(
      and(
        inArray(rooms.groupId, groupIds),
        isNull(rooms.archivedAt),
        isNull(mappingReports.archivedAt),
      ),
    );

  return row.value;
}

export async function listItemCatalog() {
  return getDb()
    .select({
      itemTypeId: itemTypes.id,
      itemTypeName: itemTypes.name,
      categoryId: categories.id,
      categoryName: categories.name,
      subcategoryId: subcategories.id,
      subcategoryName: subcategories.name,
    })
    .from(subcategories)
    .innerJoin(categories, eq(subcategories.categoryId, categories.id))
    .innerJoin(itemTypes, eq(categories.itemTypeId, itemTypes.id))
    .where(
      and(
        isNull(subcategories.archivedAt),
        isNull(categories.archivedAt),
        isNull(itemTypes.archivedAt),
      ),
    )
    .orderBy(asc(itemTypes.name), asc(categories.name), asc(subcategories.name));
}

export async function createReport(
  actor: Actor,
  groupId: string,
  input: CreateReportInput,
  requestId: string,
) {
  const db = getDb();
  const [[room], [subcategory]] = await Promise.all([
    db
      .select({ id: rooms.id })
      .from(rooms)
      .where(
        and(
          eq(rooms.id, input.roomId),
          eq(rooms.groupId, groupId),
          isNull(rooms.archivedAt),
        ),
      )
      .limit(1),
    db
      .select({ id: subcategories.id })
      .from(subcategories)
      .where(
        and(
          eq(subcategories.id, input.subcategoryId),
          isNull(subcategories.archivedAt),
        ),
      )
      .limit(1),
  ]);

  if (!room || !subcategory) {
    throw new HttpError(400, "INVALID_REFERENCE", "A referenced record is not available.");
  }

  const reportId = crypto.randomUUID();
  const occurredAt = new Date();

  // No review workflow yet: reports go straight to approved so they're immediately packable.
  await db.transaction(async (transaction) => {
    await transaction.insert(mappingReports).values({
      id: reportId,
      roomId: input.roomId,
      subcategoryId: input.subcategoryId,
      quantity: input.quantity,
      serialNumber: input.serialNumber,
      notes: input.notes,
      purpose: input.purpose,
      target: input.target,
      expiresAt: input.expiresAt,
      reportedBy: actor.id,
      status: "approved",
      submittedAt: occurredAt,
      reviewedBy: actor.id,
      reviewedAt: occurredAt,
    });
    await transaction.insert(auditEvents).values({
      actorUserId: actor.id,
      action: "mapping_report.created",
      entityType: "mapping_report",
      entityId: reportId,
      groupId,
      requestId,
      metadata: { roomId: input.roomId, quantity: input.quantity },
      occurredAt,
    });
    await transaction.insert(exportOutbox).values({
      eventType: "mapping_report.created",
      entityType: "mapping_report",
      entityId: reportId,
      groupId,
      payload: { reportId, groupId, roomId: input.roomId, occurredAt },
    });
  });

  return { id: reportId, groupId, ...input, status: "approved" as const };
}

export async function archiveReport(actor: Actor, reportId: string, requestId: string) {
  const db = getDb();
  const [report] = await db
    .select({ id: mappingReports.id, roomId: mappingReports.roomId, groupId: rooms.groupId })
    .from(mappingReports)
    .innerJoin(rooms, eq(mappingReports.roomId, rooms.id))
    .where(and(eq(mappingReports.id, reportId), isNull(mappingReports.archivedAt)))
    .limit(1);

  if (!report) {
    throw new HttpError(404, "NOT_FOUND", "The requested resource was not found.");
  }

  const [packed] = await db
    .select({ value: count() })
    .from(packingUnitItems)
    .innerJoin(packingUnits, eq(packingUnitItems.packingUnitId, packingUnits.id))
    .where(and(eq(packingUnitItems.mappingReportId, reportId), isNull(packingUnits.archivedAt)));

  if (packed.value > 0) {
    throw new HttpError(409, "REPORT_ALREADY_PACKED", "לא ניתן למחוק פריט שכבר נארז ביחידת אריזה.");
  }

  const occurredAt = new Date();
  await db.transaction(async (transaction) => {
    await transaction
      .update(mappingReports)
      .set({ archivedAt: occurredAt, updatedAt: occurredAt })
      .where(eq(mappingReports.id, reportId));
    await transaction.insert(auditEvents).values({
      actorUserId: actor.id,
      action: "mapping_report.archived",
      entityType: "mapping_report",
      entityId: reportId,
      groupId: report.groupId,
      requestId,
      metadata: { roomId: report.roomId },
      occurredAt,
    });
  });

  return { id: reportId };
}

export async function getReportGroupId(reportId: string) {
  const [report] = await getDb()
    .select({ groupId: rooms.groupId })
    .from(mappingReports)
    .innerJoin(rooms, eq(mappingReports.roomId, rooms.id))
    .where(and(eq(mappingReports.id, reportId), isNull(mappingReports.archivedAt)))
    .limit(1);

  if (!report) {
    throw new HttpError(404, "NOT_FOUND", "The requested resource was not found.");
  }

  return report.groupId;
}

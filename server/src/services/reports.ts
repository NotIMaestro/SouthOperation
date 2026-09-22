import { and, desc, eq, isNull } from "drizzle-orm";

import { getDb } from "../db";
import {
  auditEvents,
  exportOutbox,
  mappingReports,
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

  return { id: reportId, groupId, ...input, status: "draft" as const };
}

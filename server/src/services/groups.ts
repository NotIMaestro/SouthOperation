import { and, asc, count, eq, isNull } from "drizzle-orm";

import { getDb } from "../db";
import {
  auditEvents,
  exportOutbox,
  groupCodes,
  groups,
  memberships,
  rooms,
  transports,
} from "../db/schema";
import type { Actor } from "../lib/authorization";
import { safeAuditMetadata } from "../lib/audit";
import { HttpError } from "../lib/errors";

export type CreateGroupInput = {
  groupCodeId: string;
  name: string;
  contactName?: string;
  contactPhone?: string;
};

export async function listVisibleGroups(actor: Actor) {
  const db = getDb();

  if (actor.role === "admin") {
    return db
      .select({
        id: groups.id,
        name: groups.name,
        groupCode: groupCodes.code,
        contactName: groups.contactName,
        contactPhone: groups.contactPhone,
        createdAt: groups.createdAt,
      })
      .from(groups)
      .innerJoin(groupCodes, eq(groups.groupCodeId, groupCodes.id))
      .where(isNull(groups.archivedAt))
      .orderBy(asc(groups.name));
  }

  return db
    .selectDistinct({
      id: groups.id,
      name: groups.name,
      groupCode: groupCodes.code,
      contactName: groups.contactName,
      contactPhone: groups.contactPhone,
      createdAt: groups.createdAt,
    })
    .from(groups)
    .innerJoin(groupCodes, eq(groups.groupCodeId, groupCodes.id))
    .innerJoin(
      memberships,
      and(
        eq(memberships.groupId, groups.id),
        eq(memberships.userId, actor.id),
        isNull(memberships.archivedAt),
      ),
    )
    .where(isNull(groups.archivedAt))
    .orderBy(asc(groups.name));
}

export async function listGroupCodes() {
  return getDb()
    .select({ id: groupCodes.id, code: groupCodes.code, description: groupCodes.description })
    .from(groupCodes)
    .where(isNull(groupCodes.archivedAt))
    .orderBy(asc(groupCodes.code));
}

export async function createGroup(
  actor: Actor,
  input: CreateGroupInput,
  requestId: string,
) {
  const db = getDb();
  const [groupCode] = await db
    .select({ id: groupCodes.id })
    .from(groupCodes)
    .where(
      and(eq(groupCodes.id, input.groupCodeId), isNull(groupCodes.archivedAt)),
    )
    .limit(1);

  if (!groupCode) {
    throw new HttpError(400, "INVALID_GROUP_CODE", "The group code is not available.");
  }

  const groupId = crypto.randomUUID();
  const occurredAt = new Date();
  const groupRecord = {
    id: groupId,
    groupCodeId: input.groupCodeId,
    name: input.name,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    createdBy: actor.id,
  };

  await db.transaction(async (transaction) => {
    await transaction.insert(groups).values(groupRecord);
    await transaction.insert(auditEvents).values({
      actorUserId: actor.id,
      action: "group.created",
      entityType: "group",
      entityId: groupId,
      groupId,
      requestId,
      metadata: safeAuditMetadata({ groupCodeId: input.groupCodeId }),
      occurredAt,
    });
    await transaction.insert(exportOutbox).values({
      eventType: "group.created",
      entityType: "group",
      entityId: groupId,
      groupId,
      payload: { groupId, groupCodeId: input.groupCodeId, occurredAt },
    });
  });

  return { id: groupId, ...input, createdAt: occurredAt };
}

export async function archiveGroup(actor: Actor, groupId: string, requestId: string) {
  const db = getDb();
  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.archivedAt)))
    .limit(1);

  if (!group) {
    throw new HttpError(404, "NOT_FOUND", "The requested resource was not found.");
  }

  const [[roomCount], [transportCount]] = await Promise.all([
    db
      .select({ value: count() })
      .from(rooms)
      .where(and(eq(rooms.groupId, groupId), isNull(rooms.archivedAt))),
    db
      .select({ value: count() })
      .from(transports)
      .where(and(eq(transports.groupId, groupId), isNull(transports.archivedAt))),
  ]);

  if (roomCount.value > 0 || transportCount.value > 0) {
    throw new HttpError(409, "GROUP_NOT_EMPTY", "לא ניתן למחוק קבוצה שיש בה חדרים או הובלות.");
  }

  const occurredAt = new Date();
  await db.transaction(async (transaction) => {
    await transaction
      .update(groups)
      .set({ archivedAt: occurredAt, updatedAt: occurredAt })
      .where(eq(groups.id, groupId));
    await transaction
      .update(memberships)
      .set({ archivedAt: occurredAt })
      .where(and(eq(memberships.groupId, groupId), isNull(memberships.archivedAt)));
    await transaction.insert(auditEvents).values({
      actorUserId: actor.id,
      action: "group.archived",
      entityType: "group",
      entityId: groupId,
      groupId,
      requestId,
      metadata: {},
      occurredAt,
    });
  });

  return { id: groupId };
}

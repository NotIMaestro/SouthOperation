import { and, asc, eq, isNull } from "drizzle-orm";

import { getDb } from "../db";
import {
  auditEvents,
  exportOutbox,
  groupCodes,
  groups,
  memberships,
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

export async function listActiveGroupCodes() {
  return getDb()
    .select({ id: groupCodes.id, code: groupCodes.code, description: groupCodes.description })
    .from(groupCodes)
    .where(isNull(groupCodes.archivedAt))
    .orderBy(asc(groupCodes.code));
}

export async function listVisibleGroups(actor: Actor) {
  const db = getDb();

  if (actor.role === "admin") {
    return db
      .select({
        id: groups.id,
        name: groups.name,
        groupCode: groupCodes.code,
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

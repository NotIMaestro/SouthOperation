import { and, asc, eq, isNull } from "drizzle-orm";

import { getDb } from "../db";
import { auditEvents, groups, memberships, users, type MembershipRole } from "../db/schema";
import type { Actor } from "../lib/authorization";
import { HttpError } from "../lib/errors";

export type AddMembershipInput = {
  userId: string;
  role: MembershipRole;
};

export async function listMemberships(groupId: string) {
  return getDb()
    .select({
      userId: memberships.userId,
      role: memberships.role,
      assignedAt: memberships.assignedAt,
      displayName: users.displayName,
      email: users.email,
      userRole: users.role,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(memberships.groupId, groupId), isNull(memberships.archivedAt), eq(users.isActive, true)))
    .orderBy(asc(memberships.role), asc(users.displayName));
}

export async function listActiveUsers() {
  return getDb()
    .select({ id: users.id, displayName: users.displayName, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(asc(users.displayName));
}

export async function addMembership(
  actor: Actor,
  groupId: string,
  input: AddMembershipInput,
  requestId: string,
) {
  const db = getDb();
  const [[group], [user]] = await Promise.all([
    db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.id, groupId), isNull(groups.archivedAt)))
      .limit(1),
    db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, input.userId), eq(users.isActive, true)))
      .limit(1),
  ]);

  if (!group || !user) {
    throw new HttpError(400, "INVALID_REFERENCE", "A referenced record is not available.");
  }

  const occurredAt = new Date();
  await db.transaction(async (transaction) => {
    // Re-adding a removed member revives the same row (the PK is user+group).
    await transaction
      .insert(memberships)
      .values({ userId: input.userId, groupId, role: input.role, assignedBy: actor.id, assignedAt: occurredAt })
      .onConflictDoUpdate({
        target: [memberships.userId, memberships.groupId],
        set: { role: input.role, assignedBy: actor.id, assignedAt: occurredAt, archivedAt: null },
      });
    await transaction.insert(auditEvents).values({
      actorUserId: actor.id,
      action: "membership.assigned",
      entityType: "membership",
      entityId: input.userId,
      groupId,
      requestId,
      metadata: { role: input.role },
      occurredAt,
    });
  });

  return { groupId, ...input };
}

export async function removeMembership(actor: Actor, groupId: string, userId: string, requestId: string) {
  const db = getDb();
  const occurredAt = new Date();

  await db.transaction(async (transaction) => {
    const removed = await transaction
      .update(memberships)
      .set({ archivedAt: occurredAt })
      .where(
        and(eq(memberships.groupId, groupId), eq(memberships.userId, userId), isNull(memberships.archivedAt)),
      )
      .returning({ userId: memberships.userId });

    if (removed.length === 0) {
      throw new HttpError(404, "NOT_FOUND", "The requested resource was not found.");
    }

    await transaction.insert(auditEvents).values({
      actorUserId: actor.id,
      action: "membership.removed",
      entityType: "membership",
      entityId: userId,
      groupId,
      requestId,
      metadata: {},
      occurredAt,
    });
  });

  return { groupId, userId };
}

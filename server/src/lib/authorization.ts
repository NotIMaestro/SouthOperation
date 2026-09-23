import { and, eq, isNull, or } from "drizzle-orm";

import { getDb } from "../db";
import { auditEvents, groups, memberships, users, type MembershipRole, type UserRole } from "../db/schema";
import { HttpError } from "./errors";

export type Actor = {
  id: string;
  role: UserRole;
};

/** Returns an active user that was provisioned by an administrator. */
export async function findInvitedUserBySubject(subject: string) {
  const [user] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.externalSubject, subject), eq(users.isActive, true)))
    .limit(1);

  return user;
}

export async function provisionEnterpriseUser(input: {
  subject: string;
  email: string;
  displayName: string;
  initialRole: UserRole;
  bootstrapAdmin?: boolean;
}) {
  const db = getDb();
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      or(
        eq(users.externalSubject, input.subject),
        eq(users.email, input.email),
      ),
    )
    .limit(1);

  const [user] = existingUser
    ? await db
        .update(users)
        .set({
          externalSubject: input.subject,
          email: input.email,
          displayName: input.displayName,
          ...(input.bootstrapAdmin ? { role: "admin" as const } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning({ id: users.id, isActive: users.isActive })
    : await db
        .insert(users)
        .values({
          externalSubject: input.subject,
          email: input.email,
          displayName: input.displayName,
          role: input.initialRole,
        })
        .returning({ id: users.id, isActive: users.isActive });

  return user?.isActive ? { id: user.id } : undefined;
}

/** Admin-only callers use this to locate Entra-provisioned accounts for assignment. */
export async function listUsersForAdministration() {
  return getDb()
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(users.displayName);
}

export async function setUserRole(
  actor: Actor,
  userId: string,
  role: UserRole,
  requestId: string,
) {
  if (actor.id === userId) {
    throw new HttpError(400, "SELF_ROLE_CHANGE", "You cannot change your own role.");
  }

  const db = getDb();
  const [user] = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ id: users.id, role: users.role });

  if (!user) throw new HttpError(404, "NOT_FOUND", "The requested user was not found.");

  await db.insert(auditEvents).values({
    actorUserId: actor.id,
    action: "user.role_changed",
    entityType: "user",
    entityId: user.id,
    requestId,
    metadata: { role },
    occurredAt: new Date(),
  });
  return user;
}

export async function assignUserToGroup(
  actor: Actor,
  userId: string,
  groupId: string,
  role: MembershipRole,
  requestId: string,
) {
  const db = getDb();
  const [[user], [group]] = await Promise.all([
    db.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.isActive, true))).limit(1),
    db.select({ id: groups.id }).from(groups).where(and(eq(groups.id, groupId), isNull(groups.archivedAt))).limit(1),
  ]);
  if (!user || !group) throw new HttpError(404, "NOT_FOUND", "The requested resource was not found.");

  await db.transaction(async (transaction) => {
    await transaction
      .insert(memberships)
      .values({ userId, groupId, role, assignedBy: actor.id, archivedAt: null })
      .onConflictDoUpdate({
        target: [memberships.userId, memberships.groupId],
        set: { role, assignedBy: actor.id, assignedAt: new Date(), archivedAt: null },
      });
    await transaction.insert(auditEvents).values({
      actorUserId: actor.id,
      action: "membership.assigned",
      entityType: "membership",
      entityId: userId,
      groupId,
      requestId,
      metadata: { role },
      occurredAt: new Date(),
    });
  });
}

export async function requireActor(userId: string | undefined): Promise<Actor> {
  if (!userId) {
    throw new HttpError(401, "UNAUTHENTICATED", "Authentication is required.");
  }

  const [actor] = await getDb()
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.isActive, true)))
    .limit(1);

  if (!actor) {
    throw new HttpError(401, "UNAUTHENTICATED", "Authentication is required.");
  }

  return actor;
}

export function requireGlobalRole(actor: Actor, allowed: UserRole[]) {
  if (!allowed.includes(actor.role)) {
    throw new HttpError(403, "FORBIDDEN", "You do not have permission for this action.");
  }
}

export async function requireGroupAccess(
  actor: Actor,
  groupId: string,
  allowedMembershipRoles: MembershipRole[] = ["manager", "commander", "operator"],
) {
  if (actor.role === "admin") return;

  const [membership] = await getDb()
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, actor.id),
        eq(memberships.groupId, groupId),
        isNull(memberships.archivedAt),
      ),
    )
    .limit(1);

  if (!membership || !allowedMembershipRoles.includes(membership.role)) {
    // Deliberately avoid revealing whether the group exists.
    throw new HttpError(404, "NOT_FOUND", "The requested resource was not found.");
  }
}

export async function requireGroupManager(actor: Actor, groupId: string) {
  return requireGroupAccess(actor, groupId, ["manager"]);
}

/** The actor's effective role in a group: "admin" for global admins, else their live membership role. */
export async function getGroupRole(actor: Actor, groupId: string): Promise<MembershipRole | "admin" | null> {
  if (actor.role === "admin") return "admin";

  const [membership] = await getDb()
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, actor.id),
        eq(memberships.groupId, groupId),
        isNull(memberships.archivedAt),
      ),
    )
    .limit(1);

  return membership?.role ?? null;
}

import { and, eq, isNull, or } from "drizzle-orm";

import { getDb } from "../db";
import { memberships, users, type MembershipRole, type UserRole } from "../db/schema";
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
  role: UserRole;
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
          role: input.role,
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
          role: input.role,
        })
        .returning({ id: users.id, isActive: users.isActive });

  return user?.isActive ? { id: user.id } : undefined;
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

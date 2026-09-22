import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../db";
import { memberships, users, type MembershipRole, type UserRole } from "../db/schema";
import { HttpError } from "./errors";

export type Actor = {
  id: string;
  role: UserRole;
};

export async function findInvitedUserBySubject(subject: string | null | undefined) {
  if (!subject) return undefined;

  const [user] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.externalSubject, subject), eq(users.isActive, true)))
    .limit(1);

  return user;
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

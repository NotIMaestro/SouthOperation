import { desc, eq, inArray } from "drizzle-orm";

import { getDb } from "../db";
import { auditEvents, groups, users } from "../db/schema";

/**
 * Newest audit events. `groupIds` scopes to those groups; `null` means no scoping (admins),
 * which also includes group-less events such as catalog changes.
 */
export async function listAuditEvents(groupIds: string[] | null, limit = 200) {
  if (groupIds && groupIds.length === 0) return [];

  return getDb()
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      entityType: auditEvents.entityType,
      entityId: auditEvents.entityId,
      metadata: auditEvents.metadata,
      occurredAt: auditEvents.occurredAt,
      actorName: users.displayName,
      groupName: groups.name,
    })
    .from(auditEvents)
    .leftJoin(users, eq(auditEvents.actorUserId, users.id))
    .leftJoin(groups, eq(auditEvents.groupId, groups.id))
    .where(groupIds ? inArray(auditEvents.groupId, groupIds) : undefined)
    .orderBy(desc(auditEvents.occurredAt))
    .limit(limit);
}

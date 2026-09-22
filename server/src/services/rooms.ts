import { and, asc, eq, isNull } from "drizzle-orm";

import { getDb } from "../db";
import { auditEvents, exportOutbox, groups, locations, rooms } from "../db/schema";
import type { Actor } from "../lib/authorization";
import { HttpError } from "../lib/errors";

export type CreateRoomInput = {
  name: string;
  description?: string;
  locationId?: string;
  managerName?: string;
};

export async function listRooms(groupId: string) {
  return getDb()
    .select({
      id: rooms.id,
      name: rooms.name,
      description: rooms.description,
      locationId: rooms.locationId,
      status: rooms.status,
      packingStatus: rooms.packingStatus,
      startedAt: rooms.startedAt,
      completedAt: rooms.completedAt,
    })
    .from(rooms)
    .where(and(eq(rooms.groupId, groupId), isNull(rooms.archivedAt)))
    .orderBy(asc(rooms.name));
}

export async function createRoom(
  actor: Actor,
  groupId: string,
  input: CreateRoomInput,
  requestId: string,
) {
  const db = getDb();
  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.archivedAt)))
    .limit(1);

  if (!group) {
    throw new HttpError(404, "NOT_FOUND", "The requested resource was not found.");
  }

  if (input.locationId) {
    const [location] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(eq(locations.id, input.locationId), isNull(locations.archivedAt)),
      )
      .limit(1);
    if (!location) {
      throw new HttpError(400, "INVALID_LOCATION", "The location is not available.");
    }
  }

  const roomId = crypto.randomUUID();
  const occurredAt = new Date();

  await db.transaction(async (transaction) => {
    await transaction.insert(rooms).values({ id: roomId, groupId, ...input });
    await transaction.insert(auditEvents).values({
      actorUserId: actor.id,
      action: "room.created",
      entityType: "room",
      entityId: roomId,
      groupId,
      requestId,
      metadata: {},
      occurredAt,
    });
    await transaction.insert(exportOutbox).values({
      eventType: "room.created",
      entityType: "room",
      entityId: roomId,
      groupId,
      payload: { roomId, groupId, occurredAt },
    });
  });

  return { id: roomId, groupId, ...input, status: "unstarted" as const };
}

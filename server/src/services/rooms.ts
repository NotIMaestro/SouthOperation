import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";

import { getDb } from "../db";
import {
  auditEvents,
  exportOutbox,
  groups,
  locations,
  mappingReports,
  packingUnits,
  rooms,
  type RoomStatus,
} from "../db/schema";
import type { Actor } from "../lib/authorization";
import { HttpError } from "../lib/errors";
import { assertRoomTransition } from "../domain/workflows";

export type CreateRoomInput = {
  name: string;
  description?: string;
  locationId?: string;
  managerName?: string;
};

export type UpdateRoomInput = {
  name?: string;
  description?: string | null;
  locationId?: string | null;
  managerName?: string | null;
};

export async function listRooms(groupId: string) {
  return getDb()
    .select({
      id: rooms.id,
      name: rooms.name,
      description: rooms.description,
      managerName: rooms.managerName,
      locationId: rooms.locationId,
      locationName: locations.name,
      status: rooms.status,
      packingStatus: rooms.packingStatus,
      startedAt: rooms.startedAt,
      completedAt: rooms.completedAt,
    })
    .from(rooms)
    .leftJoin(locations, eq(rooms.locationId, locations.id))
    .where(and(eq(rooms.groupId, groupId), isNull(rooms.archivedAt)))
    .orderBy(asc(rooms.name));
}

export async function listLocations() {
  return getDb()
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(isNull(locations.archivedAt))
    .orderBy(asc(locations.name));
}

async function loadRoom(roomId: string) {
  const [room] = await getDb()
    .select({ id: rooms.id, groupId: rooms.groupId, status: rooms.status, startedAt: rooms.startedAt })
    .from(rooms)
    .where(and(eq(rooms.id, roomId), isNull(rooms.archivedAt)))
    .limit(1);

  if (!room) {
    throw new HttpError(404, "NOT_FOUND", "The requested resource was not found.");
  }

  return room;
}

export async function getRoomGroupId(roomId: string) {
  return (await loadRoom(roomId)).groupId;
}

async function assertLocationAvailable(locationId: string) {
  const [location] = await getDb()
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.id, locationId), isNull(locations.archivedAt)))
    .limit(1);
  if (!location) {
    throw new HttpError(400, "INVALID_LOCATION", "The location is not available.");
  }
}

export async function countRoomsInProgressForGroups(groupIds: string[]) {
  if (groupIds.length === 0) return 0;

  const [row] = await getDb()
    .select({ value: count() })
    .from(rooms)
    .where(
      and(
        inArray(rooms.groupId, groupIds),
        eq(rooms.status, "in_progress"),
        isNull(rooms.archivedAt),
      ),
    );

  return row.value;
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

  if (input.locationId) await assertLocationAvailable(input.locationId);

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

export async function updateRoomStatus(
  actor: Actor,
  roomId: string,
  to: Extract<RoomStatus, "in_progress" | "completed">,
  requestId: string,
) {
  const room = await loadRoom(roomId);
  assertRoomTransition(room.status, to);

  const db = getDb();
  const occurredAt = new Date();

  await db.transaction(async (transaction) => {
    await transaction
      .update(rooms)
      .set({
        status: to,
        startedAt: room.startedAt ?? occurredAt,
        completedAt: to === "completed" ? occurredAt : null,
        updatedAt: occurredAt,
      })
      .where(eq(rooms.id, roomId));
    await transaction.insert(auditEvents).values({
      actorUserId: actor.id,
      action: "room.status_updated",
      entityType: "room",
      entityId: roomId,
      groupId: room.groupId,
      requestId,
      metadata: { from: room.status, to },
      occurredAt,
    });
    await transaction.insert(exportOutbox).values({
      eventType: "room.status_updated",
      entityType: "room",
      entityId: roomId,
      groupId: room.groupId,
      payload: { roomId, from: room.status, to, occurredAt },
    });
  });

  return { id: roomId, status: to };
}

export async function updateRoom(
  actor: Actor,
  roomId: string,
  input: UpdateRoomInput,
  requestId: string,
) {
  const room = await loadRoom(roomId);
  if (input.locationId) await assertLocationAvailable(input.locationId);

  const db = getDb();
  const occurredAt = new Date();

  await db.transaction(async (transaction) => {
    await transaction
      .update(rooms)
      .set({ ...input, updatedAt: occurredAt })
      .where(eq(rooms.id, roomId));
    await transaction.insert(auditEvents).values({
      actorUserId: actor.id,
      action: "room.updated",
      entityType: "room",
      entityId: roomId,
      groupId: room.groupId,
      requestId,
      metadata: { fields: Object.keys(input) },
      occurredAt,
    });
  });

  return { id: roomId, ...input };
}

export async function archiveRoom(actor: Actor, roomId: string, requestId: string) {
  const room = await loadRoom(roomId);
  const db = getDb();

  const [[reportCount], [unitCount]] = await Promise.all([
    db
      .select({ value: count() })
      .from(mappingReports)
      .where(and(eq(mappingReports.roomId, roomId), isNull(mappingReports.archivedAt))),
    db
      .select({ value: count() })
      .from(packingUnits)
      .where(and(eq(packingUnits.roomId, roomId), isNull(packingUnits.archivedAt))),
  ]);

  if (reportCount.value > 0 || unitCount.value > 0) {
    throw new HttpError(409, "ROOM_NOT_EMPTY", "לא ניתן למחוק חדר שיש בו פריטים ממופים או יחידות אריזה.");
  }

  const occurredAt = new Date();
  await db.transaction(async (transaction) => {
    await transaction
      .update(rooms)
      .set({ archivedAt: occurredAt, updatedAt: occurredAt })
      .where(eq(rooms.id, roomId));
    await transaction.insert(auditEvents).values({
      actorUserId: actor.id,
      action: "room.archived",
      entityType: "room",
      entityId: roomId,
      groupId: room.groupId,
      requestId,
      metadata: {},
      occurredAt,
    });
  });

  return { id: roomId };
}

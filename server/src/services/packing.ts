import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { getDb } from "../db";
import {
  auditEvents,
  categories,
  exportOutbox,
  itemTypes,
  mappingReports,
  packingUnitItems,
  packingUnits,
  rooms,
  sequenceCounters,
  subcategories,
  type PackingUnitType,
  type RoomPackingStatus,
} from "../db/schema";
import type { Actor } from "../lib/authorization";
import { HttpError } from "../lib/errors";
import { assertPackingUnitTransition, assertRoomPackingTransition } from "../domain/workflows";

export type CreatePackingUnitInput = {
  unitType: PackingUnitType;
};

export type PackingUnitItemInput = {
  mappingReportId: string;
  quantity: number;
};

export type ClosePackingUnitInput = {
  destinationBuilding: string;
  destinationFloor?: string;
  destinationRoom: string;
};

export async function loadRoomForGroup(roomId: string) {
  const [room] = await getDb()
    .select({
      id: rooms.id,
      groupId: rooms.groupId,
      name: rooms.name,
      description: rooms.description,
      managerName: rooms.managerName,
      status: rooms.status,
      packingStatus: rooms.packingStatus,
    })
    .from(rooms)
    .where(and(eq(rooms.id, roomId), isNull(rooms.archivedAt)))
    .limit(1);

  if (!room) {
    throw new HttpError(404, "NOT_FOUND", "The requested resource was not found.");
  }

  return room;
}

export async function loadPackingUnitForGroup(packingUnitId: string) {
  const [record] = await getDb()
    .select({
      id: packingUnits.id,
      status: packingUnits.status,
      unitType: packingUnits.unitType,
      roomId: packingUnits.roomId,
      groupId: rooms.groupId,
    })
    .from(packingUnits)
    .innerJoin(rooms, eq(packingUnits.roomId, rooms.id))
    .where(and(eq(packingUnits.id, packingUnitId), isNull(packingUnits.archivedAt)))
    .limit(1);

  if (!record) {
    throw new HttpError(404, "NOT_FOUND", "The requested resource was not found.");
  }

  return record;
}

export async function listPackingUnits(groupId: string, roomId: string) {
  return getDb()
    .select({
      id: packingUnits.id,
      roomId: packingUnits.roomId,
      unitType: packingUnits.unitType,
      status: packingUnits.status,
      unitNumber: packingUnits.unitNumber,
      destinationBuilding: packingUnits.destinationBuilding,
      destinationFloor: packingUnits.destinationFloor,
      destinationRoom: packingUnits.destinationRoom,
      createdAt: packingUnits.createdAt,
      closedAt: packingUnits.closedAt,
    })
    .from(packingUnits)
    .innerJoin(rooms, eq(packingUnits.roomId, rooms.id))
    .where(
      and(
        eq(packingUnits.roomId, roomId),
        eq(rooms.groupId, groupId),
        isNull(packingUnits.archivedAt),
      ),
    )
    .orderBy(asc(packingUnits.createdAt));
}

export async function listPackableItems(groupId: string, roomId: string) {
  const db = getDb();
  const reports = await db
    .select({
      mappingReportId: mappingReports.id,
      quantity: mappingReports.quantity,
      serialNumber: mappingReports.serialNumber,
      subcategoryName: subcategories.name,
      categoryName: categories.name,
      itemTypeName: itemTypes.name,
    })
    .from(mappingReports)
    .innerJoin(rooms, eq(mappingReports.roomId, rooms.id))
    .innerJoin(subcategories, eq(mappingReports.subcategoryId, subcategories.id))
    .leftJoin(categories, eq(subcategories.categoryId, categories.id))
    .leftJoin(itemTypes, eq(categories.itemTypeId, itemTypes.id))
    .where(
      and(
        eq(mappingReports.roomId, roomId),
        eq(rooms.groupId, groupId),
        eq(mappingReports.status, "approved"),
        isNull(mappingReports.archivedAt),
      ),
    )
    .orderBy(asc(subcategories.name));

  if (reports.length === 0) return [];

  const reportIds = reports.map((report) => report.mappingReportId);
  const packedByReport = await db
    .select({
      mappingReportId: packingUnitItems.mappingReportId,
      packed: sql<number>`sum(${packingUnitItems.quantity})`.mapWith(Number),
    })
    .from(packingUnitItems)
    .innerJoin(packingUnits, eq(packingUnitItems.packingUnitId, packingUnits.id))
    .where(
      and(
        inArray(packingUnitItems.mappingReportId, reportIds),
        isNull(packingUnits.archivedAt),
      ),
    )
    .groupBy(packingUnitItems.mappingReportId);
  const packedByReportId = new Map(packedByReport.map((row) => [row.mappingReportId, row.packed]));

  return reports.map((report) => {
    const packedQuantity = packedByReportId.get(report.mappingReportId) ?? 0;
    return {
      ...report,
      packedQuantity,
      remainingQuantity: report.quantity - packedQuantity,
    };
  });
}

export async function createPackingUnit(
  actor: Actor,
  roomId: string,
  input: CreatePackingUnitInput,
  requestId: string,
) {
  const room = await loadRoomForGroup(roomId);

  if (room.status !== "completed") {
    throw new HttpError(409, "ROOM_NOT_MAPPED", "יש לסיים את המיפוי");
  }

  if (room.packingStatus === "closed") {
    throw new HttpError(409, "ROOM_PACKING_CLOSED", "The room packing process has already been closed.");
  }

  const nextRoomPackingStatus = room.packingStatus === "not_started" || room.packingStatus === "paused"
    ? "in_packing"
    : room.packingStatus;
  if (nextRoomPackingStatus !== room.packingStatus) {
    assertRoomPackingTransition(room.packingStatus, nextRoomPackingStatus);
  }

  const db = getDb();
  const packingUnitId = crypto.randomUUID();
  const occurredAt = new Date();

  const statements = [
    db.insert(packingUnits).values({
      id: packingUnitId,
      roomId,
      unitType: input.unitType,
      createdBy: actor.id,
    }),
    db.insert(auditEvents).values({
      actorUserId: actor.id,
      action: "packing_unit.created",
      entityType: "packing_unit",
      entityId: packingUnitId,
      groupId: room.groupId,
      requestId,
      metadata: { roomId, unitType: input.unitType },
      occurredAt,
    }),
    db.insert(exportOutbox).values({
      eventType: "packing_unit.created",
      entityType: "packing_unit",
      entityId: packingUnitId,
      groupId: room.groupId,
      payload: { packingUnitId, roomId, unitType: input.unitType, occurredAt },
    }),
  ] as const;

  if (nextRoomPackingStatus !== room.packingStatus) {
    await db.batch([
      db.update(rooms).set({ packingStatus: nextRoomPackingStatus }).where(eq(rooms.id, roomId)),
      ...statements,
    ]);
  } else {
    await db.batch([...statements]);
  }

  return {
    id: packingUnitId,
    roomId,
    unitType: input.unitType,
    status: "awaiting_packing" as const,
  };
}

export async function setPackingUnitItems(
  actor: Actor,
  packingUnitId: string,
  items: PackingUnitItemInput[],
  requestId: string,
) {
  const unit = await loadPackingUnitForGroup(packingUnitId);

  if (unit.unitType === "personal_carton") {
    throw new HttpError(400, "NO_ITEM_MARKING", "בקרטון אישי אין סימון של הפריטים.");
  }
  if (unit.status === "closed") {
    throw new HttpError(409, "INVALID_STATE_TRANSITION", "The packing unit is already closed.");
  }
  if (items.length === 0) {
    throw new HttpError(400, "EMPTY_ITEM_LIST", "At least one item is required.");
  }

  const db = getDb();
  const reportIds = items.map((item) => item.mappingReportId);
  const reports = await db
    .select({
      id: mappingReports.id,
      roomId: mappingReports.roomId,
      status: mappingReports.status,
      quantity: mappingReports.quantity,
    })
    .from(mappingReports)
    .where(and(inArray(mappingReports.id, reportIds), isNull(mappingReports.archivedAt)));

  const reportsById = new Map(reports.map((report) => [report.id, report]));
  const packedByReport = await db
    .select({
      mappingReportId: packingUnitItems.mappingReportId,
      packed: sql<number>`sum(${packingUnitItems.quantity})`.mapWith(Number),
    })
    .from(packingUnitItems)
    .innerJoin(packingUnits, eq(packingUnitItems.packingUnitId, packingUnits.id))
    .where(
      and(
        inArray(packingUnitItems.mappingReportId, reportIds),
        isNull(packingUnits.archivedAt),
      ),
    )
    .groupBy(packingUnitItems.mappingReportId);
  const packedByReportId = new Map(packedByReport.map((row) => [row.mappingReportId, row.packed]));

  const existingLines = await db
    .select({
      mappingReportId: packingUnitItems.mappingReportId,
      quantity: packingUnitItems.quantity,
    })
    .from(packingUnitItems)
    .where(eq(packingUnitItems.packingUnitId, packingUnitId));
  const existingByReportId = new Map(existingLines.map((row) => [row.mappingReportId, row.quantity]));

  for (const item of items) {
    const report = reportsById.get(item.mappingReportId);
    if (!report || report.roomId !== unit.roomId) {
      throw new HttpError(400, "INVALID_REFERENCE", "A referenced record is not available.");
    }
    if (report.status !== "approved") {
      throw new HttpError(409, "REPORT_NOT_APPROVED", "The mapping report has not been approved yet.");
    }

    const alreadyPackedElsewhere =
      (packedByReportId.get(item.mappingReportId) ?? 0) -
      (existingByReportId.get(item.mappingReportId) ?? 0);
    if (alreadyPackedElsewhere + item.quantity > report.quantity) {
      throw new HttpError(409, "QUANTITY_EXCEEDS_MAPPED", "The requested quantity exceeds the mapped quantity.");
    }
  }

  const occurredAt = new Date();
  const upserts = items.map((item) =>
    db
      .insert(packingUnitItems)
      .values({
        packingUnitId,
        mappingReportId: item.mappingReportId,
        quantity: item.quantity,
      })
      .onConflictDoUpdate({
        target: [packingUnitItems.packingUnitId, packingUnitItems.mappingReportId],
        set: { quantity: item.quantity, updatedAt: occurredAt },
      }),
  );

  if (unit.status === "awaiting_packing") {
    assertPackingUnitTransition(unit.status, "packing_in_progress");
  }

  const statements = [
    ...(unit.status === "awaiting_packing"
      ? [
          db
            .update(packingUnits)
            .set({ status: "packing_in_progress" as const, updatedAt: occurredAt })
            .where(eq(packingUnits.id, packingUnitId)),
        ]
      : []),
    ...upserts,
    db.insert(auditEvents).values({
      actorUserId: actor.id,
      action: "packing_unit.items_set",
      entityType: "packing_unit",
      entityId: packingUnitId,
      groupId: unit.groupId,
      requestId,
      metadata: { itemCount: items.length },
      occurredAt,
    }),
  ];

  await db.batch(statements as never);

  return { id: packingUnitId, itemCount: items.length };
}

async function nextPackingUnitNumber() {
  const db = getDb();
  const [row] = await db
    .insert(sequenceCounters)
    .values({ key: "packing_unit_number", value: 1 })
    .onConflictDoUpdate({
      target: sequenceCounters.key,
      set: { value: sql`${sequenceCounters.value} + 1` },
    })
    .returning({ value: sequenceCounters.value });

  return row.value.toString().padStart(5, "0");
}

export async function closePackingUnit(
  actor: Actor,
  packingUnitId: string,
  input: ClosePackingUnitInput,
  requestId: string,
) {
  const unit = await loadPackingUnitForGroup(packingUnitId);

  if (unit.status === "closed") {
    throw new HttpError(409, "INVALID_STATE_TRANSITION", "The packing unit is already closed.");
  }

  const db = getDb();

  if (unit.status === "awaiting_packing") {
    if (unit.unitType !== "personal_carton") {
      throw new HttpError(400, "NO_ITEMS_PACKED", "יש לבחור פריטים לפני סיום האריזה.");
    }
    assertPackingUnitTransition("awaiting_packing", "packing_in_progress");
  }
  assertPackingUnitTransition("packing_in_progress", "closed");

  const unitNumber = await nextPackingUnitNumber();
  const occurredAt = new Date();

  await db.batch([
    db
      .update(packingUnits)
      .set({
        status: "closed",
        unitNumber,
        destinationBuilding: input.destinationBuilding,
        destinationFloor: input.destinationFloor,
        destinationRoom: input.destinationRoom,
        closedAt: occurredAt,
        updatedAt: occurredAt,
      })
      .where(eq(packingUnits.id, packingUnitId)),
    db.insert(auditEvents).values({
      actorUserId: actor.id,
      action: "packing_unit.closed",
      entityType: "packing_unit",
      entityId: packingUnitId,
      groupId: unit.groupId,
      requestId,
      metadata: { unitNumber, roomId: unit.roomId },
      occurredAt,
    }),
    db.insert(exportOutbox).values({
      eventType: "packing_unit.closed",
      entityType: "packing_unit",
      entityId: packingUnitId,
      groupId: unit.groupId,
      payload: { packingUnitId, unitNumber, roomId: unit.roomId, occurredAt },
    }),
  ]);

  return { id: packingUnitId, status: "closed" as const, unitNumber };
}

async function transitionRoomPacking(
  actor: Actor,
  roomId: string,
  to: Extract<RoomPackingStatus, "closed" | "paused">,
  requestId: string,
) {
  const room = await loadRoomForGroup(roomId);
  assertRoomPackingTransition(room.packingStatus, to);

  const db = getDb();
  const [openUnit] = await db
    .select({ id: packingUnits.id })
    .from(packingUnits)
    .where(
      and(
        eq(packingUnits.roomId, roomId),
        isNull(packingUnits.archivedAt),
        or(
          eq(packingUnits.status, "awaiting_packing"),
          eq(packingUnits.status, "packing_in_progress"),
        ),
      ),
    )
    .limit(1);

  if (openUnit) {
    throw new HttpError(409, "OPEN_PACKING_UNITS_EXIST", "יש לסיים את כל יחידות האריזה הפתוחות.");
  }

  const occurredAt = new Date();
  await db.batch([
    db.update(rooms).set({ packingStatus: to }).where(eq(rooms.id, roomId)),
    db.insert(auditEvents).values({
      actorUserId: actor.id,
      action: to === "closed" ? "room_packing.closed" : "room_packing.paused",
      entityType: "room",
      entityId: roomId,
      groupId: room.groupId,
      requestId,
      metadata: {},
      occurredAt,
    }),
  ]);

  return { roomId, packingStatus: to };
}

export async function closeRoomPacking(actor: Actor, roomId: string, requestId: string) {
  return transitionRoomPacking(actor, roomId, "closed", requestId);
}

export async function pauseRoomPacking(actor: Actor, roomId: string, requestId: string) {
  return transitionRoomPacking(actor, roomId, "paused", requestId);
}

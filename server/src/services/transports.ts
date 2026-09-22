import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { getDb } from "../db";
import {
  auditEvents,
  exportOutbox,
  groups,
  packingUnits,
  rooms,
  sequenceCounters,
  transports,
  type TransportStatus,
} from "../db/schema";
import type { Actor } from "../lib/authorization";
import { HttpError } from "../lib/errors";
import { assertTransportTransition } from "../domain/workflows";

export type CreateTransportInput = {
  createdByName: string;
  sourceCity: string;
  sourceUnit: string;
  sourceBuilding: string;
  sourceRoom: string;
  destinationCity: string;
  destinationUnit: string;
  destinationBuilding: string;
  destinationRoom: string;
  packageCount: number;
  packageSummary?: string;
  scheduledAt?: Date;
};

export type UpdateTransportStatusInput = {
  status: TransportStatus;
  vehicleType?: string;
  vehicleNumber?: string;
};

export async function listTransportsForGroup(groupId: string, status?: TransportStatus) {
  return getDb()
    .select()
    .from(transports)
    .where(
      and(
        eq(transports.groupId, groupId),
        isNull(transports.archivedAt),
        status ? eq(transports.status, status) : undefined,
      ),
    )
    .orderBy(desc(transports.createdAt));
}

export async function loadTransportForGroup(transportId: string) {
  const [record] = await getDb()
    .select()
    .from(transports)
    .where(and(eq(transports.id, transportId), isNull(transports.archivedAt)))
    .limit(1);

  if (!record) {
    throw new HttpError(404, "NOT_FOUND", "The requested resource was not found.");
  }

  return record;
}

async function nextTransportNumber() {
  const db = getDb();
  const [row] = await db
    .insert(sequenceCounters)
    .values({ key: "transport_number", value: 1 })
    .onConflictDoUpdate({
      target: sequenceCounters.key,
      set: { value: sql`${sequenceCounters.value} + 1` },
    })
    .returning({ value: sequenceCounters.value });

  return `TR-${row.value.toString().padStart(3, "0")}`;
}

export async function createTransport(
  actor: Actor,
  groupId: string,
  input: CreateTransportInput,
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

  const transportId = crypto.randomUUID();
  const transportNumber = await nextTransportNumber();
  const occurredAt = new Date();

  await db.transaction(async (transaction) => {
    await transaction.insert(transports).values({
      id: transportId,
      groupId,
      transportNumber,
      createdByUserId: actor.id,
      ...input,
    });
    await transaction.insert(auditEvents).values({
      actorUserId: actor.id,
      action: "transport.created",
      entityType: "transport",
      entityId: transportId,
      groupId,
      requestId,
      metadata: { transportNumber },
      occurredAt,
    });
    await transaction.insert(exportOutbox).values({
      eventType: "transport.created",
      entityType: "transport",
      entityId: transportId,
      groupId,
      payload: { transportId, transportNumber, occurredAt },
    });
  });

  return { id: transportId, groupId, transportNumber, status: "waiting" as const };
}

export async function updateTransportStatus(
  actor: Actor,
  transportId: string,
  input: UpdateTransportStatusInput,
  requestId: string,
) {
  const transport = await loadTransportForGroup(transportId);

  if (input.status !== transport.status) {
    assertTransportTransition(transport.status, input.status);
  } else if (transport.status !== "transit") {
    throw new HttpError(409, "INVALID_STATE_TRANSITION", "The transport status transition is not allowed.");
  }

  if (input.status === "transit" && (!input.vehicleType?.trim() || !input.vehicleNumber?.trim())) {
    throw new HttpError(400, "VEHICLE_DETAILS_REQUIRED", "כדי להעביר את ההובלה לדרך יש למלא סוג רכב ומספר רכב.");
  }

  const db = getDb();
  const occurredAt = new Date();
  const wasAlreadyTransit = transport.status === "transit" && input.status === "transit";

  await db.transaction(async (transaction) => {
    await transaction
      .update(transports)
      .set({
        status: input.status,
        vehicleType: input.vehicleType?.trim() || transport.vehicleType,
        vehicleNumber: input.vehicleNumber?.trim() || transport.vehicleNumber,
        transitAt: input.status === "transit" ? transport.transitAt ?? occurredAt : transport.transitAt,
        arrivedAt: input.status === "arrived" ? occurredAt : transport.arrivedAt,
        updatedAt: occurredAt,
      })
      .where(eq(transports.id, transportId));

    if (!wasAlreadyTransit) {
      await transaction.insert(auditEvents).values({
        actorUserId: actor.id,
        action: "transport.status_updated",
        entityType: "transport",
        entityId: transportId,
        groupId: transport.groupId,
        requestId,
        metadata: { from: transport.status, to: input.status },
        occurredAt,
      });
    }
  });

  return { id: transportId, status: input.status };
}

export async function assignPackingUnitToTransport(
  actor: Actor,
  packingUnitId: string,
  transportId: string,
  requestId: string,
) {
  const db = getDb();
  const [unit] = await db
    .select({ id: packingUnits.id, status: packingUnits.status, groupId: rooms.groupId })
    .from(packingUnits)
    .innerJoin(rooms, eq(packingUnits.roomId, rooms.id))
    .where(and(eq(packingUnits.id, packingUnitId), isNull(packingUnits.archivedAt)))
    .limit(1);

  if (!unit) {
    throw new HttpError(404, "NOT_FOUND", "The requested resource was not found.");
  }
  if (unit.status !== "closed") {
    throw new HttpError(409, "PACKING_UNIT_NOT_CLOSED", "יש לסיים את האריזה לפני שיוך להובלה.");
  }

  const transport = await loadTransportForGroup(transportId);
  if (transport.groupId !== unit.groupId) {
    throw new HttpError(400, "INVALID_REFERENCE", "A referenced record is not available.");
  }
  if (transport.status !== "waiting") {
    throw new HttpError(409, "TRANSPORT_NOT_WAITING", "ניתן לשייך יחידות רק להובלה שטרם יצאה לדרך.");
  }

  const occurredAt = new Date();
  await db.transaction(async (transaction) => {
    await transaction
      .update(packingUnits)
      .set({ transportId, updatedAt: occurredAt })
      .where(eq(packingUnits.id, packingUnitId));
    await transaction.insert(auditEvents).values({
      actorUserId: actor.id,
      action: "packing_unit.assigned_transport",
      entityType: "packing_unit",
      entityId: packingUnitId,
      groupId: unit.groupId,
      requestId,
      metadata: { transportId },
      occurredAt,
    });
  });

  return { id: packingUnitId, transportId };
}

export async function listPackingUnitsWithStage(groupId: string) {
  return getDb()
    .select({
      id: packingUnits.id,
      unitType: packingUnits.unitType,
      unitNumber: packingUnits.unitNumber,
      roomName: rooms.name,
      destinationBuilding: packingUnits.destinationBuilding,
      destinationRoom: packingUnits.destinationRoom,
      transportId: packingUnits.transportId,
      transportNumber: transports.transportNumber,
      transportStatus: transports.status,
    })
    .from(packingUnits)
    .innerJoin(rooms, eq(packingUnits.roomId, rooms.id))
    .leftJoin(transports, eq(packingUnits.transportId, transports.id))
    .where(
      and(
        eq(rooms.groupId, groupId),
        eq(packingUnits.status, "closed"),
        isNull(packingUnits.archivedAt),
      ),
    )
    .orderBy(asc(packingUnits.unitNumber));
}

export async function listPackingUnitsForTransport(transportId: string) {
  return getDb()
    .select({
      id: packingUnits.id,
      unitType: packingUnits.unitType,
      unitNumber: packingUnits.unitNumber,
      roomName: rooms.name,
    })
    .from(packingUnits)
    .innerJoin(rooms, eq(packingUnits.roomId, rooms.id))
    .where(and(eq(packingUnits.transportId, transportId), isNull(packingUnits.archivedAt)))
    .orderBy(asc(packingUnits.unitNumber));
}

export async function listWaitingTransportsForAssignment(groupId: string) {
  const rows = await listTransportsForGroup(groupId, "waiting");
  return rows.map((row) => ({ id: row.id, transportNumber: row.transportNumber }));
}

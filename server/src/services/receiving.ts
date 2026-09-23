import { and, asc, desc, eq, inArray, isNotNull, isNull, type SQL } from "drizzle-orm";

import { getDb } from "../db";
import {
  auditEvents,
  mappingReports,
  packingUnitItems,
  packingUnits,
  rooms,
  subcategories,
  transports,
} from "../db/schema";
import type { Actor } from "../lib/authorization";
import { HttpError } from "../lib/errors";

/** Closed packing units with their contents, as reviewed at receiving and pickup. */
async function listUnitsWithItems(where: SQL | undefined) {
  const db = getDb();
  const units = await db
    .select({
      id: packingUnits.id,
      unitNumber: packingUnits.unitNumber,
      unitType: packingUnits.unitType,
      roomName: rooms.name,
      destinationBuilding: packingUnits.destinationBuilding,
      destinationFloor: packingUnits.destinationFloor,
      destinationRoom: packingUnits.destinationRoom,
      transportId: packingUnits.transportId,
      transportNumber: transports.transportNumber,
      receivedAt: transports.receivedAt,
      collectedAt: packingUnits.collectedAt,
    })
    .from(packingUnits)
    .innerJoin(rooms, eq(packingUnits.roomId, rooms.id))
    .innerJoin(transports, eq(packingUnits.transportId, transports.id))
    .where(where)
    .orderBy(asc(packingUnits.unitNumber));

  if (units.length === 0) return [];

  const items = await db
    .select({
      packingUnitId: packingUnitItems.packingUnitId,
      id: packingUnitItems.id,
      name: subcategories.name,
      quantity: packingUnitItems.quantity,
    })
    .from(packingUnitItems)
    .innerJoin(mappingReports, eq(packingUnitItems.mappingReportId, mappingReports.id))
    .innerJoin(subcategories, eq(mappingReports.subcategoryId, subcategories.id))
    .where(inArray(packingUnitItems.packingUnitId, units.map((unit) => unit.id)))
    .orderBy(asc(subcategories.name));

  return units.map((unit) => ({
    ...unit,
    items: items
      .filter((item) => item.packingUnitId === unit.id)
      .map(({ id, name, quantity }) => ({ id, name, quantity })),
  }));
}

/** Arrived transports of a group, split by whether their receipt was confirmed. */
export async function listReceivingForGroup(groupId: string) {
  const arrived = await getDb()
    .select({
      id: transports.id,
      transportNumber: transports.transportNumber,
      sourceCity: transports.sourceCity,
      sourceUnit: transports.sourceUnit,
      destinationCity: transports.destinationCity,
      destinationUnit: transports.destinationUnit,
      destinationBuilding: transports.destinationBuilding,
      destinationRoom: transports.destinationRoom,
      packageCount: transports.packageCount,
      packageSummary: transports.packageSummary,
      vehicleType: transports.vehicleType,
      vehicleNumber: transports.vehicleNumber,
      arrivedAt: transports.arrivedAt,
      receivedAt: transports.receivedAt,
    })
    .from(transports)
    .where(and(eq(transports.groupId, groupId), eq(transports.status, "arrived"), isNull(transports.archivedAt)))
    .orderBy(desc(transports.arrivedAt));

  const units = await listUnitsWithItems(
    and(eq(transports.groupId, groupId), eq(transports.status, "arrived"), isNull(packingUnits.archivedAt)),
  );
  const withUnits = arrived.map((transport) => ({
    ...transport,
    units: units.filter((unit) => unit.transportId === transport.id),
  }));

  return {
    pending: withUnits.filter((transport) => !transport.receivedAt),
    confirmed: withUnits
      .filter((transport) => transport.receivedAt)
      .sort((a, b) => b.receivedAt!.getTime() - a.receivedAt!.getTime()),
  };
}

/** Confirms receipt of every requested transport or none of them. */
export async function confirmTransportReceipt(actor: Actor, groupId: string, transportIds: string[], requestId: string) {
  const occurredAt = new Date();

  await getDb().transaction(async (transaction) => {
    const updated = await transaction
      .update(transports)
      .set({ receivedAt: occurredAt, receivedByUserId: actor.id, updatedAt: occurredAt })
      .where(
        and(
          inArray(transports.id, transportIds),
          eq(transports.groupId, groupId),
          eq(transports.status, "arrived"),
          isNull(transports.receivedAt),
          isNull(transports.archivedAt),
        ),
      )
      .returning({ id: transports.id, transportNumber: transports.transportNumber });

    if (updated.length !== transportIds.length) {
      throw new HttpError(409, "RECEIPT_NOT_AVAILABLE", "אחת ההובלות כבר אושרה או אינה זמינה לאישור. רעננו את הרשימה.");
    }

    await transaction.insert(auditEvents).values(
      updated.map((transport) => ({
        actorUserId: actor.id,
        action: "transport.receipt_confirmed",
        entityType: "transport",
        entityId: transport.id,
        groupId,
        requestId,
        metadata: { transportNumber: transport.transportNumber },
        occurredAt,
      })),
    );
  });

  return listReceivingForGroup(groupId);
}

/** Units that arrived in a received transport, split by whether they were picked up. */
export async function listPickupForGroup(groupId: string) {
  const units = await listUnitsWithItems(
    and(eq(rooms.groupId, groupId), isNotNull(transports.receivedAt), isNull(packingUnits.archivedAt)),
  );

  return {
    pending: units.filter((unit) => !unit.collectedAt),
    confirmed: units
      .filter((unit) => unit.collectedAt)
      .sort((a, b) => b.collectedAt!.getTime() - a.collectedAt!.getTime()),
  };
}

/** Confirms pickup of every requested unit or none of them. */
export async function confirmUnitPickup(actor: Actor, groupId: string, packingUnitIds: string[], requestId: string) {
  const db = getDb();
  const available = await db
    .select({ id: packingUnits.id, unitNumber: packingUnits.unitNumber })
    .from(packingUnits)
    .innerJoin(rooms, eq(packingUnits.roomId, rooms.id))
    .innerJoin(transports, eq(packingUnits.transportId, transports.id))
    .where(
      and(
        inArray(packingUnits.id, packingUnitIds),
        eq(rooms.groupId, groupId),
        isNotNull(transports.receivedAt),
        isNull(packingUnits.collectedAt),
        isNull(packingUnits.archivedAt),
      ),
    );

  if (available.length !== packingUnitIds.length) {
    throw new HttpError(409, "PICKUP_NOT_AVAILABLE", "אחת החבילות כבר אושרה או אינה זמינה לאישור. רעננו את הרשימה.");
  }

  const occurredAt = new Date();
  await db.transaction(async (transaction) => {
    // Re-checks collectedAt so a concurrent confirmation cannot be overwritten.
    const updated = await transaction
      .update(packingUnits)
      .set({ collectedAt: occurredAt, collectedByUserId: actor.id, updatedAt: occurredAt })
      .where(and(inArray(packingUnits.id, packingUnitIds), isNull(packingUnits.collectedAt)))
      .returning({ id: packingUnits.id });

    if (updated.length !== packingUnitIds.length) {
      throw new HttpError(409, "PICKUP_NOT_AVAILABLE", "אחת החבילות כבר אושרה או אינה זמינה לאישור. רעננו את הרשימה.");
    }

    await transaction.insert(auditEvents).values(
      available.map((unit) => ({
        actorUserId: actor.id,
        action: "packing_unit.picked_up",
        entityType: "packing_unit",
        entityId: unit.id,
        groupId,
        requestId,
        metadata: { unitNumber: unit.unitNumber },
        occurredAt,
      })),
    );
  });

  return listPickupForGroup(groupId);
}

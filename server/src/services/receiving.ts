import { and, asc, desc, eq, inArray, isNotNull, isNull, type SQL } from "drizzle-orm";

import { getDb } from "../db";
import {
  auditEvents,
  mappingReports,
  packingUnitItems,
  packingUnits,
  receiptIssues,
  rooms,
  subcategories,
  transports,
  type ReceiptIssueType,
} from "../db/schema";
import type { Actor } from "../lib/authorization";
import { HttpError } from "../lib/errors";

export type ReceiptIssueInput = {
  packingUnitItemId: string;
  issueType: ReceiptIssueType;
  quantity: number;
  note?: string;
};

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

  const issues = items.length === 0 ? [] : await db
    .select({
      packingUnitItemId: receiptIssues.packingUnitItemId,
      issueType: receiptIssues.issueType,
      quantity: receiptIssues.quantity,
      note: receiptIssues.note,
    })
    .from(receiptIssues)
    .where(inArray(receiptIssues.packingUnitItemId, items.map((item) => item.id)));

  return units.map((unit) => ({
    ...unit,
    items: items
      .filter((item) => item.packingUnitId === unit.id)
      .map(({ id, name, quantity }) => ({
        id,
        name,
        quantity,
        issues: issues
          .filter((issue) => issue.packingUnitItemId === id)
          .map(({ issueType, quantity: issueQuantity, note }) => ({ issueType, quantity: issueQuantity, note })),
      })),
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

/** Confirms receipt of every requested transport or none of them, recording damaged or missing items. */
export async function confirmTransportReceipt(
  actor: Actor,
  groupId: string,
  transportIds: string[],
  requestId: string,
  issues: ReceiptIssueInput[] = [],
) {
  const occurredAt = new Date();
  const db = getDb();

  // Every reported item must belong to one of the confirmed transports, within its packed quantity.
  const reportedItems = issues.length === 0 ? [] : await db
    .select({ id: packingUnitItems.id, quantity: packingUnitItems.quantity, transportId: packingUnits.transportId })
    .from(packingUnitItems)
    .innerJoin(packingUnits, eq(packingUnitItems.packingUnitId, packingUnits.id))
    .where(
      and(
        inArray(packingUnitItems.id, [...new Set(issues.map((issue) => issue.packingUnitItemId))]),
        inArray(packingUnits.transportId, transportIds),
        isNull(packingUnits.archivedAt),
      ),
    );
  const issueRows = issues.map((issue) => {
    const item = reportedItems.find((entry) => entry.id === issue.packingUnitItemId);
    if (!item?.transportId) {
      throw new HttpError(422, "RECEIPT_ISSUE_INVALID", "אחד הפריטים שדווחו אינו שייך להובלות שנבחרו.");
    }
    return { ...issue, transportId: item.transportId, packedQuantity: item.quantity };
  });
  for (const row of issueRows) {
    const reported = issueRows
      .filter((other) => other.packingUnitItemId === row.packingUnitItemId)
      .reduce((total, other) => total + other.quantity, 0);
    if (reported > row.packedQuantity) {
      throw new HttpError(422, "RECEIPT_ISSUE_INVALID", "כמות הפריטים הפגומים והחסרים גדולה מהכמות שנארזה.");
    }
  }


  await db.transaction(async (transaction) => {
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
        metadata: {
          transportNumber: transport.transportNumber,
          issues: issueRows
            .filter((issue) => issue.transportId === transport.id)
            .map(({ packingUnitItemId, issueType, quantity }) => ({ packingUnitItemId, issueType, quantity })),
        },
        occurredAt,
      })),
    );

    if (issueRows.length > 0) {
      await transaction.insert(receiptIssues).values(
        issueRows.map((issue) => ({
          transportId: issue.transportId,
          packingUnitItemId: issue.packingUnitItemId,
          issueType: issue.issueType,
          quantity: issue.quantity,
          note: issue.note || null,
          reportedByUserId: actor.id,
          createdAt: occurredAt,
        })),
      );
    }
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

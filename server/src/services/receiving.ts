import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "../db";
import {
  groups,
  packingUnits,
  transportPackingUnits,
  transportUnits,
} from "../db/schema";
import {
  assertPackingUnitTransition,
  assertTransportUnitTransition,
  reviewReceivingManifest,
} from "../domain/workflows";
import {
  type Actor,
  requireGroupAccess,
} from "../lib/authorization";
import { HttpError } from "../lib/errors";
import { listVisibleGroups } from "./groups";

export type CompleteReceivingInput = {
  expectedVersion: number;
  receivedPackingUnitIds: string[];
};

function uuidArray(ids: readonly string[]) {
  if (ids.length === 0) return sql`ARRAY[]::uuid[]`;
  return sql`ARRAY[${sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  )}]`;
}

export async function listInboundTransportUnits(actor: Actor) {
  const db = getDb();
  const visibleGroups = await listVisibleGroups(actor);
  const visibleGroupIds = visibleGroups.map((group) => group.id);

  if (visibleGroupIds.length === 0) return [];

  const rows = await db
    .select({
      id: transportUnits.id,
      groupId: transportUnits.groupId,
      groupName: groups.name,
      licensePlate: transportUnits.licensePlate,
      status: transportUnits.status,
      version: transportUnits.version,
      departedAt: transportUnits.departedAt,
      packingUnitId: packingUnits.id,
      packingUnitSerialNumber: packingUnits.serialNumber,
      packingUnitStatus: packingUnits.status,
      destination: packingUnits.destination,
      itemCount: packingUnits.itemCount,
    })
    .from(transportUnits)
    .innerJoin(groups, eq(groups.id, transportUnits.groupId))
    .innerJoin(
      transportPackingUnits,
      eq(transportPackingUnits.transportUnitId, transportUnits.id),
    )
    .innerJoin(
      packingUnits,
      eq(packingUnits.id, transportPackingUnits.packingUnitId),
    )
    .where(
      and(
        inArray(transportUnits.groupId, visibleGroupIds),
        eq(transportUnits.status, "in_transit"),
        eq(packingUnits.status, "in_transit"),
      ),
    )
    .orderBy(asc(transportUnits.licensePlate), asc(packingUnits.serialNumber));

  const transports = new Map<
    string,
    {
      id: string;
      groupId: string;
      groupName: string;
      licensePlate: string;
      status: "in_transit";
      version: number;
      departedAt: Date | null;
      packingUnits: Array<{
        id: string;
        serialNumber: string;
        status: "in_transit";
        destination: string | null;
        itemCount: number;
      }>;
    }
  >();

  for (const row of rows) {
    let transport = transports.get(row.id);
    if (!transport) {
      transport = {
        id: row.id,
        groupId: row.groupId,
        groupName: row.groupName,
        licensePlate: row.licensePlate,
        status: "in_transit",
        version: row.version,
        departedAt: row.departedAt,
        packingUnits: [],
      };
      transports.set(row.id, transport);
    }

    transport.packingUnits.push({
      id: row.packingUnitId,
      serialNumber: row.packingUnitSerialNumber,
      status: row.packingUnitStatus as "in_transit",
      destination: row.destination,
      itemCount: row.itemCount,
    });
  }

  return [...transports.values()];
}

export async function completeReceiving(
  actor: Actor,
  transportUnitId: string,
  input: CompleteReceivingInput,
  requestId: string,
) {
  const db = getDb();
  const [transport] = await db
    .select({
      id: transportUnits.id,
      groupId: transportUnits.groupId,
      status: transportUnits.status,
      version: transportUnits.version,
    })
    .from(transportUnits)
    .where(eq(transportUnits.id, transportUnitId))
    .limit(1);

  if (!transport) {
    throw new HttpError(404, "NOT_FOUND", "The requested resource was not found.");
  }

  await requireGroupAccess(actor, transport.groupId);
  assertTransportUnitTransition(transport.status, "released");

  if (transport.version !== input.expectedVersion) {
    throw new HttpError(
      409,
      "STALE_TRANSPORT_UNIT",
      "The transport unit changed. Refresh and try again.",
    );
  }

  const manifest = await db
    .select({ id: packingUnits.id, status: packingUnits.status })
    .from(transportPackingUnits)
    .innerJoin(
      packingUnits,
      eq(packingUnits.id, transportPackingUnits.packingUnitId),
    )
    .where(eq(transportPackingUnits.transportUnitId, transportUnitId));

  if (manifest.length === 0) {
    throw new HttpError(
      409,
      "EMPTY_MANIFEST",
      "A transport unit without packing units cannot be released.",
    );
  }

  for (const packingUnit of manifest) {
    assertPackingUnitTransition(packingUnit.status, "received");
  }

  const review = reviewReceivingManifest(
    manifest.map((packingUnit) => packingUnit.id),
    input.receivedPackingUnitIds,
  );
  const receivedIds = uuidArray(review.receivedIds);
  const releasedAt = new Date();
  const nextVersion = transport.version + 1;
  const eventId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const auditMetadata = JSON.stringify({
    receivedCount: review.receivedIds.length,
    missingCount: review.missingIds.length,
  });
  const outboxPayload = JSON.stringify({
    transportUnitId,
    receivedCount: review.receivedIds.length,
    missingCount: review.missingIds.length,
    releasedAt: releasedAt.toISOString(),
  });

  const [claimed] = await db.batch([
    db
      .update(transportUnits)
      .set({
        status: "released",
        version: nextVersion,
        releasedAt,
        updatedAt: releasedAt,
      })
      .where(
        and(
          eq(transportUnits.id, transportUnitId),
          eq(transportUnits.status, "in_transit"),
          eq(transportUnits.version, input.expectedVersion),
        ),
      )
      .returning({ id: transportUnits.id }),
    db.execute(sql`
      UPDATE "packing_units" AS packing
      SET
        "status" = CASE
          WHEN packing."id" = ANY(${receivedIds}) THEN 'received'::"packing_unit_status"
          ELSE 'missing'::"packing_unit_status"
        END,
        "updated_at" = ${releasedAt}
      FROM "transport_packing_units" AS manifest
      WHERE manifest."packing_unit_id" = packing."id"
        AND manifest."transport_unit_id" = ${transportUnitId}::uuid
        AND EXISTS (
          SELECT 1 FROM "transport_units" AS transport
          WHERE transport."id" = ${transportUnitId}::uuid
            AND transport."version" = ${nextVersion}
            AND transport."released_at" = ${releasedAt}
        )
    `),
    db.execute(sql`
      UPDATE "transport_packing_units" AS manifest
      SET
        "received_at" = CASE
          WHEN manifest."packing_unit_id" = ANY(${receivedIds}) THEN ${releasedAt}
          ELSE NULL
        END,
        "received_by" = CASE
          WHEN manifest."packing_unit_id" = ANY(${receivedIds}) THEN ${actor.id}::uuid
          ELSE NULL
        END
      WHERE manifest."transport_unit_id" = ${transportUnitId}::uuid
        AND EXISTS (
          SELECT 1 FROM "transport_units" AS transport
          WHERE transport."id" = ${transportUnitId}::uuid
            AND transport."version" = ${nextVersion}
            AND transport."released_at" = ${releasedAt}
        )
    `),
    db.execute(sql`
      UPDATE "mapping_reports" AS report
      SET
        "movement_status" = CASE
          WHEN item."packing_unit_id" = ANY(${receivedIds}) THEN 'received'::"item_movement_status"
          ELSE 'missing'::"item_movement_status"
        END,
        "updated_at" = ${releasedAt}
      FROM "packing_unit_items" AS item
      INNER JOIN "transport_packing_units" AS manifest
        ON manifest."packing_unit_id" = item."packing_unit_id"
      WHERE report."id" = item."mapping_report_id"
        AND manifest."transport_unit_id" = ${transportUnitId}::uuid
        AND EXISTS (
          SELECT 1 FROM "transport_units" AS transport
          WHERE transport."id" = ${transportUnitId}::uuid
            AND transport."version" = ${nextVersion}
            AND transport."released_at" = ${releasedAt}
        )
    `),
    db.execute(sql`
      INSERT INTO "audit_events" (
        "id", "actor_user_id", "action", "entity_type", "entity_id",
        "group_id", "request_id", "metadata", "occurred_at"
      )
      SELECT
        ${auditId}::uuid, ${actor.id}::uuid, 'transport.receiving.completed',
        'transport_unit', ${transportUnitId}::uuid, ${transport.groupId}::uuid,
        ${requestId}, ${auditMetadata}::jsonb, ${releasedAt}
      WHERE EXISTS (
        SELECT 1 FROM "transport_units" AS transport
        WHERE transport."id" = ${transportUnitId}::uuid
          AND transport."version" = ${nextVersion}
          AND transport."released_at" = ${releasedAt}
      )
    `),
    db.execute(sql`
      INSERT INTO "export_outbox" (
        "id", "event_type", "entity_type", "entity_id", "group_id", "payload"
      )
      SELECT
        ${eventId}::uuid, 'transport.receiving.completed', 'transport_unit',
        ${transportUnitId}::uuid, ${transport.groupId}::uuid, ${outboxPayload}::jsonb
      WHERE EXISTS (
        SELECT 1 FROM "transport_units" AS transport
        WHERE transport."id" = ${transportUnitId}::uuid
          AND transport."version" = ${nextVersion}
          AND transport."released_at" = ${releasedAt}
      )
    `),
  ]);

  if (claimed.length !== 1) {
    throw new HttpError(
      409,
      "STALE_TRANSPORT_UNIT",
      "The transport unit changed. Refresh and try again.",
    );
  }

  return {
    id: transportUnitId,
    status: "released" as const,
    version: nextVersion,
    releasedAt,
    receivedCount: review.receivedIds.length,
    missingCount: review.missingIds.length,
    notificationQueued: true,
  };
}

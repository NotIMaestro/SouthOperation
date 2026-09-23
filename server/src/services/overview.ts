import { and, count, eq, inArray, isNull } from "drizzle-orm";

import { getDb } from "../db";
import {
  packingUnits,
  roomPackingStatus,
  roomStatus,
  rooms,
  transportStatus,
  transports,
  type PackingUnitStatus,
  type RoomPackingStatus,
  type RoomStatus,
  type TransportStatus,
} from "../db/schema";

type Counts<K extends string> = Record<K, number>;

export type GroupOverview = {
  groupId: string;
  rooms: Counts<RoomStatus>;
  roomPacking: Counts<RoomPackingStatus>;
  packingUnits: Counts<PackingUnitStatus>;
  closedUnassignedUnits: number;
  transports: Counts<TransportStatus>;
};

function zeroCounts<K extends string>(keys: readonly K[]): Counts<K> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Counts<K>;
}

/** Per-group status counts for rooms, packing units and transports (live rows only). */
export async function getGroupOverviews(groupIds: string[]): Promise<GroupOverview[]> {
  if (groupIds.length === 0) return [];
  const db = getDb();

  const [roomRows, unitRows, transportRows] = await Promise.all([
    db
      .select({ groupId: rooms.groupId, status: rooms.status, packingStatus: rooms.packingStatus, value: count() })
      .from(rooms)
      .where(and(inArray(rooms.groupId, groupIds), isNull(rooms.archivedAt)))
      .groupBy(rooms.groupId, rooms.status, rooms.packingStatus),
    db
      .select({
        groupId: rooms.groupId,
        status: packingUnits.status,
        assigned: packingUnits.transportId,
        value: count(),
      })
      .from(packingUnits)
      .innerJoin(rooms, eq(packingUnits.roomId, rooms.id))
      .where(and(inArray(rooms.groupId, groupIds), isNull(packingUnits.archivedAt), isNull(rooms.archivedAt)))
      .groupBy(rooms.groupId, packingUnits.status, packingUnits.transportId),
    db
      .select({ groupId: transports.groupId, status: transports.status, value: count() })
      .from(transports)
      .where(and(inArray(transports.groupId, groupIds), isNull(transports.archivedAt)))
      .groupBy(transports.groupId, transports.status),
  ]);

  const byGroup = new Map<string, GroupOverview>(
    groupIds.map((groupId) => [
      groupId,
      {
        groupId,
        rooms: zeroCounts(roomStatus.enumValues),
        roomPacking: zeroCounts(roomPackingStatus.enumValues),
        packingUnits: zeroCounts(["awaiting_packing", "packing_in_progress", "closed"] as const),
        closedUnassignedUnits: 0,
        transports: zeroCounts(transportStatus.enumValues),
      },
    ]),
  );

  for (const row of roomRows) {
    const overview = byGroup.get(row.groupId)!;
    overview.rooms[row.status] += row.value;
    overview.roomPacking[row.packingStatus] += row.value;
  }
  for (const row of unitRows) {
    const overview = byGroup.get(row.groupId)!;
    overview.packingUnits[row.status] += row.value;
    if (row.status === "closed" && !row.assigned) overview.closedUnassignedUnits += row.value;
  }
  for (const row of transportRows) {
    byGroup.get(row.groupId)!.transports[row.status] += row.value;
  }

  return [...byGroup.values()];
}

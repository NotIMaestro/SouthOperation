import {
  findInvitedUserBySubject,
  getGroupRole,
  provisionEnterpriseUser,
  requireGroupAccess,
} from "@south-operation/server/authorization";
import { listAuditEvents } from "@south-operation/server/audit-log";
import { listCatalogTree as listCatalogTreeSvc } from "@south-operation/server/catalog";
import { HttpError } from "@south-operation/server/errors";
import { listGroupCodes as listGroupCodesSvc, listVisibleGroups } from "@south-operation/server/groups";
import { listActiveUsers as listActiveUsersSvc, listMemberships } from "@south-operation/server/memberships";
import { getGroupOverviews } from "@south-operation/server/overview";
import {
  listPackableItems as listPackableItemsSvc,
  listPackingUnits as listPackingUnitsSvc,
  loadRoomForGroup,
} from "@south-operation/server/packing";
import { listLocations as listLocationsSvc, listRooms } from "@south-operation/server/rooms";
import {
  countMappedItemsForGroups,
  listItemCatalog as listItemCatalogSvc,
} from "@south-operation/server/reports";
import {
  listPackingUnitsWithStage as listPackingUnitsWithStageSvc,
  listTransportsForGroup as listTransportsForGroupSvc,
  listWaitingTransportsForAssignment as listWaitingTransportsForAssignmentSvc,
} from "@south-operation/server/transports";
import type { TransportStatus } from "@south-operation/server/schema";

import { getActor } from "@/lib/actor";

export type ServerResult<T> = { ok: true; data: T } | { ok: false; message: string };

async function attempt<T>(fn: () => Promise<T>): Promise<ServerResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
      return { ok: false, message: "אין לכם הרשאה לצפות בנתון זה." };
    }
    if (error instanceof HttpError && error.status === 404) {
      return { ok: false, message: "המשאב המבוקש לא נמצא." };
    }
    return { ok: false, message: "לא ניתן להתחבר למסד הנתונים. נסו שוב מאוחר יותר." };
  }
}

export type Group = Awaited<ReturnType<typeof listVisibleGroups>>[number];
export type Room = Awaited<ReturnType<typeof loadRoomForGroup>>;
export type RoomListItem = Awaited<ReturnType<typeof listRooms>>[number];
export type PackingUnit = Awaited<ReturnType<typeof listPackingUnitsSvc>>[number];
export type PackableItem = Awaited<ReturnType<typeof listPackableItemsSvc>>[number];
export type Transport = Awaited<ReturnType<typeof listTransportsForGroupSvc>>[number];
export type PackingUnitStage = Awaited<ReturnType<typeof listPackingUnitsWithStageSvc>>[number];
export type ItemCatalogEntry = Awaited<ReturnType<typeof listItemCatalogSvc>>[number];
export type GroupCode = Awaited<ReturnType<typeof listGroupCodesSvc>>[number];
export type Location = Awaited<ReturnType<typeof listLocationsSvc>>[number];
export type Membership = Awaited<ReturnType<typeof listMemberships>>[number];
export type AppUser = Awaited<ReturnType<typeof listActiveUsersSvc>>[number];
export type AuditEvent = Awaited<ReturnType<typeof listAuditEvents>>[number];
export type CatalogItemType = Awaited<ReturnType<typeof listCatalogTreeSvc>>[number];
export type GroupRole = Awaited<ReturnType<typeof getGroupRole>>;

export function listGroups() {
  return attempt(async () => listVisibleGroups(await getActor()));
}

export function getRoom(roomId: string) {
  return attempt(async () => {
    const actor = await getActor();
    const room = await loadRoomForGroup(roomId);
    await requireGroupAccess(actor, room.groupId);
    return room;
  });
}

export function listRoomsForGroup(groupId: string) {
  return attempt(async () => {
    const actor = await getActor();
    await requireGroupAccess(actor, groupId);
    return listRooms(groupId);
  });
}

export function listPackingUnitsForRoom(roomId: string) {
  return attempt(async () => {
    const actor = await getActor();
    const room = await loadRoomForGroup(roomId);
    await requireGroupAccess(actor, room.groupId);
    return listPackingUnitsSvc(room.groupId, roomId);
  });
}

export function listPackableItems(roomId: string) {
  return attempt(async () => {
    const actor = await getActor();
    const room = await loadRoomForGroup(roomId);
    await requireGroupAccess(actor, room.groupId);
    return listPackableItemsSvc(room.groupId, roomId);
  });
}

export async function resolveInvitedUser(subject: string) {
  return findInvitedUserBySubject(subject);
}

export { provisionEnterpriseUser };

export function listTransportsForGroup(groupId: string, status?: TransportStatus) {
  return attempt(async () => {
    const actor = await getActor();
    await requireGroupAccess(actor, groupId);
    return listTransportsForGroupSvc(groupId, status);
  });
}

export function listWaitingTransportsForAssignment(groupId: string) {
  return attempt(async () => {
    const actor = await getActor();
    await requireGroupAccess(actor, groupId);
    return listWaitingTransportsForAssignmentSvc(groupId);
  });
}

export function listPackingUnitsWithStage(groupId: string) {
  return attempt(async () => {
    const actor = await getActor();
    await requireGroupAccess(actor, groupId);
    return listPackingUnitsWithStageSvc(groupId);
  });
}

export function listItemCatalog() {
  return attempt(async () => {
    await getActor();
    return listItemCatalogSvc();
  });
}

/** Who is viewing, and — when a group is given — their role in it; drives which actions the UI offers. */
export function getViewerAccess(groupId?: string) {
  return attempt(async () => {
    const actor = await getActor();
    const groupRole = groupId ? await getGroupRole(actor, groupId) : null;
    const isAdmin = actor.role === "admin";
    return {
      isAdmin,
      groupRole,
      canManageGroup: isAdmin || groupRole === "manager",
      canCommand: isAdmin || groupRole === "manager" || groupRole === "commander",
    };
  });
}

export function listCatalogTree() {
  return attempt(async () => {
    await getActor();
    return listCatalogTreeSvc();
  });
}

export function listGroupCodes() {
  return attempt(async () => {
    await getActor();
    return listGroupCodesSvc();
  });
}

export function listLocations() {
  return attempt(async () => {
    await getActor();
    return listLocationsSvc();
  });
}

export function listMembershipsForGroup(groupId: string) {
  return attempt(async () => {
    const actor = await getActor();
    await requireGroupAccess(actor, groupId);
    return listMemberships(groupId);
  });
}

export function listActiveUsers() {
  return attempt(async () => {
    await getActor();
    return listActiveUsersSvc();
  });
}

export function listAuditLog() {
  return attempt(async () => {
    const actor = await getActor();
    if (actor.role === "admin") return listAuditEvents(null);
    const groups = await listVisibleGroups(actor);
    return listAuditEvents(groups.map((group) => group.id));
  });
}

export function getGroupOverview(groupId: string) {
  return attempt(async () => {
    const actor = await getActor();
    await requireGroupAccess(actor, groupId);
    const [overview] = await getGroupOverviews([groupId]);
    return overview;
  });
}

export function getDashboardMetrics() {
  return attempt(async () => {
    const actor = await getActor();
    const groups = await listVisibleGroups(actor);
    const groupIds = groups.map((group) => group.id);
    const [overviews, mappedItems] = await Promise.all([
      getGroupOverviews(groupIds),
      countMappedItemsForGroups(groupIds),
    ]);

    const sum = (pick: (overview: (typeof overviews)[number]) => number) =>
      overviews.reduce((total, overview) => total + pick(overview), 0);
    const totalRooms = sum((o) => o.rooms.unstarted + o.rooms.in_progress + o.rooms.completed);
    const totalUnits = sum((o) => o.packingUnits.awaiting_packing + o.packingUnits.packing_in_progress + o.packingUnits.closed);
    const totalTransports = sum((o) => o.transports.waiting + o.transports.transit + o.transports.arrived);

    return {
      groupCount: groups.length,
      roomsInProgress: sum((o) => o.rooms.in_progress),
      mappedItems,
      needsAttention: {
        pausedRooms: sum((o) => o.roomPacking.paused),
        closedUnassignedUnits: sum((o) => o.closedUnassignedUnits),
        transportsInTransit: sum((o) => o.transports.transit),
      },
      progress: {
        mapping: { done: sum((o) => o.rooms.completed), total: totalRooms },
        packing: { done: sum((o) => o.packingUnits.closed), total: totalUnits },
        delivery: { done: sum((o) => o.transports.arrived), total: totalTransports },
      },
    };
  });
}

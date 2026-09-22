import {
  findInvitedUserBySubject,
  provisionEnterpriseUser,
  requireGroupAccess,
} from "@south-operation/server/authorization";
import { HttpError } from "@south-operation/server/errors";
import { listVisibleGroups } from "@south-operation/server/groups";
import {
  listPackableItems as listPackableItemsSvc,
  listPackingUnits as listPackingUnitsSvc,
  loadRoomForGroup,
} from "@south-operation/server/packing";
import { countRoomsInProgressForGroups, listRooms } from "@south-operation/server/rooms";
import {
  countSubmittedReportsForGroups,
  listItemCatalog as listItemCatalogSvc,
  listReports,
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
export type MappingReport = Awaited<ReturnType<typeof listReports>>[number];
export type Transport = Awaited<ReturnType<typeof listTransportsForGroupSvc>>[number];
export type PackingUnitStage = Awaited<ReturnType<typeof listPackingUnitsWithStageSvc>>[number];
export type ItemCatalogEntry = Awaited<ReturnType<typeof listItemCatalogSvc>>[number];

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

export function listReportsForGroup(groupId: string) {
  return attempt(async () => {
    const actor = await getActor();
    await requireGroupAccess(actor, groupId);
    return listReports(groupId);
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

export function getDashboardMetrics() {
  return attempt(async () => {
    const actor = await getActor();
    const groups = await listVisibleGroups(actor);
    const groupIds = groups.map((group) => group.id);
    const [roomsInProgress, reportsSubmitted] = await Promise.all([
      countRoomsInProgressForGroups(groupIds),
      countSubmittedReportsForGroups(groupIds),
    ]);
    return {
      groupCount: groups.length,
      roomsInProgress,
      reportsSubmitted,
    };
  });
}

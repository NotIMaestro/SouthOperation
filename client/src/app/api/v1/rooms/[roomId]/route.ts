import { parseJson } from "@south-operation/server/errors";
import { requireGroupAccess, requireGroupManager } from "@south-operation/server/authorization";
import { loadRoomForGroup } from "@south-operation/server/packing";
import { archiveRoom, getRoomGroupId, updateRoom } from "@south-operation/server/rooms";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { updateRoomSchema, uuidSchema } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ roomId: string }> };

export const GET = apiRoute<RouteContext>(async (_request, context) => {
  const roomId = uuidSchema.parse((await context.params).roomId);
  const actor = await getActor();
  const room = await loadRoomForGroup(roomId);
  await requireGroupAccess(actor, room.groupId);
  return { data: room };
});

export const PATCH = apiRoute<RouteContext>(async (request, context, requestId) => {
  const roomId = uuidSchema.parse((await context.params).roomId);
  const actor = await getActor();
  await requireGroupManager(actor, await getRoomGroupId(roomId));
  const input = updateRoomSchema.parse(await parseJson(request));
  return { data: await updateRoom(actor, roomId, input, requestId) };
});

export const DELETE = apiRoute<RouteContext>(async (_request, context, requestId) => {
  const roomId = uuidSchema.parse((await context.params).roomId);
  const actor = await getActor();
  await requireGroupManager(actor, await getRoomGroupId(roomId));
  return { data: await archiveRoom(actor, roomId, requestId) };
});

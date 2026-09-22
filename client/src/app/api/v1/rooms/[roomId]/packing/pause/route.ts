import { requireGroupAccess } from "@south-operation/server/authorization";
import { loadRoomForGroup, pauseRoomPacking } from "@south-operation/server/packing";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { uuidSchema } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ roomId: string }> };

export const POST = apiRoute<RouteContext>(async (_request, context, requestId) => {
  const roomId = uuidSchema.parse((await context.params).roomId);
  const actor = await getActor();
  const room = await loadRoomForGroup(roomId);
  await requireGroupAccess(actor, room.groupId);
  const data = await pauseRoomPacking(actor, roomId, requestId);
  return { data };
});

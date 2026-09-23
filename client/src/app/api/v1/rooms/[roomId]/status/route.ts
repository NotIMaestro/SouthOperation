import { parseJson } from "@south-operation/server/errors";
import { requireGroupAccess } from "@south-operation/server/authorization";
import { getRoomGroupId, updateRoomStatus } from "@south-operation/server/rooms";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { updateRoomStatusSchema, uuidSchema } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ roomId: string }> };

export const POST = apiRoute<RouteContext>(async (request, context, requestId) => {
  const roomId = uuidSchema.parse((await context.params).roomId);
  const actor = await getActor();
  await requireGroupAccess(actor, await getRoomGroupId(roomId), ["manager", "commander"]);
  const { status } = updateRoomStatusSchema.parse(await parseJson(request));
  return { data: await updateRoomStatus(actor, roomId, status, requestId) };
});

import { parseJson } from "@south-operation/server/errors";
import { requireGroupAccess } from "@south-operation/server/authorization";
import { createPackingUnit, listPackingUnits, loadRoomForGroup } from "@south-operation/server/packing";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { createPackingUnitSchema, uuidSchema } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ roomId: string }> };

export const GET = apiRoute<RouteContext>(async (_request, context) => {
  const roomId = uuidSchema.parse((await context.params).roomId);
  const actor = await getActor();
  const room = await loadRoomForGroup(roomId);
  await requireGroupAccess(actor, room.groupId);
  return { data: await listPackingUnits(room.groupId, roomId) };
});

export const POST = apiRoute<RouteContext>(async (request, context, requestId) => {
  const roomId = uuidSchema.parse((await context.params).roomId);
  const actor = await getActor();
  const room = await loadRoomForGroup(roomId);
  await requireGroupAccess(actor, room.groupId);
  const input = createPackingUnitSchema.parse(await parseJson(request));
  const data = await createPackingUnit(actor, roomId, input, requestId);
  return { data, status: 201 };
});

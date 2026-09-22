import { parseJson } from "@south-operation/server/errors";
import { requireGroupAccess, requireGroupManager } from "@south-operation/server/authorization";
import { createRoom, listRooms } from "@south-operation/server/rooms";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { createRoomSchema, uuidSchema } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ groupId: string }> };

export const GET = apiRoute<RouteContext>(async (_request, context) => {
  const groupId = uuidSchema.parse((await context.params).groupId);
  const actor = await getActor();
  await requireGroupAccess(actor, groupId);
  return { data: await listRooms(groupId) };
});

export const POST = apiRoute<RouteContext>(async (request, context, requestId) => {
  const groupId = uuidSchema.parse((await context.params).groupId);
  const actor = await getActor();
  await requireGroupManager(actor, groupId);
  const input = createRoomSchema.parse(await parseJson(request));
  const data = await createRoom(actor, groupId, input, requestId);
  return { data, status: 201 };
});

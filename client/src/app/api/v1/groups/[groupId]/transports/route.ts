import { parseJson } from "@south-operation/server/errors";
import { requireGroupAccess } from "@south-operation/server/authorization";
import { createTransport, listTransportsForGroup } from "@south-operation/server/transports";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { createTransportSchema, uuidSchema } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ groupId: string }> };

export const GET = apiRoute<RouteContext>(async (_request, context) => {
  const groupId = uuidSchema.parse((await context.params).groupId);
  const actor = await getActor();
  await requireGroupAccess(actor, groupId);
  return { data: await listTransportsForGroup(groupId) };
});

export const POST = apiRoute<RouteContext>(async (request, context, requestId) => {
  const groupId = uuidSchema.parse((await context.params).groupId);
  const actor = await getActor();
  await requireGroupAccess(actor, groupId);
  const input = createTransportSchema.parse(await parseJson(request));
  const data = await createTransport(actor, groupId, input, requestId);
  return { data, status: 201 };
});

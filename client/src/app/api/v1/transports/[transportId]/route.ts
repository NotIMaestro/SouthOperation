import { requireGroupAccess } from "@south-operation/server/authorization";
import { archiveTransport, loadTransportForGroup } from "@south-operation/server/transports";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { uuidSchema } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ transportId: string }> };

export const DELETE = apiRoute<RouteContext>(async (_request, context, requestId) => {
  const transportId = uuidSchema.parse((await context.params).transportId);
  const actor = await getActor();
  const transport = await loadTransportForGroup(transportId);
  await requireGroupAccess(actor, transport.groupId, ["manager", "commander"]);
  return { data: await archiveTransport(actor, transportId, requestId) };
});

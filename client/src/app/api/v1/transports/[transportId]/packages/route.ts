import { parseJson } from "@south-operation/server/errors";
import { requireGroupAccess } from "@south-operation/server/authorization";
import { addTransportPackages, loadTransportForGroup } from "@south-operation/server/transports";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { addTransportPackagesSchema, uuidSchema } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ transportId: string }> };

export const POST = apiRoute<RouteContext>(async (request, context, requestId) => {
  const transportId = uuidSchema.parse((await context.params).transportId);
  const actor = await getActor();
  const transport = await loadTransportForGroup(transportId);
  await requireGroupAccess(actor, transport.groupId);
  const input = addTransportPackagesSchema.parse(await parseJson(request));
  const data = await addTransportPackages(actor, transportId, input, requestId);
  return { data };
});
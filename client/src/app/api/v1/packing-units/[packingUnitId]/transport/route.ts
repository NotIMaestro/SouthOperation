import { parseJson } from "@south-operation/server/errors";
import { requireGroupAccess } from "@south-operation/server/authorization";
import { loadPackingUnitForGroup } from "@south-operation/server/packing";
import { assignPackingUnitToTransport } from "@south-operation/server/transports";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { assignPackingUnitTransportSchema, uuidSchema } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ packingUnitId: string }> };

export const POST = apiRoute<RouteContext>(async (request, context, requestId) => {
  const packingUnitId = uuidSchema.parse((await context.params).packingUnitId);
  const actor = await getActor();
  const unit = await loadPackingUnitForGroup(packingUnitId);
  await requireGroupAccess(actor, unit.groupId);
  const { transportId } = assignPackingUnitTransportSchema.parse(await parseJson(request));
  const data = await assignPackingUnitToTransport(actor, packingUnitId, transportId, requestId);
  return { data };
});

import { requireGroupAccess } from "@south-operation/server/authorization";
import { loadPackingUnitDetail } from "@south-operation/server/packing";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { uuidSchema } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ packingUnitId: string }> };

export const GET = apiRoute<RouteContext>(async (_request, context) => {
  const packingUnitId = uuidSchema.parse((await context.params).packingUnitId);
  const actor = await getActor();
  const unit = await loadPackingUnitDetail(packingUnitId);
  await requireGroupAccess(actor, unit.groupId);
  return { data: unit };
});

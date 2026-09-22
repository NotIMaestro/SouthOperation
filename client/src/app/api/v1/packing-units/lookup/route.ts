import { requireGroupAccess } from "@south-operation/server/authorization";
import { loadPackingUnitDetailByNumber } from "@south-operation/server/packing";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { packingUnitNumberSchema } from "@/lib/api-schemas";

export const GET = apiRoute(async (request) => {
  const unitNumber = packingUnitNumberSchema.parse(new URL(request.url).searchParams.get("unitNumber") ?? "");
  const actor = await getActor();
  const unit = await loadPackingUnitDetailByNumber(unitNumber);
  await requireGroupAccess(actor, unit.groupId);
  return { data: unit };
});

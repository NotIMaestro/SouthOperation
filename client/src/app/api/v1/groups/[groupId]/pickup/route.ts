import { parseJson } from "@south-operation/server/errors";
import { requireGroupAccess } from "@south-operation/server/authorization";
import { confirmUnitPickup, listPickupForGroup } from "@south-operation/server/receiving";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { confirmPickupSchema, uuidSchema } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ groupId: string }> };

export const GET = apiRoute<RouteContext>(async (_request, context) => {
  const groupId = uuidSchema.parse((await context.params).groupId);
  const actor = await getActor();
  await requireGroupAccess(actor, groupId);
  return { data: await listPickupForGroup(groupId) };
});

export const POST = apiRoute<RouteContext>(async (request, context, requestId) => {
  const groupId = uuidSchema.parse((await context.params).groupId);
  const actor = await getActor();
  await requireGroupAccess(actor, groupId);
  const { packingUnitIds } = confirmPickupSchema.parse(await parseJson(request));
  return { data: await confirmUnitPickup(actor, groupId, packingUnitIds, requestId) };
});

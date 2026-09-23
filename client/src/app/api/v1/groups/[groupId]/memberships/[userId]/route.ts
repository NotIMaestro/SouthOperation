import { requireGroupManager } from "@south-operation/server/authorization";
import { removeMembership } from "@south-operation/server/memberships";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { uuidSchema } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ groupId: string; userId: string }> };

export const DELETE = apiRoute<RouteContext>(async (_request, context, requestId) => {
  const params = await context.params;
  const groupId = uuidSchema.parse(params.groupId);
  const userId = uuidSchema.parse(params.userId);
  const actor = await getActor();
  await requireGroupManager(actor, groupId);
  return { data: await removeMembership(actor, groupId, userId, requestId) };
});

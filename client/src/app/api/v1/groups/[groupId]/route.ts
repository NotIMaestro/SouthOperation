import { requireGlobalRole } from "@south-operation/server/authorization";
import { archiveGroup } from "@south-operation/server/groups";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { uuidSchema } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ groupId: string }> };

export const DELETE = apiRoute<RouteContext>(async (_request, context, requestId) => {
  const groupId = uuidSchema.parse((await context.params).groupId);
  const actor = await getActor();
  requireGlobalRole(actor, ["admin"]);
  return { data: await archiveGroup(actor, groupId, requestId) };
});

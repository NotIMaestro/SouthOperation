import { requireGlobalRole } from "@south-operation/server/authorization";
import { archiveSubcategory } from "@south-operation/server/catalog";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { uuidSchema } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ subcategoryId: string }> };

export const DELETE = apiRoute<RouteContext>(async (_request, context, requestId) => {
  const subcategoryId = uuidSchema.parse((await context.params).subcategoryId);
  const actor = await getActor();
  requireGlobalRole(actor, ["admin"]);
  return { data: await archiveSubcategory(actor, subcategoryId, requestId) };
});

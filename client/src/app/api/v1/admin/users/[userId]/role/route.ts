import { parseJson } from "@south-operation/server/errors";
import { requireGlobalRole, setUserRole } from "@south-operation/server/authorization";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { userRoleSchema, uuidSchema } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ userId: string }> };

export const PATCH = apiRoute(async (request, context: RouteContext, requestId) => {
  const actor = await getActor();
  requireGlobalRole(actor, ["admin"]);
  const userId = uuidSchema.parse((await context.params).userId);
  const { role } = userRoleSchema.transform((role) => ({ role })).parse(await parseJson(request));
  return { data: await setUserRole(actor, userId, role, requestId) };
});

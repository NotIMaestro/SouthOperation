import { parseJson } from "@south-operation/server/errors";
import { assignUserToGroup, requireGlobalRole } from "@south-operation/server/authorization";
import { z } from "zod";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { membershipRoleSchema, uuidSchema } from "@/lib/api-schemas";

const assignmentSchema = z.object({ groupId: z.uuid(), role: membershipRoleSchema }).strict();
type RouteContext = { params: Promise<{ userId: string }> };

export const PUT = apiRoute(async (request, context: RouteContext, requestId) => {
  const actor = await getActor();
  requireGlobalRole(actor, ["admin"]);
  const userId = uuidSchema.parse((await context.params).userId);
  const input = assignmentSchema.parse(await parseJson(request));
  await assignUserToGroup(actor, userId, input.groupId, input.role, requestId);
  return { data: { userId, ...input } };
});

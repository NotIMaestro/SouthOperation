import { parseJson } from "@south-operation/server/errors";
import { requireGroupAccess, requireGroupManager } from "@south-operation/server/authorization";
import { addMembership, listMemberships } from "@south-operation/server/memberships";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { addMembershipSchema, uuidSchema } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ groupId: string }> };

export const GET = apiRoute<RouteContext>(async (_request, context) => {
  const groupId = uuidSchema.parse((await context.params).groupId);
  const actor = await getActor();
  await requireGroupAccess(actor, groupId);
  return { data: await listMemberships(groupId) };
});

export const POST = apiRoute<RouteContext>(async (request, context, requestId) => {
  const groupId = uuidSchema.parse((await context.params).groupId);
  const actor = await getActor();
  await requireGroupManager(actor, groupId);
  const input = addMembershipSchema.parse(await parseJson(request));
  const data = await addMembership(actor, groupId, input, requestId);
  return { data, status: 201 };
});

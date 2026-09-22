import { parseJson } from "@south-operation/server/errors";
import { createGroup, listVisibleGroups } from "@south-operation/server/groups";
import { requireGlobalRole } from "@south-operation/server/authorization";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { createGroupSchema } from "@/lib/api-schemas";

export const GET = apiRoute(async () => {
  const actor = await getActor();
  return { data: await listVisibleGroups(actor) };
});

export const POST = apiRoute(async (request, _context, requestId) => {
  const actor = await getActor();
  requireGlobalRole(actor, ["admin"]);
  const input = createGroupSchema.parse(await parseJson(request));
  const data = await createGroup(actor, input, requestId);
  return { data, status: 201 };
});

import { parseJson } from "@south-operation/server/errors";
import { requireGroupAccess } from "@south-operation/server/authorization";
import { confirmTransportReceipt, listReceivingForGroup } from "@south-operation/server/receiving";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { confirmReceiptSchema, uuidSchema } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ groupId: string }> };

export const GET = apiRoute<RouteContext>(async (_request, context) => {
  const groupId = uuidSchema.parse((await context.params).groupId);
  const actor = await getActor();
  await requireGroupAccess(actor, groupId);
  return { data: await listReceivingForGroup(groupId) };
});

export const POST = apiRoute<RouteContext>(async (request, context, requestId) => {
  const groupId = uuidSchema.parse((await context.params).groupId);
  const actor = await getActor();
  await requireGroupAccess(actor, groupId);
  const { transportIds, issues } = confirmReceiptSchema.parse(await parseJson(request));
  return { data: await confirmTransportReceipt(actor, groupId, transportIds, requestId, issues) };
});

import { HttpError, parseJson } from "@south-operation/server/errors";
import { requireGroupAccess } from "@south-operation/server/authorization";
import { createReport, listReports } from "@south-operation/server/reports";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { createReportSchema, uuidSchema } from "@/lib/api-schemas";

export const GET = apiRoute(async (request) => {
  const groupIdValue = new URL(request.url).searchParams.get("groupId");
  if (!groupIdValue) throw new HttpError(400, "MISSING_GROUP_ID", "groupId is required.");
  const groupId = uuidSchema.parse(groupIdValue);
  const actor = await getActor();
  await requireGroupAccess(actor, groupId);
  return { data: await listReports(groupId) };
});

export const POST = apiRoute(async (request, _context, requestId) => {
  const actor = await getActor();
  const { groupId, ...input } = createReportSchema.parse(await parseJson(request));
  await requireGroupAccess(actor, groupId);
  const data = await createReport(actor, groupId, input, requestId);
  return { data, status: 201 };
});

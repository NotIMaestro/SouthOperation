import { requireGroupAccess } from "@south-operation/server/authorization";
import { archiveReport, getReportGroupId } from "@south-operation/server/reports";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { uuidSchema } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ reportId: string }> };

export const DELETE = apiRoute<RouteContext>(async (_request, context, requestId) => {
  const reportId = uuidSchema.parse((await context.params).reportId);
  const actor = await getActor();
  await requireGroupAccess(actor, await getReportGroupId(reportId));
  return { data: await archiveReport(actor, reportId, requestId) };
});

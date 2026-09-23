import { listUsersForAdministration, requireGlobalRole } from "@south-operation/server/authorization";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute(async () => {
  const actor = await getActor();
  requireGlobalRole(actor, ["admin"]);
  return { data: await listUsersForAdministration() };
});

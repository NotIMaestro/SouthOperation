import { parseJson } from "@south-operation/server/errors";
import { requireGlobalRole } from "@south-operation/server/authorization";
import { createCatalogEntry } from "@south-operation/server/catalog";
import { listItemCatalog } from "@south-operation/server/reports";

import { getActor } from "@/lib/actor";
import { apiRoute } from "@/lib/api-route";
import { createCatalogEntrySchema } from "@/lib/api-schemas";

export const GET = apiRoute(async () => {
  await getActor();
  return { data: await listItemCatalog() };
});

export const POST = apiRoute(async (request, _context, requestId) => {
  const actor = await getActor();
  requireGlobalRole(actor, ["admin"]);
  const input = createCatalogEntrySchema.parse(await parseJson(request));
  const data = await createCatalogEntry(actor, input, requestId);
  return { data, status: 201 };
});

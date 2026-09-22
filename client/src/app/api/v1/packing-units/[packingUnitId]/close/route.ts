import { proxyAuthenticatedRequest } from "@/lib/authenticated-proxy";

type RouteContext = { params: Promise<{ packingUnitId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { packingUnitId } = await context.params;
  return proxyAuthenticatedRequest(request, `/v1/packing-units/${encodeURIComponent(packingUnitId)}/close`);
}

import { proxyAuthenticatedRequest } from "@/lib/authenticated-proxy";

type RouteContext = { params: Promise<{ transportUnitId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { transportUnitId } = await context.params;
  return proxyAuthenticatedRequest(
    request,
    `/v1/receiving/transports/${encodeURIComponent(transportUnitId)}/complete`,
  );
}

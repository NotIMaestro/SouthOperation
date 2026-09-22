import { proxyAuthenticatedRequest } from "@/lib/authenticated-proxy";

type RouteContext = { params: Promise<{ roomId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { roomId } = await context.params;
  return proxyAuthenticatedRequest(request, `/v1/rooms/${encodeURIComponent(roomId)}/packing-units`);
}

export async function POST(request: Request, context: RouteContext) {
  const { roomId } = await context.params;
  return proxyAuthenticatedRequest(request, `/v1/rooms/${encodeURIComponent(roomId)}/packing-units`);
}

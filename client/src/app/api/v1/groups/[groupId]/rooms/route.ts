import { proxyAuthenticatedRequest } from "@/lib/authenticated-proxy";

type RouteContext = { params: Promise<{ groupId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { groupId } = await context.params;
  return proxyAuthenticatedRequest(request, `/v1/groups/${encodeURIComponent(groupId)}/rooms`);
}

export async function POST(request: Request, context: RouteContext) {
  const { groupId } = await context.params;
  return proxyAuthenticatedRequest(request, `/v1/groups/${encodeURIComponent(groupId)}/rooms`);
}

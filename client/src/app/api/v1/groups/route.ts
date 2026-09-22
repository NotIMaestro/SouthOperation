import { proxyAuthenticatedRequest } from "@/lib/authenticated-proxy";

export function GET(request: Request) {
  return proxyAuthenticatedRequest(request, "/v1/groups");
}

export async function POST(request: Request) {
  return proxyAuthenticatedRequest(request, "/v1/groups");
}

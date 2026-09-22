import { proxyAuthenticatedRequest } from "@/lib/authenticated-proxy";

export async function GET(request: Request) {
  const search = new URL(request.url).search;
  return proxyAuthenticatedRequest(request, `/v1/mapping-reports${search}`);
}

export async function POST(request: Request) {
  return proxyAuthenticatedRequest(request, "/v1/mapping-reports");
}

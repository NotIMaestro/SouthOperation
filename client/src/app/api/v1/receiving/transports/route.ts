import { proxyAuthenticatedRequest } from "@/lib/authenticated-proxy";

export function GET(request: Request) {
  return proxyAuthenticatedRequest(request, "/v1/receiving/transports");
}

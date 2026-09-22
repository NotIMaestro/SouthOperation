import { proxyServerRequest } from "@/lib/server-api";

export async function proxyAuthenticatedRequest(request: Request, path: string) {
  return proxyServerRequest(request, path);
}

import { proxyServerRequest } from "@/lib/server-api";

export function GET(request: Request) {
  return proxyServerRequest(request, "/health");
}

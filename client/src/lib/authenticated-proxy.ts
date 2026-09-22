import { auth } from "@/auth";
import { proxyServerRequest } from "@/lib/server-api";

export async function proxyAuthenticatedRequest(request: Request, path: string) {
  const session = await auth();
  const internalUserId = session?.user?.id;

  if (!internalUserId) {
    return Response.json(
      {
        error: { code: "UNAUTHENTICATED", message: "Authentication is required." },
        requestId: crypto.randomUUID(),
      },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  return proxyServerRequest(request, path, internalUserId);
}

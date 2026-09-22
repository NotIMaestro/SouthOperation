import { z } from "zod";

const apiEnvSchema = z.object({
  SERVER_API_URL: z.url(),
  INTERNAL_API_SECRET: z.string().min(32),
});

const maxBodyBytes = 1_000_000;

function apiConfig() {
  return apiEnvSchema.parse({
    SERVER_API_URL: process.env.SERVER_API_URL,
    INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
  });
}

async function serverRequest(
  path: string,
  init: RequestInit = {},
  internalUserId?: string,
) {
  const config = apiConfig();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${config.INTERNAL_API_SECRET}`);
  headers.set("Accept", "application/json");
  if (internalUserId) headers.set("X-Internal-User-Id", internalUserId);

  return fetch(new URL(path, config.SERVER_API_URL), {
    ...init,
    cache: "no-store",
    headers,
    signal: AbortSignal.timeout(10_000),
  });
}

export async function resolveInvitedUser(subject: string) {
  const response = await serverRequest("/internal/auth/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject }),
  });

  if (!response.ok) return undefined;
  const payload = z.object({ data: z.object({ id: z.uuid() }) }).parse(await response.json());
  return payload.data;
}

function proxyError(status: number, code: string, message: string) {
  return Response.json(
    { error: { code, message }, requestId: crypto.randomUUID() },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function proxyServerRequest(
  request: Request,
  path: string,
  internalUserId?: string,
) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    return proxyError(413, "PAYLOAD_TOO_LARGE", "The request body is too large.");
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;
  if (body && body.byteLength > maxBodyBytes) {
    return proxyError(413, "PAYLOAD_TOO_LARGE", "The request body is too large.");
  }

  try {
    const headers = new Headers();
    const contentType = request.headers.get("content-type");
    const requestId = request.headers.get("x-request-id");
    if (contentType) headers.set("Content-Type", contentType);
    if (requestId) headers.set("X-Request-Id", requestId);

    const response = await serverRequest(
      path,
      { method: request.method, headers, body },
      internalUserId,
    );
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    for (const name of ["content-type", "x-request-id"]) {
      const value = response.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return proxyError(502, "UPSTREAM_UNAVAILABLE", "The server is temporarily unavailable.");
  }
}

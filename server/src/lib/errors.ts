import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown, requestId: string) {
  if (error instanceof HttpError) {
    return Response.json(
      { error: { code: error.code, message: error.message }, requestId },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "The request body is invalid.",
          fields: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        requestId,
      },
      { status: 400 },
    );
  }

  return Response.json(
    {
      error: { code: "INTERNAL_ERROR", message: "The request could not be completed." },
      requestId,
    },
    { status: 500 },
  );
}

export async function parseJson(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Expected application/json.");
  }

  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }
}

export function requestIdFrom(request: Request) {
  const candidate = request.headers.get("x-request-id");
  return candidate && /^[A-Za-z0-9._-]{1,80}$/.test(candidate)
    ? candidate
    : crypto.randomUUID();
}

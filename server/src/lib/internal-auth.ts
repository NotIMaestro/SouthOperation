import { timingSafeEqual } from "node:crypto";

import { HttpError } from "./errors";

const bearerPrefix = "Bearer ";

export function internalRequestIsAuthorized(
  authorization: string | null,
  expectedSecret: string | undefined = process.env.INTERNAL_API_SECRET,
) {
  if (!authorization?.startsWith(bearerPrefix) || !expectedSecret) return false;

  const provided = Buffer.from(authorization.slice(bearerPrefix.length));
  const expected = Buffer.from(expectedSecret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function requireInternalRequest(request: Request) {
  if (!internalRequestIsAuthorized(request.headers.get("authorization"))) {
    throw new HttpError(401, "UNAUTHENTICATED", "Authentication is required.");
  }
}

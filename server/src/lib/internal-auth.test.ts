import { describe, expect, it } from "vitest";

import { internalRequestIsAuthorized } from "./internal-auth";

describe("internal request authentication", () => {
  const secret = "a-secure-internal-secret-with-at-least-32-chars";

  it("accepts only the exact bearer secret", () => {
    expect(internalRequestIsAuthorized(`Bearer ${secret}`, secret)).toBe(true);
    expect(internalRequestIsAuthorized("Bearer wrong", secret)).toBe(false);
    expect(internalRequestIsAuthorized(null, secret)).toBe(false);
  });
});

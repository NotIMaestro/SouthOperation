import { describe, expect, it } from "vitest";

import { safeAuditMetadata } from "./audit";

describe("safeAuditMetadata", () => {
  it("removes sensitive and credential-like fields", () => {
    expect(
      safeAuditMetadata({
        groupId: "group-1",
        email: "person@example.test",
        contactPhone: "0000000000",
        token: "secret",
        quantity: 2,
      }),
    ).toEqual({ groupId: "group-1", quantity: 2 });
  });
});

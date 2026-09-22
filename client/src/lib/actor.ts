import { requireActor, type Actor } from "@south-operation/server/authorization";

const DEV_BYPASS_USER_ID =
  process.env.DEV_AUTH_BYPASS_USER_ID ?? "00000000-0000-0000-0000-000000000001";

// DEV-ONLY: this branch has no real session yet (see client/src/auth.ts / proxy.ts),
// so every request acts as the seeded local dev user. Swap for a real session
// lookup once auth lands here.
export function getActor(): Promise<Actor> {
  return requireActor(DEV_BYPASS_USER_ID);
}

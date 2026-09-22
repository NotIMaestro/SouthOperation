@AGENTS.md

## Local Supabase connection (per machine)

`client/.env.local` is gitignored (it holds real secrets) and must be created on every machine that runs this app — it is **not** synced through git. Without it, `DATABASE_URL` is empty, `server/src/db/index.ts` throws `"DATABASE_URL is not configured"`, and every Supabase-backed page (groups/rooms/reports/packing/transport) shows a Hebrew "cannot connect" error while pages with no DB dependency keep working fine. This is the usual cause of "it works on my computer but not on X's."

Copy `client/.env.example` to `client/.env.local` and fill in `DATABASE_URL` (Supabase pooler URL, `sslmode=require`) plus `DEV_AUTH_BYPASS=true` / `DEV_AUTH_BYPASS_USER_ID` for local dev. Ask a teammate who already has a working setup for the real values rather than guessing.

# South Operation — מעבר דרומה

Secure, Hebrew-first equipment mapping and relocation system built with Next.js, Microsoft Entra ID, Neon Postgres, and Drizzle ORM.

> This public repository must contain synthetic data only. Never commit identities, operational records, secrets, production exports, or infrastructure credentials.

## Repository layout

```text
SouthOperation/
├── client/                    # Next.js App Router UI and thin HTTP adapters
│   ├── src/app/               # Pages and /api/v1 route handlers
│   ├── src/components/        # Server-first React components
│   ├── src/lib/               # Client-to-server boundary adapters
│   ├── src/auth.ts            # Auth.js + Microsoft Entra ID
│   └── src/proxy.ts           # Protected-route proxy
├── server/                    # Independent Hono HTTP service
│   ├── src/app.ts            # HTTP routes and security middleware
│   ├── src/index.ts          # Local server entry point (port 3001)
│   ├── src/db/                # Drizzle schema and lazy Neon client
│   ├── src/domain/            # Workflow state machines
│   ├── src/lib/               # Authorization, errors, audit filtering
│   ├── src/services/          # Transactional domain services
│   └── drizzle/               # Reviewed SQL migrations
└── docs/                      # Legacy Phase 1 reference material
```

The workspaces have no package dependency on each other. The browser calls same-origin Next.js route handlers; those handlers authenticate the session and proxy to the independent backend over HTTP. The shared `INTERNAL_API_SECRET` authenticates that private hop, and the backend independently reloads the user and enforces object authorization.

## Security model

- Microsoft Entra ID OIDC with organizational MFA policy.
- Invite-only, deny-by-default sign-in: an active `users.external_subject` record must already exist.
- Roles: `admin`, `manager`, `commander`, and `operator`; there is no developer/support production bypass.
- Admins see all groups. Other roles see only active group memberships; managers alone administer their assigned groups.
- Opaque UUIDs and explicit foreign keys replace predictable/prefix-derived identifiers.
- Strict Zod request schemas reject unknown fields and invalid references.
- The backend rejects unauthenticated direct access with constant-time bearer-secret comparison and does not enable browser CORS.
- Mutations write audit and export-outbox events in the same Neon batch.
- `audit_events` is append-only at the database layer.
- Archives are explicit; ordinary application actions do not hard-delete records.
- Security headers are set by Next.js. CSP is report-only until Entra and production telemetry have been verified.
- Errors do not expose stack traces, SQL details, resource existence across authorization boundaries, tokens, or personal data.

## Local prerequisites

- Node.js 20.19 or later
- pnpm 11 or later
- Vercel CLI authenticated to the organization that owns the connected project
- A Microsoft Entra app registration owned by the organization

## Bootstrap order

Do not run migrations or the development server before completing the link and environment checks.

1. Install workspace dependencies:

   ```bash
   pnpm install
   ```

2. Link the existing Vercel project from the repository root:

   ```bash
   vercel link
   ```

3. Provision Neon Postgres through the Vercel Marketplace. Use separate Neon branches for development, preview, and production. Never connect a preview deployment to production data.

4. Register the Entra web application as single-tenant and configure these redirect URIs:

   ```text
   http://localhost:3000/api/auth/callback/microsoft-entra-id
   https://YOUR_PRODUCTION_DOMAIN/api/auth/callback/microsoft-entra-id
   ```

5. Create `client/.env.local` from `client/.env.example` and `server/.env.local` from `server/.env.example`. Use the same high-entropy `INTERNAL_API_SECRET` in both files. Keep `AUTH_SECRET`, the Entra client secret, `INTERNAL_API_SECRET`, `SERVER_API_URL`, and `DATABASE_URL` server-only.

6. Pull each Vercel project's development variables locally, then compare key names without printing values. Run the relevant command from `client/` and `server/`:

   ```bash
   vercel env pull .env.local --yes
   comm -23 \
     <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env.example | cut -d '=' -f 1 | sort -u) \
     <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env.local | cut -d '=' -f 1 | sort -u)
   ```

7. Apply the reviewed migration to the development branch only:

   ```bash
   pnpm db:migrate
   ```

8. Add the first administrator directly through an approved database-administration workflow. Store the Entra object ID in `external_subject`; never use a national identifier as an account key.

9. Start the app:

   ```bash
   pnpm dev
   ```

## Vercel project settings

- Client project: Root Directory `client`, Framework Preset `Next.js`
- Server project: Root Directory `server`, configured as the private API deployment
- Client `SERVER_API_URL` must target the server deployment; never expose `INTERNAL_API_SECRET` as a public variable
- Both projects must receive the same independently generated `INTERNAL_API_SECRET`
- Production region: nearest organization-approved European region
- Production deploys remain gated until Entra, Neon, authorization tests, CSP reports, and backups have been reviewed

For production, restrict the server deployment to calls from the client project in addition to the application-layer bearer secret. Do not permit direct browser access or add permissive CORS headers.

## Commands

```bash
pnpm lint          # ESLint, including Next.js and React rules
pnpm typecheck     # Type-check server and client boundaries
pnpm test          # Workflow and security unit tests
pnpm build         # Local production build (does not deploy)
pnpm dev:client    # Run only Next.js on port 3000
pnpm dev:server    # Run only the backend on port 3001
pnpm dev           # Run both independent processes
pnpm db:generate   # Generate a migration after schema changes
pnpm db:migrate    # Apply migrations; development first
```

## API baseline

- Client proxy: `GET /api/v1/health`
- Client proxy: `GET|POST /api/v1/groups`
- Client proxy: `GET|POST /api/v1/groups/:groupId/rooms`
- Client proxy: `GET|POST /api/v1/mapping-reports?groupId=:groupId`
- Server: the equivalent API is exposed under `/health` and `/v1/*`; `/internal/*` is private

All protected responses use `Cache-Control: no-store`. API expansion should remain versioned and reuse the centralized server authorization policies.

## Current verification

- TypeScript: passing in both workspaces
- ESLint: passing
- Unit tests: passing
- Next.js production build: passing
- Database migration: generated, not applied
- Vercel link/env pull: not completed locally
- Deployment: not performed

The legacy ERD and API documents in `docs/` are reference material. Their known authorization, validation, identifier, status, and soft-delete defects are intentionally not reproduced.

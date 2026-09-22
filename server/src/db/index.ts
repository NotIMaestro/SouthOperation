import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

// `transpilePackages` makes Next.js recompile this module into every route
// bundle, so a module-scoped singleton doesn't survive reloads — each
// instance opened its own postgres.js pool against the Supabase pooler and
// never closed it, exhausting the pooler's connection budget until queries
// just hung. Caching on `globalThis` ties the pool to the actual process
// instead, so reloads/bundles reuse it.
const globalForDb = globalThis as unknown as { __southOperationDb?: Database };

const isProduction = process.env.NODE_ENV === "production";

function createDatabase(): Database {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const client = postgres(databaseUrl, {
    // pgbouncer transaction-mode pooling (port 6543) doesn't support
    // session-level prepared statements.
    prepare: false,
    // Prod runs as Vercel functions: many concurrent warm instances each
    // hold their own pool, so 1 connection each bounds total pooler load.
    // Dev is a single process, so a small pool lets requests run concurrently.
    max: isProduction ? 1 : 10,
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 5,
    // Prevents a stuck query from holding its connection forever.
    connection: { statement_timeout: 10_000 },
  });

  return drizzle(client, { schema });
}

export function getDb(): Database {
  globalForDb.__southOperationDb ??= createDatabase();
  return globalForDb.__southOperationDb;
}

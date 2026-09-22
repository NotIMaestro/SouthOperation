import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "./schema";

let database: ReturnType<typeof createDatabase> | undefined;

function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const client = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });

  return drizzle(client, { schema });
}

export function getDb() {
  database ??= createDatabase();
  return database;
}

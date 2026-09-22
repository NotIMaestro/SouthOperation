import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  INTERNAL_API_SECRET: z.string().min(32),
  SERVER_PORT: z.coerce.number().int().positive().max(65_535).default(3001),
});

export function getServerEnv() {
  return serverEnvSchema.parse(process.env);
}

import { serve } from "@hono/node-server";
import { config } from "dotenv";

import { app } from "./app";

config({ path: ".env.local", quiet: true });

const parsedPort = Number.parseInt(process.env.SERVER_PORT ?? "3001", 10);
const port = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65_535 ? parsedPort : 3001;

serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, (info) => {
  console.log(`South Operation server listening on http://127.0.0.1:${info.port}`);
});

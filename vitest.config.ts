import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./client/src") },
  },
  test: { environment: "node", coverage: { reporter: ["text", "json"] } },
});

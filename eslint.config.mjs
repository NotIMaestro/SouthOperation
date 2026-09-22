import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    settings: {
      next: {
        rootDir: "client/",
      },
    },
  },
  globalIgnores([
    "**/.next/**",
    "**/node_modules/**",
    "coverage/**",
    "server/drizzle/**",
    "server/scripts/**",
  ]),
]);

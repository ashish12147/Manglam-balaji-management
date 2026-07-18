import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  test: {
    coverage: {
      include: ["src/offline/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json-summary"]
    },
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});

import { defineConfig } from "vitest/config";

export default defineConfig({
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

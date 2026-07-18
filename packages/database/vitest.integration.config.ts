import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@manglam/permissions': fileURLToPath(
        new URL('../permissions/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/postgresql.integration.test.ts'],
    pool: 'forks',
    testTimeout: 120_000,
  },
});

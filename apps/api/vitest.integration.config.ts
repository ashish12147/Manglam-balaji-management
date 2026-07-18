import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.integration.spec.ts'],
    passWithNoTests: false,
    restoreMocks: true,
    sequence: {
      concurrent: false,
    },
    testTimeout: 30_000,
  },
});

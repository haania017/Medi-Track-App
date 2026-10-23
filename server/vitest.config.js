import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/setup.js'],
    // One process so a single embedded MongoDB serves the whole run.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    env: { NODE_ENV: 'test', LOG_LEVEL: 'error' },
    testTimeout: 30000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
});

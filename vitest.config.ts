import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['netlify/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    globals: true,
  },
});

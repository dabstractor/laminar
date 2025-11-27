import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      // Handle .js extensions in imports for TypeScript files
    },
  },
  esbuild: {
    target: 'node18',
  },
});

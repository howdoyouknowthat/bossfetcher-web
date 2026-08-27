import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/**/*.test.ts',
      'packages/**/*.test.tsx',
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
    ],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@bossfetcher/contracts': path.resolve(__dirname, 'packages/contracts/src'),
      '@bossfetcher/parser': path.resolve(__dirname, 'packages/parser/src'),
      '@bossfetcher/repository': path.resolve(__dirname, 'packages/repository/src'),
      '@bossfetcher/capture': path.resolve(__dirname, 'packages/capture/src'),
      '@bossfetcher/dashboard': path.resolve(__dirname, 'packages/dashboard/src'),
      '@bossfetcher/analytics': path.resolve(__dirname, 'packages/analytics/src'),
    },
  },
});

/// <reference types="vitest" />

import path from 'path'
import { defineConfig } from 'vitest/config'

/**
 * Vitest config for e2e tests that use the real database.
 * No setup file (avoids the @/db mock), node environment only.
 *
 * Usage: npx vitest run --config vitest.e2e.config.ts
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.e2e.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

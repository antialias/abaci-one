/// <reference types="vitest" />

import path from 'path'
import { defineConfig } from 'vitest/config'

// Locally, cap worker threads (vitest's default is cores - 1): 4 threads use about
// half the memory of 15 for a modest slowdown. VITEST_MAX_THREADS (vitest's own
// env var) overrides it; CI keeps vitest's default.
const localMaxThreads = process.env.CI ? undefined : 4

export default defineConfig({
  esbuild: {
    jsxInject: `import React from 'react'`,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // next-auth's ESM imports `next/server` without an extension, which Node's
    // loader can't resolve; let Vite transform it so tests can load src/auth.ts.
    server: { deps: { inline: ['next-auth'] } },
    ...(localMaxThreads && {
      poolOptions: { threads: { maxThreads: localMaxThreads, minThreads: 1 } },
    }),
    exclude: [
      '**/node_modules/**',
      '**/.next/**',
      '**/e2e/**',
      '**/*.e2e.test.*',
      '**/journey-simulator/**',
      '**/src/db/__tests__/database-connection.test.ts',
      '**/src/test/session-targeting-trace.test.ts',
      '**/src/lib/arcade/__tests__/arcade-session-integration.test.ts',
      '**/src/lib/arcade/__tests__/modal-rooms.test.ts',
      '**/src/lib/arcade/__tests__/orphaned-session-cleanup.test.ts',
      '**/src/lib/arcade/__tests__/room-invitations.test.ts',
      '**/src/app/api/arcade-session/__tests__/route.test.ts',
      '**/src/app/api/worksheets/download/__tests__/route.test.ts',
      '**/src/lib/curriculum/__tests__/updateSessionPlanRemoteCamera.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['json-summary', 'html'],
      reportsDirectory: './coverage',
      reportOnFailure: true,
      thresholds: {
        lines: 14.5,
        branches: 65,
        functions: 30,
        statements: 14.5,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@soroban/llm-client': path.resolve(__dirname, '../../packages/llm-client/src/index.ts'),
      '@styled/css': path.resolve(__dirname, './styled-system/css'),
      '@styled/jsx': path.resolve(__dirname, './styled-system/jsx'),
      '@styled/patterns': path.resolve(__dirname, './styled-system/patterns'),
    },
  },
})

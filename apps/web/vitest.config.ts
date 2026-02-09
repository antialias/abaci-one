/// <reference types="vitest" />

import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: {
    jsxInject: `import React from 'react'`,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: [
      '**/node_modules/**',
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
        autoUpdate: true,
        lines: 16.78,
        branches: 67.9,
        functions: 33.27,
        statements: 16.78,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@styled/css': path.resolve(__dirname, './styled-system/css'),
      '@styled/jsx': path.resolve(__dirname, './styled-system/jsx'),
      '@styled/patterns': path.resolve(__dirname, './styled-system/patterns'),
    },
  },
})
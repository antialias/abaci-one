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
    ],
    coverage: {
      provider: 'v8',
      reporter: ['json-summary', 'html'],
      reportsDirectory: './coverage',
      reportOnFailure: true,
      thresholds: {
        autoUpdate: true,
        lines: 10.91,
        branches: 61.6,
        functions: 19.69,
        statements: 11.38,
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

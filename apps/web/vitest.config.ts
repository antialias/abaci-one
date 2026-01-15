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

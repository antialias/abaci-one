import { defineConfig, devices } from '@playwright/test'

const port = parseInt(process.env.PORT || '3002', 10)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // One worker locally keeps the Mac light; PW_WORKERS overrides it.
  workers: process.env.CI ? 1 : Number(process.env.PW_WORKERS || 1),
  timeout: 15_000,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || `http://localhost:${port}`,
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'auth-setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'tier-setup',
      testMatch: /tier\.setup\.ts/,
      use: { storageState: 'e2e/.auth/admin.json' },
      dependencies: ['auth-setup'],
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['tier-setup'],
    },
  ],

  webServer: process.env.BASE_URL
    ? undefined
    : {
        // Light production server (never a dev server); builds only when the code changed.
        command: `PORT=${port} bash scripts/test-server.sh run`,
        url: `http://localhost:${port}`,
        reuseExistingServer: !process.env.CI,
        // A cold production build takes 2-15 minutes.
        timeout: 20 * 60_000,
        gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
      },
})

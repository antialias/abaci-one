import { defineConfig, devices } from '@playwright/test'

const port = parseInt(process.env.PORT || '3002', 10)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
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
        command: `npm run build && PORT=${port} npm start`,
        url: `http://localhost:${port}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})

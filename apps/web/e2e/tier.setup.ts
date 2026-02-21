/**
 * Playwright setup: ensure admin is on family tier.
 *
 * The admin user has many seed/test practice students. On free tier (limit 1),
 * any test that creates a player will fail. This setup step sets the admin to
 * family tier (unlimited students) so all tests can create players freely.
 *
 * Runs after auth.setup.ts (depends on storage state being ready).
 */

import { test as setup, expect } from '@playwright/test'

setup('set admin to family tier', async ({ request }) => {
  const res = await request.post('/api/debug/billing-set-tier', {
    data: { tier: 'family' },
  })
  expect(res.ok(), `Failed to set family tier: ${await res.text()}`).toBeTruthy()
})

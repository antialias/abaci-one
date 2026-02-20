/**
 * E2E tests for GuestProgressBanner
 *
 * Tests the guest banner behavior on dashboard and summary pages.
 * Uses API interception to simulate guest tier.
 */

import { expect, test, type Page } from '@playwright/test'

/**
 * Create a test player via the debug API.
 */
async function createTestPlayer(page: Page) {
  const response = await page.request.post('/api/debug/practice-session', {
    data: { preset: 'minimal' },
  })
  expect(response.ok(), `Failed to create player: ${await response.text()}`).toBeTruthy()
  const data = await response.json()
  return { playerId: data.playerId, redirectUrl: data.redirectUrl }
}

/**
 * Intercept the billing/tier API to return guest tier.
 */
async function mockGuestTier(page: Page) {
  await page.route('**/api/billing/tier', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tier: 'guest',
        limits: {
          maxPracticeStudents: 1,
          maxSessionMinutes: 10,
          maxSessionsPerWeek: null,
          maxOfflineParsingPerMonth: 3,
        },
      }),
    })
  })
}

/**
 * Set localStorage values for guest session tracking.
 */
async function setGuestLocalStorage(page: Page, sessionCount: number, lastVisitHoursAgo?: number) {
  await page.evaluate(
    ({ count, hoursAgo }) => {
      localStorage.setItem('guest-session-count', count.toString())
      // Clear any dismissed flag
      localStorage.removeItem('guest-banner-dismissed')
      if (hoursAgo !== undefined) {
        const ts = Date.now() - hoursAgo * 60 * 60 * 1000
        localStorage.setItem('guest-last-visit', ts.toString())
      }
    },
    { count: sessionCount, hoursAgo: lastVisitHoursAgo }
  )
}

test.describe('Guest Progress Banner', () => {
  test.setTimeout(60000)
  let cleanupPlayerIds: string[] = []

  test.afterEach(async ({ page }) => {
    for (const id of cleanupPlayerIds) {
      await page.request.delete(`/api/players/${id}`).catch(() => {})
    }
    cleanupPlayerIds = []
  })

  test.describe('Dashboard - persistent banner', () => {
    test('shows banner with no dismiss button when guest has 3+ sessions', async ({ page }) => {
      // Create a test player
      const { playerId } = await createTestPlayer(page)
      cleanupPlayerIds.push(playerId)

      // Mock guest tier
      await mockGuestTier(page)

      // Navigate to home first to set localStorage (needs a page to write to)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      await setGuestLocalStorage(page, 5)

      // Navigate to dashboard
      await page.goto(`/practice/${playerId}/dashboard`)
      await page.waitForLoadState('networkidle')

      // Should show the guest banner
      const banner = page.locator('[data-component="guest-progress-banner"]')
      await expect(banner).toBeVisible({ timeout: 15000 })

      // Should contain the session count message
      await expect(banner).toContainText('5 sessions')

      // Should NOT have a dismiss button (persistent variant)
      const dismissButton = banner.locator('[data-action="dismiss-guest-banner"]')
      await expect(dismissButton).not.toBeVisible()

      // Should have the sign-in link
      const signInLink = banner.locator('[data-action="guest-save-progress"]')
      await expect(signInLink).toBeVisible()
      await expect(signInLink).toHaveAttribute('href', '/auth/signin')
    })

    test('does not show banner when not a guest', async ({ page }) => {
      // Create a test player
      const { playerId } = await createTestPlayer(page)
      cleanupPlayerIds.push(playerId)

      // Do NOT mock guest tier — the authenticated user will have a non-guest tier

      await page.goto('/')
      await page.waitForLoadState('networkidle')
      await setGuestLocalStorage(page, 10)

      await page.goto(`/practice/${playerId}/dashboard`)
      await page.waitForLoadState('networkidle')

      // Wait for page to hydrate
      await page.waitForTimeout(2000)

      // Banner should NOT appear for authenticated (non-guest) users
      const banner = page.locator('[data-component="guest-progress-banner"]')
      await expect(banner).not.toBeVisible()
    })
  })

  test.describe('Summary - dismissible banner', () => {
    test('shows banner with dismiss button after completing a session', async ({ page }) => {
      // Create a test player with a session
      const { playerId, redirectUrl } = await createTestPlayer(page)
      cleanupPlayerIds.push(playerId)

      // Mock guest tier
      await mockGuestTier(page)

      // Navigate to home first to set localStorage
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      await setGuestLocalStorage(page, 3)

      // Navigate to summary page (the redirectUrl typically points to practice,
      // but we need the summary for the dismissible variant)
      await page.goto(`/practice/${playerId}/summary`)
      await page.waitForLoadState('networkidle')

      // Should show the guest banner
      const banner = page.locator('[data-component="guest-progress-banner"]')
      await expect(banner).toBeVisible({ timeout: 15000 })

      // Should have a dismiss button (summary variant is not persistent)
      const dismissButton = banner.locator('[data-action="dismiss-guest-banner"]')
      await expect(dismissButton).toBeVisible()

      // Click dismiss
      await dismissButton.click()

      // Banner should disappear
      await expect(banner).not.toBeVisible()

      // Reload page - banner should stay dismissed
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Wait for hydration
      await page.waitForTimeout(2000)
      await expect(banner).not.toBeVisible()
    })
  })

  test.describe('Returning user banner', () => {
    test('shows welcome back message after 24h+ absence', async ({ page }) => {
      const { playerId } = await createTestPlayer(page)
      cleanupPlayerIds.push(playerId)

      await mockGuestTier(page)

      await page.goto('/')
      await page.waitForLoadState('networkidle')
      // Set 2 sessions and last visit 25 hours ago
      await setGuestLocalStorage(page, 2, 25)

      await page.goto(`/practice/${playerId}/dashboard`)
      await page.waitForLoadState('networkidle')

      const banner = page.locator('[data-component="guest-progress-banner"]')
      await expect(banner).toBeVisible({ timeout: 15000 })
      await expect(banner).toContainText('Welcome back')
    })
  })
})

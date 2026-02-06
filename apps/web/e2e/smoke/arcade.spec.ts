/**
 * Arcade smoke test
 *
 * Verifies that at least one game page loads and renders interactive content.
 */

import { expect, test } from '@playwright/test'

test.describe('Arcade Smoke Tests', () => {
  test.setTimeout(30000)

  test('Memory Pairs game loads', async ({ page }) => {
    await page.goto('/games/matching')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/games\/matching/)

    // Should have interactive content
    await expect(page.locator("button, a, [role='button']").first()).toBeVisible({
      timeout: 15000,
    })

    // Capture screenshot for dashboard
    await page.screenshot({ path: 'screenshots/arcade.png', fullPage: true })
  })
})

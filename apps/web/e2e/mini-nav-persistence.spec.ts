import { expect, test } from '@playwright/test'

test.describe('Mini Navigation Game Name Persistence', () => {
  test('should not show game name when navigating back to games page from a specific game', async ({
    page,
  }) => {
    // Override baseURL for this test to match running dev server
    const baseURL = 'http://localhost:3000'

    // Start at home page
    await page.goto(baseURL)

    // Navigate to games page - should not have game name in mini nav
    await page.click('a[href="/games"]')
    await page.waitForURL('/games')

    // Check that mini nav doesn't show game name initially
    const initialGameName = page.locator('[data-testid="mini-nav-game-name"]')
    await expect(initialGameName).not.toBeVisible()

    // Navigate to Memory Pairs game
    await page.click('a[href="/games/matching"]')
    await page.waitForURL('/games/matching')

    // Verify game name appears in mini nav
    const memoryPairsName = page.locator('text=🧩 Memory Pairs')
    await expect(memoryPairsName).toBeVisible()

    // Navigate back to games page using mini nav
    await page.click('a[href="/games"]')
    await page.waitForURL('/games')

    // BUG: Game name should disappear but it persists
    // This test should FAIL initially, demonstrating the bug
    await expect(memoryPairsName).not.toBeVisible()

    // Also test with Memory Lightning game
    await page.click('a[href="/games/memory-quiz"]')
    await page.waitForURL('/games/memory-quiz')

    // Verify Memory Lightning name appears
    const memoryLightningName = page.locator('text=🧠 Memory Lightning')
    await expect(memoryLightningName).toBeVisible()

    // Navigate back to games page
    await page.click('a[href="/games"]')
    await page.waitForURL('/games')

    // Game name should disappear
    await expect(memoryLightningName).not.toBeVisible()
  })

  test('should show correct game name when switching between different games', async ({ page }) => {
    // Override baseURL for this test to match running dev server
    const baseURL = 'http://localhost:3000'

    // Start at Memory Pairs
    await page.goto(`${baseURL}/games/matching`)
    await expect(page.locator('text=🧩 Memory Pairs')).toBeVisible()

    // Switch to Memory Lightning
    await page.click('a[href="/games/memory-quiz"]')
    await page.waitForURL('/games/memory-quiz')

    // Should show Memory Lightning and NOT Memory Pairs
    await expect(page.locator('text=🧠 Memory Lightning')).toBeVisible()
    await expect(page.locator('text=🧩 Memory Pairs')).not.toBeVisible()

    // Switch back to Memory Pairs
    await page.click('a[href="/games/matching"]')
    await page.waitForURL('/games/matching')

    // Should show Memory Pairs and NOT Memory Lightning
    await expect(page.locator('text=🧩 Memory Pairs')).toBeVisible()
    await expect(page.locator('text=🧠 Memory Lightning')).not.toBeVisible()
  })

  test('should not persist game name when navigating through intermediate pages', async ({
    page,
  }) => {
    // Override baseURL for this test to match running dev server
    const baseURL = 'http://localhost:3000'

    // Start at Memory Pairs game - should show game name
    await page.goto(`${baseURL}/games/matching`)
    const memoryPairsName = page.locator('text=🧩 Memory Pairs')
    await expect(memoryPairsName).toBeVisible()

    // Navigate to Guide page - game name should disappear
    await page.click('a[href="/guide"]')
    await page.waitForURL('/guide')
    await expect(memoryPairsName).not.toBeVisible()

    // Navigate to Games page - game name should still be gone
    await page.click('a[href="/games"]')
    await page.waitForURL('/games')
    await expect(memoryPairsName).not.toBeVisible()

    // Test another path: Game -> Create -> Games
    await page.goto(`${baseURL}/games/memory-quiz`)
    const memoryLightningName = page.locator('text=🧠 Memory Lightning')
    await expect(memoryLightningName).toBeVisible()

    // Navigate to Create page
    await page.click('a[href="/create"]')
    await page.waitForURL('/create')
    await expect(memoryLightningName).not.toBeVisible()

    // Navigate to Games page - should not show any game name
    await page.click('a[href="/games"]')
    await page.waitForURL('/games')
    await expect(memoryLightningName).not.toBeVisible()
    await expect(memoryPairsName).not.toBeVisible()
  })
})

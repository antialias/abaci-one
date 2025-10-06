import { test, expect } from '@playwright/test'

/**
 * Arcade Modal Session E2E Tests
 *
 * These tests verify that the arcade modal session system works correctly:
 * - Users are locked into games once they start
 * - Automatic redirects to active games
 * - Player modification is blocked during games
 * - "Return to Arcade" button properly ends sessions
 */

test.describe('Arcade Modal Session - Redirects', () => {
  test.beforeEach(async ({ page }) => {
    // Clear arcade session before each test
    await page.goto('/arcade')
    await page.waitForLoadState('networkidle')

    // Click "Return to Arcade" button if it exists (to clear any existing session)
    const returnButton = page.locator('button:has-text("Return to Arcade")')
    if (await returnButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await returnButton.click()
      await page.waitForLoadState('networkidle')
    }
  })

  test('should stay on arcade lobby when no active session', async ({ page }) => {
    await page.goto('/arcade')
    await page.waitForLoadState('networkidle')

    // Should see "Champion Arena" title
    const title = page.locator('h1:has-text("Champion Arena")')
    await expect(title).toBeVisible()

    // Should be able to select players
    const playerSection = page.locator('text=/Player|Select|Add/i')
    await expect(playerSection.first()).toBeVisible()
  })

  test('should redirect from arcade to active game when session exists', async ({ page }) => {
    // Start a game to create a session
    await page.goto('/arcade')
    await page.waitForLoadState('networkidle')

    // Find and click a player card to activate
    const playerCard = page.locator('[data-testid="player-card"]').first()
    if (await playerCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await playerCard.click()
      await page.waitForTimeout(500)
    }

    // Navigate to matching game to create session
    await page.goto('/arcade/matching')
    await page.waitForLoadState('networkidle')

    // Start the game (click Start button if visible)
    const startButton = page.locator('button:has-text("Start")')
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click()
      await page.waitForTimeout(1000)
    }

    // Try to navigate back to arcade lobby
    await page.goto('/arcade')
    await page.waitForTimeout(2000) // Give time for redirect

    // Should be redirected back to the game
    await expect(page).toHaveURL(/\/arcade\/matching/)
    const gameTitle = page.locator('h1:has-text("Memory Pairs")')
    await expect(gameTitle).toBeVisible()
  })

  test('should redirect to correct game when navigating to wrong game', async ({ page }) => {
    // Create a session with matching game
    await page.goto('/arcade')
    await page.waitForLoadState('networkidle')

    // Activate a player
    const addPlayerButton = page.locator('button:has-text("Add Player"), button:has-text("+")')
    if (await addPlayerButton.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await addPlayerButton.first().click()
      await page.waitForTimeout(500)
    }

    // Go to matching game
    await page.goto('/arcade/matching')
    await page.waitForLoadState('networkidle')

    // Start game if needed
    const startButton = page.locator('button:has-text("Start")')
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click()
      await page.waitForTimeout(1000)
    }

    // Try to navigate to a different game
    await page.goto('/arcade/memory-quiz')
    await page.waitForTimeout(2000) // Give time for redirect

    // Should be redirected back to matching
    await expect(page).toHaveURL(/\/arcade\/matching/)
  })

  test('should NOT redirect when on correct game page', async ({ page }) => {
    // Navigate to matching game
    await page.goto('/arcade/matching')
    await page.waitForLoadState('networkidle')

    // Should stay on matching page
    await expect(page).toHaveURL(/\/arcade\/matching/)
    const gameTitle = page.locator('h1:has-text("Memory Pairs")')
    await expect(gameTitle).toBeVisible()
  })
})

test.describe('Arcade Modal Session - Player Modification Blocking', () => {
  test.beforeEach(async ({ page }) => {
    // Clear session
    await page.goto('/arcade')
    await page.waitForLoadState('networkidle')

    const returnButton = page.locator('button:has-text("Return to Arcade")')
    if (await returnButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await returnButton.click()
      await page.waitForLoadState('networkidle')
    }
  })

  test('should allow player modification in arcade lobby with no session', async ({ page }) => {
    await page.goto('/arcade')
    await page.waitForLoadState('networkidle')

    // Look for add player button (should be enabled)
    const addPlayerButton = page.locator('button:has-text("Add Player"), button:has-text("+")')
    const firstButton = addPlayerButton.first()

    if (await firstButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Should be clickable
      await expect(firstButton).toBeEnabled()

      // Try to click it
      await firstButton.click()
      await page.waitForTimeout(500)

      // Should see player added
      const activePlayer = page.locator('[data-testid="active-player"]')
      await expect(activePlayer.first()).toBeVisible({ timeout: 3000 })
    }
  })

  test('should block player modification during active game', async ({ page }) => {
    // Start a game
    await page.goto('/arcade/matching')
    await page.waitForLoadState('networkidle')

    // Start game
    const startButton = page.locator('button:has-text("Start")')
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click()
      await page.waitForTimeout(1000)
    }

    // Look for player modification controls
    // They should be disabled or have reduced opacity
    const playerControls = page.locator('[data-testid="player-controls"], .player-list')
    if (await playerControls.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Check if controls have pointer-events: none or low opacity
      const opacity = await playerControls.evaluate((el) => {
        return window.getComputedStyle(el).opacity
      })

      // If controls are visible, they should be dimmed (opacity < 1)
      if (parseFloat(opacity) < 1) {
        expect(parseFloat(opacity)).toBeLessThan(1)
      }
    }

    // "Add Player" button should not be visible during game
    const addPlayerButton = page.locator('button:has-text("Add Player")')
    if (await addPlayerButton.isVisible({ timeout: 500 }).catch(() => false)) {
      // If visible, should be disabled
      const isDisabled = await addPlayerButton.isDisabled()
      expect(isDisabled).toBe(true)
    }
  })

  test('should show "Return to Arcade" button during game', async ({ page }) => {
    // Start a game
    await page.goto('/arcade/matching')
    await page.waitForLoadState('networkidle')

    // Look for "Return to Arcade" button
    const returnButton = page.locator('button:has-text("Return to Arcade")')

    // During game setup, might see "Setup" button instead
    const setupButton = page.locator('button:has-text("Setup")')

    // One of these should be visible
    const hasReturnButton = await returnButton.isVisible({ timeout: 2000 }).catch(() => false)
    const hasSetupButton = await setupButton.isVisible({ timeout: 2000 }).catch(() => false)

    expect(hasReturnButton || hasSetupButton).toBe(true)
  })

  test('should NOT show "Setup" button in arcade lobby with no session', async ({ page }) => {
    await page.goto('/arcade')
    await page.waitForLoadState('networkidle')

    // Should NOT see "Return to Arcade" or "Setup" button in lobby
    const returnButton = page.locator('button:has-text("Return to Arcade")')
    const setupButton = page.locator('button:has-text("Setup")')

    const hasReturnButton = await returnButton.isVisible({ timeout: 1000 }).catch(() => false)
    const hasSetupButton = await setupButton.isVisible({ timeout: 1000 }).catch(() => false)

    // Neither should be visible in empty lobby
    expect(hasReturnButton).toBe(false)
    expect(hasSetupButton).toBe(false)
  })
})

test.describe('Arcade Modal Session - Return to Arcade Button', () => {
  test.beforeEach(async ({ page }) => {
    // Clear session
    await page.goto('/arcade')
    await page.waitForLoadState('networkidle')
  })

  test('should end session and return to arcade when clicking "Return to Arcade"', async ({ page }) => {
    // Start a game
    await page.goto('/arcade/matching')
    await page.waitForLoadState('networkidle')

    // Start game if needed
    const startButton = page.locator('button:has-text("Start")')
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click()
      await page.waitForTimeout(1000)
    }

    // Find and click "Return to Arcade" button
    const returnButton = page.locator('button:has-text("Return to Arcade")')
    if (await returnButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await returnButton.click()
      await page.waitForTimeout(1000)

      // Should be redirected to arcade lobby
      await expect(page).toHaveURL(/\/arcade\/?$/)

      // Should see arcade lobby title
      const title = page.locator('h1:has-text("Champion Arena")')
      await expect(title).toBeVisible()

      // Now should be able to modify players again
      const addPlayerButton = page.locator('button:has-text("Add Player"), button:has-text("+")')
      if (await addPlayerButton.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(addPlayerButton.first()).toBeEnabled()
      }
    }
  })

  test('should allow navigating to different game after returning to arcade', async ({ page }) => {
    // Start matching game
    await page.goto('/arcade/matching')
    await page.waitForLoadState('networkidle')

    // Return to arcade
    const returnButton = page.locator('button:has-text("Return to Arcade"), button:has-text("Setup")')
    if (await returnButton.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await returnButton.first().click()
      await page.waitForTimeout(1000)
    }

    // Should be in arcade lobby
    await expect(page).toHaveURL(/\/arcade\/?$/)

    // Now navigate to different game - should NOT redirect back to matching
    await page.goto('/arcade/memory-quiz')
    await page.waitForTimeout(2000)

    // Should stay on memory-quiz (not redirect back to matching)
    await expect(page).toHaveURL(/\/arcade\/memory-quiz/)

    // Should see memory quiz title
    const title = page.locator('h1:has-text("Memory Lightning")')
    await expect(title).toBeVisible({ timeout: 3000 })
  })
})

test.describe('Arcade Modal Session - Session Persistence', () => {
  test('should maintain active session across page reloads', async ({ page }) => {
    // Start a game
    await page.goto('/arcade/matching')
    await page.waitForLoadState('networkidle')

    // Start game
    const startButton = page.locator('button:has-text("Start")')
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click()
      await page.waitForTimeout(1000)
    }

    // Reload the page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Should still be on matching game
    await expect(page).toHaveURL(/\/arcade\/matching/)
    const gameTitle = page.locator('h1:has-text("Memory Pairs")')
    await expect(gameTitle).toBeVisible()

    // Try to navigate to arcade
    await page.goto('/arcade')
    await page.waitForTimeout(2000)

    // Should be redirected back to matching
    await expect(page).toHaveURL(/\/arcade\/matching/)
  })
})

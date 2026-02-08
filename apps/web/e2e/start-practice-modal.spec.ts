/**
 * E2E tests for the StartPracticeModal
 *
 * Tests the modal's UI interactions, setting controls, and settings persistence.
 * Uses the debug API to create test players with curriculum/skills initialized.
 */

import { expect, test, type Page } from '@playwright/test'

/**
 * Create a test player via the debug API (creates player, initializes curriculum,
 * enables basic skills, and creates a session). Returns the playerId for cleanup.
 */
async function createTestPlayer(page: Page): Promise<string> {
  // Establish session cookies
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const response = await page.request.post('/api/debug/practice-session', {
    data: { preset: 'minimal' },
  })
  expect(response.ok(), `Debug API failed: ${await response.text()}`).toBeTruthy()

  const { playerId } = await response.json()
  expect(playerId).toBeTruthy()
  return playerId
}

/**
 * Navigate to the dashboard and auto-open the StartPracticeModal
 * via the ?startPractice=true query param.
 */
async function openModal(page: Page, playerId: string) {
  await page.goto(`/practice/${playerId}/dashboard?startPractice=true`)
  await page.waitForLoadState('networkidle')

  const modal = page.locator('[data-component="start-practice-modal"]')
  await expect(modal).toBeVisible({ timeout: 15000 })
  return modal
}

/**
 * Expand the settings panel by clicking the config summary.
 */
async function expandSettings(page: Page) {
  const expandButton = page.locator('[data-action="expand-config"]')
  // The summary/expand button might not exist if already expanded
  if (await expandButton.isVisible()) {
    await expandButton.click()
  }
  const expanded = page.locator('[data-section="config-expanded"]')
  // Wait for the CSS transition to complete (maxHeight animates from 0 to 620px)
  await expect(expanded).toHaveCSS('opacity', '1', { timeout: 5000 })
}

test.describe('StartPracticeModal', () => {
  test.setTimeout(60000)

  let cleanupPlayerIds: string[] = []

  test.afterEach(async ({ page }) => {
    for (const id of cleanupPlayerIds) {
      await page.request.delete(`/api/players/${id}`).catch(() => {})
    }
    cleanupPlayerIds = []
  })

  test('modal opens with default settings visible', async ({ page }) => {
    const playerId = await createTestPlayer(page)
    cleanupPlayerIds.push(playerId)

    const modal = await openModal(page, playerId)

    // Modal should show the config summary
    const summary = page.locator('[data-section="config-summary"]')
    await expect(summary).toBeVisible()

    // Duration summary should show the existing plan's duration (1 min from minimal preset)
    const durationValue = page.locator('[data-value="duration-minutes"]')
    await expect(durationValue).toBeVisible()

    // Start button should be visible and ready
    const startButton = page.locator('[data-action="start-practice"]')
    await expect(startButton).toBeVisible()

    // Close button should be visible
    const closeButton = modal.locator('[data-action="close-modal"]')
    await expect(closeButton).toBeVisible()
  })

  test('expand and collapse settings panel', async ({ page }) => {
    const playerId = await createTestPlayer(page)
    cleanupPlayerIds.push(playerId)

    await openModal(page, playerId)

    // Initially collapsed - config-expanded should have opacity 0
    const expanded = page.locator('[data-section="config-expanded"]')
    await expect(expanded).toHaveCSS('opacity', '0')

    // Expand settings
    await expandSettings(page)

    // Settings grid should be visible
    const settingsGrid = page.locator('[data-element="settings-grid"]')
    await expect(settingsGrid).toBeVisible()

    // Duration selector should be visible
    const durationSetting = page.locator('[data-setting="duration"]')
    await expect(durationSetting).toBeVisible()

    // Problem length selector should be visible
    const problemLengthSetting = page.locator('[data-setting="problem-length"]')
    await expect(problemLengthSetting).toBeVisible()

    // Collapse settings
    const collapseButton = page.locator('[data-action="collapse-settings"]')
    await collapseButton.click()

    // Should collapse back
    await expect(expanded).toHaveCSS('opacity', '0', { timeout: 5000 })
  })

  test('duration selection changes active option', async ({ page }) => {
    const playerId = await createTestPlayer(page)
    cleanupPlayerIds.push(playerId)

    await openModal(page, playerId)
    await expandSettings(page)

    // The minimal preset creates a 1-minute session which isn't a selectable option,
    // so no duration option is initially selected. Select 5 minutes first.
    await page.locator('[data-option="duration-5"]').click()
    await expect(page.locator('[data-option="duration-5"]')).toHaveAttribute(
      'data-selected',
      'true'
    )

    // Select 20 minutes — 5 should deselect
    await page.locator('[data-option="duration-20"]').click()
    await expect(page.locator('[data-option="duration-20"]')).toHaveAttribute(
      'data-selected',
      'true'
    )
    await expect(page.locator('[data-option="duration-5"]')).toHaveAttribute(
      'data-selected',
      'false'
    )

    // Select 10 minutes — 20 should deselect
    await page.locator('[data-option="duration-10"]').click()
    await expect(page.locator('[data-option="duration-10"]')).toHaveAttribute(
      'data-selected',
      'true'
    )
    await expect(page.locator('[data-option="duration-20"]')).toHaveAttribute(
      'data-selected',
      'false'
    )

    // Select 15 minutes
    await page.locator('[data-option="duration-15"]').click()
    await expect(page.locator('[data-option="duration-15"]')).toHaveAttribute(
      'data-selected',
      'true'
    )
  })

  test('problem length selection changes active option', async ({ page }) => {
    const playerId = await createTestPlayer(page)
    cleanupPlayerIds.push(playerId)

    await openModal(page, playerId)
    await expandSettings(page)

    // Default should be 'recommended'
    await expect(page.locator('[data-option="length-recommended"]')).toHaveAttribute(
      'data-selected',
      'true'
    )

    // Select 'shorter'
    await page.locator('[data-option="length-shorter"]').click()
    await expect(page.locator('[data-option="length-shorter"]')).toHaveAttribute(
      'data-selected',
      'true'
    )
    await expect(page.locator('[data-option="length-recommended"]')).toHaveAttribute(
      'data-selected',
      'false'
    )

    // Select 'longer'
    await page.locator('[data-option="length-longer"]').click()
    await expect(page.locator('[data-option="length-longer"]')).toHaveAttribute(
      'data-selected',
      'true'
    )
    await expect(page.locator('[data-option="length-shorter"]')).toHaveAttribute(
      'data-selected',
      'false'
    )
  })

  test('game break toggle works', async ({ page }) => {
    const playerId = await createTestPlayer(page)
    cleanupPlayerIds.push(playerId)

    await openModal(page, playerId)
    await expandSettings(page)

    const gameBreakSetting = page.locator('[data-setting="game-break"]')

    // Game break section might not be visible if only 1 practice mode is enabled
    // (the minimal preset only enables abacus). If not visible, skip this test.
    if (!(await gameBreakSetting.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip()
      return
    }

    const toggleButton = page.locator('[data-action="toggle-game-break"]')
    await expect(toggleButton).toBeVisible()

    // Get initial state text
    const initialText = await toggleButton.textContent()
    const isInitiallyOn = initialText?.includes('On')

    // Toggle
    await toggleButton.click()

    // Verify state changed
    const afterToggleText = await toggleButton.textContent()
    if (isInitiallyOn) {
      expect(afterToggleText).toContain('Off')
    } else {
      expect(afterToggleText).toContain('On')
    }

    // Toggle back
    await toggleButton.click()
    const restoredText = await toggleButton.textContent()
    if (isInitiallyOn) {
      expect(restoredText).toContain('On')
    } else {
      expect(restoredText).toContain('Off')
    }
  })

  test('close button closes the modal', async ({ page }) => {
    const playerId = await createTestPlayer(page)
    cleanupPlayerIds.push(playerId)

    const modal = await openModal(page, playerId)

    // Click close button
    await modal.locator('[data-action="close-modal"]').click()

    // Modal should disappear
    await expect(modal).not.toBeVisible({ timeout: 5000 })
  })

  test('config summary shows correct duration after change', async ({ page }) => {
    const playerId = await createTestPlayer(page)
    cleanupPlayerIds.push(playerId)

    await openModal(page, playerId)
    await expandSettings(page)

    // Change duration to 15 minutes
    await page.locator('[data-option="duration-15"]').click()
    await expect(page.locator('[data-option="duration-15"]')).toHaveAttribute(
      'data-selected',
      'true'
    )

    // Collapse and check summary
    await page.locator('[data-action="collapse-settings"]').click()

    // Wait for collapse animation
    const expanded = page.locator('[data-section="config-expanded"]')
    await expect(expanded).toHaveCSS('opacity', '0', { timeout: 5000 })

    // Summary should show updated duration
    const durationValue = page.locator('[data-value="duration-minutes"]')
    await expect(durationValue).toHaveText('15')
  })

  test('save indicator appears when changing settings', async ({ page }) => {
    const playerId = await createTestPlayer(page)
    cleanupPlayerIds.push(playerId)

    await openModal(page, playerId)
    await expandSettings(page)

    // Change a setting to trigger save
    await page.locator('[data-option="duration-15"]').click()

    // "Saving..." should appear within the debounce window
    const saveStatus = page.locator('[data-element="save-status"]')
    await expect(saveStatus).toBeVisible({ timeout: 3000 })
    // It should show "Saving..." first
    await expect(saveStatus).toContainText('Saving', { timeout: 3000 })

    // After the debounced mutation completes, should show "Saved"
    await expect(saveStatus).toContainText('Saved', { timeout: 10000 })
  })

  test('settings persist across modal close and reopen', async ({ page }) => {
    const playerId = await createTestPlayer(page)
    cleanupPlayerIds.push(playerId)

    await openModal(page, playerId)
    await expandSettings(page)

    // Make both changes quickly so they're batched in a single debounce cycle
    await page.locator('[data-option="duration-15"]').click()
    await page.locator('[data-option="length-shorter"]').click()

    // Verify both options took effect
    await expect(page.locator('[data-option="duration-15"]')).toHaveAttribute(
      'data-selected',
      'true'
    )
    await expect(page.locator('[data-option="length-shorter"]')).toHaveAttribute(
      'data-selected',
      'true'
    )

    // Wait for save to complete, then ensure no further debounced saves are pending
    const saveStatus = page.locator('[data-element="save-status"]')
    await expect(saveStatus).toContainText('Saved', { timeout: 10000 })
    await page.waitForTimeout(1500)
    // If a second debounce cycle triggered, wait for it too
    if (await saveStatus.textContent().then((t) => t?.includes('Saving'))) {
      await expect(saveStatus).toContainText('Saved', { timeout: 10000 })
    }

    // Collapse settings first so the close button is in the viewport
    await page.locator('[data-action="collapse-settings"]').click()
    const expanded = page.locator('[data-section="config-expanded"]')
    await expect(expanded).toHaveCSS('opacity', '0', { timeout: 5000 })

    // Close the modal
    const modal = page.locator('[data-component="start-practice-modal"]')
    await modal.locator('[data-action="close-modal"]').click()
    await expect(modal).not.toBeVisible({ timeout: 5000 })

    // Reopen the modal by navigating again
    await openModal(page, playerId)
    await expandSettings(page)

    // Settings should be persisted (saved preferences override existing plan's 1-min duration)
    await expect(page.locator('[data-option="duration-15"]')).toHaveAttribute(
      'data-selected',
      'true',
      { timeout: 10000 }
    )
    await expect(page.locator('[data-option="length-shorter"]')).toHaveAttribute(
      'data-selected',
      'true'
    )
  })

  test('settings persist across page reload', async ({ page }) => {
    const playerId = await createTestPlayer(page)
    cleanupPlayerIds.push(playerId)

    await openModal(page, playerId)
    await expandSettings(page)

    // Change duration to 20 minutes
    await page.locator('[data-option="duration-20"]').click()
    await expect(page.locator('[data-option="duration-20"]')).toHaveAttribute(
      'data-selected',
      'true'
    )

    // Wait for save to complete and ensure no further debounced saves are pending
    const saveStatus = page.locator('[data-element="save-status"]')
    await expect(saveStatus).toContainText('Saved', { timeout: 10000 })
    await page.waitForTimeout(1500)
    if (await saveStatus.textContent().then((t) => t?.includes('Saving'))) {
      await expect(saveStatus).toContainText('Saved', { timeout: 10000 })
    }

    // Full page reload
    await page.goto(`/practice/${playerId}/dashboard?startPractice=true`)
    await page.waitForLoadState('networkidle')

    const modal = page.locator('[data-component="start-practice-modal"]')
    await expect(modal).toBeVisible({ timeout: 15000 })
    await expandSettings(page)

    // Duration should still be 20 minutes after reload
    // (saved preferences override the existing plan's 1-min duration)
    await expect(page.locator('[data-option="duration-20"]')).toHaveAttribute(
      'data-selected',
      'true',
      { timeout: 10000 }
    )
  })

  test('settings are independent per student', async ({ page }) => {
    // Create two test players
    const playerA = await createTestPlayer(page)
    cleanupPlayerIds.push(playerA)
    const playerB = await createTestPlayer(page)
    cleanupPlayerIds.push(playerB)

    const saveStatus = page.locator('[data-element="save-status"]')

    // Save settings for player A: 5 min, longer (click quickly to batch in one debounce)
    await openModal(page, playerA)
    await expandSettings(page)

    await page.locator('[data-option="duration-5"]').click()
    await page.locator('[data-option="length-longer"]').click()

    await expect(page.locator('[data-option="duration-5"]')).toHaveAttribute(
      'data-selected',
      'true'
    )
    await expect(page.locator('[data-option="length-longer"]')).toHaveAttribute(
      'data-selected',
      'true'
    )

    await expect(saveStatus).toContainText('Saved', { timeout: 10000 })
    await page.waitForTimeout(1500)
    if (await saveStatus.textContent().then((t) => t?.includes('Saving'))) {
      await expect(saveStatus).toContainText('Saved', { timeout: 10000 })
    }

    // Save different settings for player B: 20 min, shorter
    await openModal(page, playerB)
    await expandSettings(page)

    await page.locator('[data-option="duration-20"]').click()
    await page.locator('[data-option="length-shorter"]').click()

    await expect(page.locator('[data-option="duration-20"]')).toHaveAttribute(
      'data-selected',
      'true'
    )
    await expect(page.locator('[data-option="length-shorter"]')).toHaveAttribute(
      'data-selected',
      'true'
    )

    await expect(saveStatus).toContainText('Saved', { timeout: 10000 })
    await page.waitForTimeout(1500)
    if (await saveStatus.textContent().then((t) => t?.includes('Saving'))) {
      await expect(saveStatus).toContainText('Saved', { timeout: 10000 })
    }

    // Go back to player A — should still have 5 min + longer
    await openModal(page, playerA)
    await expandSettings(page)

    await expect(page.locator('[data-option="duration-5"]')).toHaveAttribute(
      'data-selected',
      'true',
      { timeout: 10000 }
    )
    await expect(page.locator('[data-option="length-longer"]')).toHaveAttribute(
      'data-selected',
      'true'
    )

    // Go back to player B — should still have 20 min + shorter
    await openModal(page, playerB)
    await expandSettings(page)

    await expect(page.locator('[data-option="duration-20"]')).toHaveAttribute(
      'data-selected',
      'true',
      { timeout: 10000 }
    )
    await expect(page.locator('[data-option="length-shorter"]')).toHaveAttribute(
      'data-selected',
      'true'
    )
  })

  test('no save indicator on initial modal open', async ({ page }) => {
    const playerId = await createTestPlayer(page)
    cleanupPlayerIds.push(playerId)

    await openModal(page, playerId)
    await expandSettings(page)

    // Save status should not be visible on first open (no changes yet)
    const saveStatus = page.locator('[data-element="save-status"]')
    await expect(saveStatus).not.toBeVisible()
  })

  test('game break duration selection works', async ({ page }) => {
    const playerId = await createTestPlayer(page)
    cleanupPlayerIds.push(playerId)

    await openModal(page, playerId)
    await expandSettings(page)

    const gameBreakSetting = page.locator('[data-setting="game-break"]')

    // Skip if game break section not visible (single mode only)
    if (!(await gameBreakSetting.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip()
      return
    }

    // Ensure game breaks are enabled
    const toggleButton = page.locator('[data-action="toggle-game-break"]')
    const toggleText = await toggleButton.textContent()
    if (toggleText?.includes('Off')) {
      await toggleButton.click()
    }

    // Duration options should be visible
    const durationElement = page.locator('[data-element="game-break-duration"]')
    await expect(durationElement).toBeVisible()

    // Try selecting a different game break duration
    const option3 = page.locator('[data-option="game-break-3"]')
    if (await option3.isVisible()) {
      await option3.click()
      await expect(option3).toHaveAttribute('data-selected', 'true')
    }
  })
})

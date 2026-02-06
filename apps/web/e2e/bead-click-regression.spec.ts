/**
 * Regression test for GitHub issue #1:
 * "Bead click swallowed by gesture handler — requires double-click"
 *
 * AbacusAnimatedBead uses @use-gesture/react for drag gestures. A bug
 * caused the gesture handler to set `hasGestureTriggered` even on simple
 * clicks (when the pointer moved slightly), blocking the next click event.
 *
 * The fix ensures `hasGestureTriggered` is only set when a real drag
 * occurred, so normal clicks always pass through on the first attempt.
 *
 * This test enters help mode (which renders an interactive abacus with
 * gesture-enabled beads) and verifies that single bead clicks register.
 */

import { expect, test, type Page } from '@playwright/test'

async function createSessionForHelpMode(page: Page, terms: number[]) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const response = await page.request.post('/api/debug/practice-session', {
    data: {
      preset: 'minimal',
      overrideProblemTerms: terms,
    },
  })
  expect(response.ok(), `API failed: ${await response.text()}`).toBeTruthy()

  const { playerId, redirectUrl } = await response.json()
  expect(playerId).toBeTruthy()

  await page.goto(redirectUrl)
  await page.waitForLoadState('networkidle')

  return { playerId }
}

/**
 * Type a digit to trigger help mode via prefix sum matching,
 * then wait for the interactive help abacus to appear.
 */
async function triggerHelpMode(page: Page, digit: string) {
  const activeSession = page.locator('[data-component="active-session"]')
  await expect(activeSession).toHaveAttribute('data-phase', 'inputting', { timeout: 15000 })

  // Wait for keyboard detection to resolve
  await expect(page.locator('[data-action="submit"]')).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(200)

  // Type digit to trigger help mode (unambiguous prefix sum)
  await page.keyboard.press(digit)

  // Wait for help overlay and abacus to appear
  const helpOverlay = page.locator('[data-component="practice-help-overlay"]')
  await expect(helpOverlay).toBeVisible({ timeout: 10000 })

  const helpAbacus = helpOverlay.locator('[data-component="help-abacus"]')
  await expect(helpAbacus).toHaveAttribute('data-visibility', 'visible', { timeout: 5000 })

  return { helpOverlay, helpAbacus }
}

test.describe('Bead single-click regression (issue #1)', () => {
  test.setTimeout(60000)

  let cleanupPlayerId: string | null = null

  test.afterEach(async ({ page }) => {
    if (cleanupPlayerId) {
      await page.request.delete(`/api/players/${cleanupPlayerId}`).catch(() => {})
      cleanupPlayerId = null
    }
  })

  test('single bead click registers on help abacus', async ({ page }) => {
    // Problem: 3 + 12 = 15
    // Prefix sums: [3, 15]
    // Typing "3" matches prefix sum 3 unambiguously
    // ("3" is not a digit-prefix of "15") → immediate help mode
    // Help abacus: value 3, target 15
    const { playerId } = await createSessionForHelpMode(page, [3, 12])
    cleanupPlayerId = playerId

    const { helpAbacus } = await triggerHelpMode(page, '3')

    // At value 3 on a soroban, ones column (place value 1) has:
    //   earth beads 0, 1, 2 = active (pushed up toward the bar)
    //   earth bead 3 = inactive (pushed down)
    // Clicking bead 3 should activate it → value goes from 3 to 4
    const targetBead = helpAbacus.locator('[data-testid="bead-place-1-earth-pos-3"]')
    await expect(targetBead).toBeVisible({ timeout: 5000 })
    await expect(targetBead).toHaveClass(/\binactive\b/)

    // === CORE REGRESSION TEST ===
    // Single click the bead. If the bug were present (gesture handler
    // swallowing click events), this click would not register.
    await targetBead.click()

    // Bead should now be active — single click registered successfully.
    // The class changes from "abacus-bead inactive" to "abacus-bead active".
    await expect(targetBead).toHaveClass(/\bactive\b/, { timeout: 3000 })
    // Double-check: "inactive" should no longer be present
    await expect(targetBead).not.toHaveClass(/\binactive\b/)
  })

  test('bead click with mouse movement still registers', async ({ page }) => {
    // Same setup as above, but simulate a more realistic human click
    // where the mouse moves slightly during the click action.
    const { playerId } = await createSessionForHelpMode(page, [3, 12])
    cleanupPlayerId = playerId

    const { helpAbacus } = await triggerHelpMode(page, '3')

    const targetBead = helpAbacus.locator('[data-testid="bead-place-1-earth-pos-3"]')
    await expect(targetBead).toBeVisible({ timeout: 5000 })
    await expect(targetBead).toHaveClass(/\binactive\b/)

    // Simulate a click with slight mouse movement (realistic human click)
    const box = await targetBead.boundingBox()
    if (!box) throw new Error('Target bead not visible for bounding box')
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    await page.mouse.move(cx, cy)
    await page.mouse.down()
    // Move mouse slightly during click (2px) — below gesture threshold
    // but enough to trigger useDrag's movement tracking
    await page.mouse.move(cx + 2, cy - 2, { steps: 3 })
    await page.mouse.up()

    // Bead should still register as active from the click
    await expect(targetBead).toHaveClass(/\bactive\b/, { timeout: 3000 })
    await expect(targetBead).not.toHaveClass(/\binactive\b/)
  })
})

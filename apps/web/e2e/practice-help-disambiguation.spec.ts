/**
 * Regression test for GitHub issue #2:
 * "Abacus help mode intercepts digit input when answer is prefixed with any prefix sum"
 *
 * When a problem like 4 + 30 + 10 = 44 is presented, typing "4" (the first digit
 * of "44") matches the prefix sum 4, which is ambiguous — it could be the user
 * requesting help or the first digit of the final answer. The system should wait
 * 4 seconds (awaitingDisambiguation) before showing help, giving the user time
 * to type the second digit.
 *
 * The bug was that after help mode activated (via timer or otherwise), typing a
 * digit to exit help would immediately re-enter help mode instead of going through
 * the disambiguation flow.
 */

import { expect, test, type Page } from '@playwright/test'

async function createSessionWithProblem(page: Page, terms: number[]) {
  // Establish session cookies
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

test.describe('Practice help disambiguation (issue #2)', () => {
  test.setTimeout(60000)

  let cleanupPlayerId: string | null = null

  test.afterEach(async ({ page }) => {
    if (cleanupPlayerId) {
      await page.request.delete(`/api/players/${cleanupPlayerId}`).catch(() => {})
      cleanupPlayerId = null
    }
  })

  test('typing answer quickly does not trigger help mode when answer starts with a prefix sum', async ({
    page,
  }) => {
    // Problem: 4 + 30 + 10 = 44
    // Prefix sums: [4, 34, 44]
    // Typing "4" matches prefix sum 4 but is also the first digit of 44
    const { playerId } = await createSessionWithProblem(page, [4, 30, 10])
    cleanupPlayerId = playerId

    // Wait for the active session to be in inputting phase
    const activeSession = page.locator('[data-component="active-session"]')
    await expect(activeSession).toHaveAttribute('data-phase', 'inputting', { timeout: 15000 })

    // Type both digits of the answer quickly — no pause between them
    await page.keyboard.press('4')
    await page.keyboard.press('4')

    // The help overlay should never have appeared
    const helpOverlay = page.locator('[data-component="practice-help-overlay"]')
    await expect(helpOverlay).not.toBeVisible()

    // The session should have auto-submitted the correct answer (44)
    // and transitioned to showingFeedback or transitioning
    await expect(activeSession).not.toHaveAttribute('data-phase', 'helpMode', { timeout: 5000 })
  })

  test('typing answer after help mode dismissal goes through disambiguation, not back to help', async ({
    page,
  }) => {
    // Same problem: 4 + 30 + 10 = 44
    const { playerId } = await createSessionWithProblem(page, [4, 30, 10])
    cleanupPlayerId = playerId

    const activeSession = page.locator('[data-component="active-session"]')
    await expect(activeSession).toHaveAttribute('data-phase', 'inputting', { timeout: 15000 })

    // Type "4" — should go to awaitingDisambiguation
    await page.keyboard.press('4')
    await expect(activeSession).toHaveAttribute('data-phase', 'awaitingDisambiguation', {
      timeout: 2000,
    })

    // Wait for the disambiguation timer to fire (4 seconds) → helpMode
    const helpOverlay = page.locator('[data-component="practice-help-overlay"]')
    await expect(helpOverlay).toBeVisible({ timeout: 6000 })
    await expect(activeSession).toHaveAttribute('data-phase', 'helpMode')

    // Now type "4" to exit help — should go to awaitingDisambiguation, NOT back to helpMode
    await page.keyboard.press('4')
    await expect(activeSession).toHaveAttribute('data-phase', 'awaitingDisambiguation', {
      timeout: 2000,
    })

    // Quickly type the second "4" to complete the answer
    await page.keyboard.press('4')

    // Should auto-submit correct answer — phase should move past inputting
    // (showingFeedback, transitioning, or complete)
    await expect(helpOverlay).not.toBeVisible({ timeout: 5000 })
  })
})

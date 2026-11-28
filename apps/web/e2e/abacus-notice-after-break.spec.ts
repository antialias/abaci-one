/**
 * The abacus notice sits right before the part it is about (plan §8 A19):
 * abacus part → game break → visualization part shows no notice on the
 * transition screen before the break, and "Put your abacus aside" after it,
 * before part 2's first problem. A reload before that problem shows it again.
 */
import { type APIRequestContext, expect, type Page, test } from '@playwright/test'

async function createDebugSession(page: Page) {
  // Abacus then visualization, one problem each, an auto-start game break between them
  const response = await page.request.post('/api/debug/practice-session', {
    data: { preset: 'game-break' },
  })
  expect(response.ok(), `API failed: ${await response.text()}`).toBeTruthy()
  const { playerId, redirectUrl } = await response.json()
  return { playerId: String(playerId), redirectUrl: String(redirectUrl) }
}

async function cleanupPlayer(request: APIRequestContext, playerId: string) {
  await request.delete(`/api/players/${playerId}`).catch(() => {})
}

async function submitCurrentCorrectAnswer(page: Page) {
  const problem = page.locator('[data-component="vertical-problem"]')
  await expect(problem).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-action="submit"]')).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(200)
  const value = await problem.getAttribute('data-correct-answer')
  if (!value) throw new Error('No data-correct-answer on vertical problem')
  for (const digit of value) {
    await page.keyboard.press(digit)
    await page.waitForTimeout(40)
  }
  await page.waitForTimeout(250)
  const stillActive = await page
    .locator('[data-component="vertical-problem"][data-status="active"]')
    .isVisible()
  if (stillActive) await page.keyboard.press('Enter')
}

test.describe('The abacus notice after a game break', () => {
  test.setTimeout(90_000)

  test('abacus → break → visualization: no notice before the break, "Put your abacus aside" after it', async ({
    page,
  }) => {
    const { playerId, redirectUrl } = await createDebugSession(page)
    try {
      await page.goto(redirectUrl)
      await page.waitForLoadState('networkidle')
      await submitCurrentCorrectAnswer(page)

      // Before the break: the transition screen, with no abacus notice
      const transition = page.locator('[data-component="part-transition-screen"]')
      await expect(transition).toBeVisible({ timeout: 15000 })
      await expect(transition.locator('[data-element="abacus-action"]')).toHaveCount(0)
      await page.locator('[data-action="skip-transition"]').click()

      // The break
      await expect(page.locator('[data-component="game-break-screen"]')).toBeVisible({
        timeout: 15000,
      })
      const skip = page.locator('[data-action="skip-break"]')
      await expect(skip).toBeVisible({ timeout: 15000 })
      await skip.click()

      // After the break: the notice, before part 2's first problem
      const notice = page.locator('[data-component="abacus-notice-screen"]')
      await expect(notice).toBeVisible({ timeout: 15000 })
      await expect(notice.locator('[data-element="abacus-action"]')).toHaveText(
        /Put your abacus aside/
      )
      await expect(page.locator('[data-component="active-session"]')).toHaveCount(0)

      // A reload before the part's first try derives it again
      await page.reload()
      await expect(notice).toBeVisible({ timeout: 15000 })

      // Continue: part 2's first problem
      await page.locator('[data-action="continue-abacus-notice"]').click()
      await expect(notice).toHaveCount(0)
      await expect(
        page.locator('[data-component="vertical-problem"][data-status="active"]')
      ).toBeVisible({ timeout: 15000 })
    } finally {
      await cleanupPlayer(page.request, playerId)
    }
  })
})

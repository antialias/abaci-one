import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

async function createDebugSession(page: Page) {
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

async function runSingleIteration(page: Page) {
  const { playerId, redirectUrl } = await createDebugSession(page)
  try {
    await page.goto(redirectUrl)
    await page.waitForLoadState('networkidle')

    await submitCurrentCorrectAnswer(page)

    const transition = page.locator('[data-component="part-transition-screen"]')
    await expect(transition).toBeVisible({ timeout: 15000 })
    await page.locator('[data-action="skip-transition"]').click()

    const gameBreak = page.locator('[data-component="game-break-screen"]')
    const practiceResumed = page.locator(
      '[data-component="vertical-problem"][data-status="active"]'
    )

    const winner = await Promise.race([
      gameBreak
        .waitFor({ state: 'visible', timeout: 6000 })
        .then(() => 'game-break')
        .catch(() => null),
      practiceResumed
        .waitFor({ state: 'visible', timeout: 6000 })
        .then(() => 'practice')
        .catch(() => null),
    ])

    if (winner !== 'game-break') {
      throw new Error('Reproduced: practice resumed after transition without opening game break')
    }
  } finally {
    await cleanupPlayer(page.request, playerId)
  }
}

test.describe('Game Break Race Repro', () => {
  test.setTimeout(Number(process.env.REPRO_TIMEOUT_MS ?? '900000'))

  test('skip-transition still opens game break (repeat)', async ({ page }) => {
    const iterations = Number(process.env.REPRO_ITERS ?? '40')
    for (let i = 0; i < iterations; i++) {
      await runSingleIteration(page)
    }
  })
})

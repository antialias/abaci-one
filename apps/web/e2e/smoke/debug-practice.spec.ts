/**
 * Debug practice session smoke test
 *
 * Creates a debug session via API, walks through the full practice flow:
 * problem → game break → problem → session complete.
 *
 * Two variants:
 * 1. Play matching game to completion (with deliberate mismatches)
 * 2. Skip game break (tests the skip path)
 *
 * Uses React fiber tree to read correct answers and card data,
 * and keyboard input for answer submission.
 */

import { expect, test, type Page } from '@playwright/test'

/**
 * Create a debug practice session and navigate to the practice page.
 */
async function setupDebugSession(page: Page) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const response = await page.request.post('/api/debug/practice-session', {
    data: { preset: 'game-break' },
  })
  expect(response.ok(), `API failed: ${await response.text()}`).toBeTruthy()

  const { playerId, redirectUrl } = await response.json()
  expect(playerId).toBeTruthy()

  await page.goto(redirectUrl)
  await page.waitForLoadState('networkidle')

  return { playerId }
}

/**
 * Read the correct answer from the React fiber tree of the vertical problem component.
 */
async function getCorrectAnswer(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-component="vertical-problem"]')
    if (!el) throw new Error('No vertical-problem element found')
    const fiberKey = Object.keys(el).find((k) => k.startsWith('__reactFiber'))
    if (!fiberKey) throw new Error('No React fiber found')
    let fiber = (el as any)[fiberKey]
    for (let i = 0; i < 50 && fiber; i++) {
      if (fiber.memoizedProps?.correctAnswer != null) {
        return fiber.memoizedProps.correctAnswer as number
      }
      fiber = fiber.return
    }
    throw new Error('correctAnswer not found in fiber tree')
  })
}

/**
 * Submit the correct answer by typing it on the keyboard.
 * The practice session auto-submits when the correct digits are entered.
 *
 * Handles keyboard detection: ActiveSession gates keyboard input on
 * `hasPhysicalKeyboard` (starts null, resolves via heuristic after ~100ms).
 * We wait for detection to complete before typing digits.
 */
async function submitCorrectAnswer(page: Page) {
  // Wait for the problem to render
  await expect(page.locator('[data-component="vertical-problem"]')).toBeVisible({ timeout: 15000 })

  // Wait for keyboard detection to resolve — the keydown handler is only registered
  // when hasPhysicalKeyboard becomes true. The heuristic fires after 100ms, but we also
  // need React to re-render. Wait for submit button to be actionable as a proxy.
  await expect(page.locator('[data-action="submit"]')).toBeVisible({ timeout: 5000 })
  // Small additional delay for the keydown listener to be registered after state update
  await page.waitForTimeout(200)

  const answer = await getCorrectAnswer(page)
  const digits = String(answer)
  for (const digit of digits) {
    await page.keyboard.press(digit)
    // Small delay between digits to ensure each is processed
    await page.waitForTimeout(50)
  }

  // Wait briefly for auto-submit to trigger, then press Enter as fallback
  await page.waitForTimeout(300)
  // Check if problem is still visible (auto-submit didn't fire)
  const problemStillVisible = await page.locator('[data-component="vertical-problem"][data-status="active"]').isVisible()
  if (problemStillVisible) {
    await page.keyboard.press('Enter')
  }
}

/**
 * Submit correct answer, wait for game break to appear.
 */
async function submitPart1AndWaitForGameBreak(page: Page) {
  await submitCorrectAnswer(page)

  const gameBreakOrTransition = page.locator(
    '[data-component="game-break-screen"], [data-component="part-transition-screen"]'
  )
  await expect(gameBreakOrTransition.first()).toBeVisible({ timeout: 20000 })
}

/**
 * After game break is resolved, submit Part 2 and verify session completes.
 */
async function submitPart2AndVerifyCompletion(page: Page) {
  const gameBreakScreen = page.locator('[data-component="game-break-screen"]')
  await expect(gameBreakScreen).not.toBeVisible({ timeout: 15000 })

  await submitCorrectAnswer(page)

  await expect(page).toHaveURL(/\/summary/, { timeout: 15000 })
}

/**
 * Read matching game card data via data attributes.
 */
async function readCardData(page: Page) {
  return page.evaluate(() => {
    const dataCards = document.querySelectorAll('[data-component="matching-card"]')
    if (dataCards.length === 0) throw new Error('No matching cards found')
    return Array.from(dataCards).map((el) => ({
      id: el.getAttribute('data-card-id')!,
      number: parseInt(el.getAttribute('data-card-number')!, 10),
      type: el.getAttribute('data-card-type')!,
    }))
  })
}

/**
 * Click a matching card by its data-card-id attribute.
 */
async function clickMatchingCard(page: Page, cardId: string) {
  await page.locator(`[data-card-id="${cardId}"]`).click()
}

/**
 * Wait for the matching game to be fully idle (no processing, no mismatch feedback,
 * no actively flipped cards). Uses data-game-idle attribute on the grid element,
 * falling back to card-level data attributes for backward compatibility.
 */
async function waitForGameIdle(page: Page, timeout = 15000) {
  await page.waitForFunction(
    () => {
      // Prefer grid-level idle indicator (most reliable, includes isProcessingMove check)
      const grid = document.querySelector('[data-element="matching-grid"]')
      if (grid && grid.getAttribute('data-game-idle') !== null) {
        return grid.getAttribute('data-game-idle') === 'true'
      }

      // Fallback: check card-level data attributes
      const cards = document.querySelectorAll('[data-component="matching-card"]')
      if (cards.length === 0) return false
      const activelyFlipped = document.querySelectorAll(
        '[data-component="matching-card"][data-card-flipped="true"]:not([data-card-matched="true"])'
      )
      return activelyFlipped.length === 0
    },
    { timeout }
  )
}

/**
 * Wait for a specific number of matched pairs (card pairs with data-card-matched="true").
 */
async function waitForMatchedCount(page: Page, expectedCount: number, timeout = 15000) {
  await page.waitForFunction(
    (count) => {
      const matched = document.querySelectorAll('[data-component="matching-card"][data-card-matched="true"]')
      return matched.length >= count * 2 // 2 cards per pair
    },
    expectedCount,
    { timeout }
  )
}

/**
 * Play the matching game to completion.
 * Makes at least 2 deliberate mismatches before solving all pairs.
 */
async function playMatchingGame(page: Page) {
  // Wait for game break screen to enter "playing" phase
  await expect(
    page.locator('[data-component="game-break-screen"][data-phase="playing"]')
  ).toBeVisible({ timeout: 20000 })

  // Wait for cards to render
  await page.waitForFunction(() => {
    return document.querySelectorAll('[data-component="matching-card"]').length > 0
  }, { timeout: 10000 })

  const cards = await readCardData(page)

  // Group cards into pairs by number
  const pairsByNumber = new Map<number, { abacus: string; number: string }>()
  for (const card of cards) {
    if (!pairsByNumber.has(card.number)) {
      pairsByNumber.set(card.number, { abacus: '', number: '' })
    }
    const pair = pairsByNumber.get(card.number)!
    if (card.type === 'abacus') pair.abacus = card.id
    else pair.number = card.id
  }
  const pairs = Array.from(pairsByNumber.entries())
  expect(pairs.length).toBeGreaterThanOrEqual(3)

  // --- 2 deliberate mismatches ---
  // Use non-overlapping card sets: mismatch 1 uses pairs[0]+[1], mismatch 2 uses pairs[2]+[3]
  // to avoid any interaction between mismatches
  for (let i = 0; i < 2; i++) {
    const idx = i * 2 // 0, 2
    const [, pairA] = pairs[idx]
    const [, pairB] = pairs[idx + 1]

    // Wait for game to be fully idle before starting
    await waitForGameIdle(page)

    await clickMatchingCard(page, pairA.abacus)
    // Wait for first card flip to register
    await page.waitForFunction(
      (cardId) => {
        const card = document.querySelector(`[data-card-id="${cardId}"]`)
        return card?.getAttribute('data-card-flipped') === 'true'
      },
      pairA.abacus,
      { timeout: 5000 }
    )

    await clickMatchingCard(page, pairB.number) // Wrong pair!
    // Wait for second card flip to register
    await page.waitForFunction(
      (cardId) => {
        const card = document.querySelector(`[data-card-id="${cardId}"]`)
        return card?.getAttribute('data-card-flipped') === 'true'
      },
      pairB.number,
      { timeout: 5000 }
    )

    // Wait for mismatch to fully clear (server processes + 1.5s delay + state update)
    await waitForGameIdle(page)
  }

  // --- Solve all pairs correctly ---
  let matchedSoFar = 0
  for (let i = 0; i < pairs.length; i++) {
    const [, pair] = pairs[i]
    // Skip already matched pairs
    const matchedAttr = await page.locator(`[data-card-id="${pair.abacus}"]`).getAttribute('data-card-matched')
    if (matchedAttr === 'true') continue

    // Wait for game to be idle before each match attempt
    await waitForGameIdle(page)

    await clickMatchingCard(page, pair.abacus)
    // Wait for first card flip
    await page.waitForFunction(
      (cardId) => {
        const card = document.querySelector(`[data-card-id="${cardId}"]`)
        return card?.getAttribute('data-card-flipped') === 'true'
      },
      pair.abacus,
      { timeout: 5000 }
    )

    await clickMatchingCard(page, pair.number)

    matchedSoFar++
    const isLastPair = matchedSoFar === pairs.length

    if (isLastPair) {
      // Last pair — game auto-transitions to results, game container disappears
      break
    }

    // Wait for match to be acknowledged by server
    await waitForMatchedCount(page, matchedSoFar)
  }

  // Game should auto-transition to results
  await expect(page.locator('[data-component="game-break-results-screen"]')).toBeVisible({
    timeout: 15000,
  })

  await page.locator('[data-action="continue-to-practice"]').click()
}

test.describe('Debug Practice Session', () => {
  test.setTimeout(120000)

  let cleanupPlayerId: string | null = null

  test.afterEach(async ({ page }) => {
    if (cleanupPlayerId) {
      await page.request.delete(`/api/players/${cleanupPlayerId}`).catch(() => {})
      cleanupPlayerId = null
    }
  })

  test('play matching game to completion', async ({ page }) => {
    const { playerId } = await setupDebugSession(page)
    cleanupPlayerId = playerId

    await submitPart1AndWaitForGameBreak(page)
    await playMatchingGame(page)
    await submitPart2AndVerifyCompletion(page)
  })

  test('skip game break', async ({ page }) => {
    const { playerId } = await setupDebugSession(page)
    cleanupPlayerId = playerId

    await submitPart1AndWaitForGameBreak(page)

    const gameBreakScreen = page.locator('[data-component="game-break-screen"]')
    await expect(gameBreakScreen).toBeVisible({ timeout: 20000 })

    const skipButton = page.locator('[data-action="skip-break"]')
    await expect(skipButton).toBeVisible({ timeout: 15000 })
    await skipButton.click()

    await submitPart2AndVerifyCompletion(page)
  })
})

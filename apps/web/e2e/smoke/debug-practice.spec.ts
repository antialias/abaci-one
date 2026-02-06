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
 * Read matching game card data. Tries data attributes first (fast),
 * falls back to React fiber tree (works even without data attributes).
 */
async function readCardData(page: Page) {
  return page.evaluate(() => {
    // Try data attributes first
    const dataCards = document.querySelectorAll('[data-component="matching-card"]')
    if (dataCards.length > 0) {
      return {
        source: 'data-attributes' as const,
        cards: Array.from(dataCards).map((el) => ({
          id: el.getAttribute('data-card-id')!,
          number: parseInt(el.getAttribute('data-card-number')!, 10),
          type: el.getAttribute('data-card-type')!,
        })),
      }
    }

    // Fallback: read from React fiber tree via MemoryGrid
    const gameContainer = document.querySelector('[data-element="game-container"]')
    if (!gameContainer) throw new Error('No game container')
    const allDivs = gameContainer.querySelectorAll('div')
    const cardDivs = Array.from(allDivs).filter(
      (d) => window.getComputedStyle(d).aspectRatio === '3 / 4'
    )
    if (cardDivs.length === 0) throw new Error('No card divs found')

    const fiberKey = Object.keys(cardDivs[0]).find((k) => k.startsWith('__reactFiber'))
    if (!fiberKey) throw new Error('No fiber')
    let fiber = (cardDivs[0] as any)[fiberKey]
    for (let i = 0; i < 20 && fiber; i++) {
      if (fiber.type?.name === 'MemoryGrid') {
        const state = fiber.memoizedProps.state
        return {
          source: 'fiber' as const,
          cards: state.gameCards.map((c: any) => ({
            id: c.id,
            number: c.number,
            type: c.type,
          })),
        }
      }
      fiber = fiber.return
    }
    throw new Error('MemoryGrid not found in fiber tree')
  })
}

/**
 * Click a matching card by its id. Uses data attribute or falls back to fiber-based index.
 */
async function clickMatchingCard(page: Page, cardId: string) {
  // Try data attribute selector first
  const dataCard = page.locator(`[data-card-id="${cardId}"]`)
  if ((await dataCard.count()) > 0) {
    await dataCard.click()
    return
  }

  // Fallback: find the card index from the fiber tree and click by position
  await page.evaluate((targetId) => {
    const gameContainer = document.querySelector('[data-element="game-container"]')!
    const allDivs = gameContainer.querySelectorAll('div')
    const cardDivs = Array.from(allDivs).filter(
      (d) => window.getComputedStyle(d).aspectRatio === '3 / 4'
    )
    const fiberKey = Object.keys(cardDivs[0]).find((k) => k.startsWith('__reactFiber'))!
    let fiber = (cardDivs[0] as any)[fiberKey]
    for (let i = 0; i < 20 && fiber; i++) {
      if (fiber.type?.name === 'MemoryGrid') {
        const cards = fiber.memoizedProps.state.gameCards
        const idx = cards.findIndex((c: any) => c.id === targetId)
        if (idx >= 0) cardDivs[idx].click()
        return
      }
      fiber = fiber.return
    }
  }, cardId)
}

/**
 * Wait for the matching game to finish processing (no flipped cards, not processing).
 */
async function waitForGameIdle(page: Page, timeout = 5000) {
  await page.waitForFunction(
    () => {
      const gc = document.querySelector('[data-element="game-container"]')
      if (!gc) return false
      const divs = gc.querySelectorAll('div')
      const cardDivs = Array.from(divs).filter(
        (d) => window.getComputedStyle(d).aspectRatio === '3 / 4'
      )
      if (cardDivs.length === 0) return false
      const fKey = Object.keys(cardDivs[0]).find((k) => k.startsWith('__reactFiber'))
      if (!fKey) return false
      let f = (cardDivs[0] as any)[fKey]
      for (let i = 0; i < 20 && f; i++) {
        if (f.type?.name === 'MemoryGrid') {
          const s = f.memoizedProps.state
          return s.flippedCards.length === 0 && !s.isProcessingMove && !s.showMismatchFeedback
        }
        f = f.return
      }
      return false
    },
    { timeout }
  )
}

/**
 * Wait for a specific card to be matched.
 */
async function waitForCardMatched(page: Page, cardId: string, timeout = 5000) {
  // Try data attribute first
  const dataCard = page.locator(`[data-card-id="${cardId}"][data-card-matched="true"]`)
  if ((await page.locator(`[data-card-id="${cardId}"]`).count()) > 0) {
    await expect(dataCard).toBeVisible({ timeout })
    return
  }

  // Fallback: poll fiber tree
  await page.waitForFunction(
    (targetId) => {
      const gc = document.querySelector('[data-element="game-container"]')
      if (!gc) return false
      const divs = gc.querySelectorAll('div')
      const cardDivs = Array.from(divs).filter(
        (d) => window.getComputedStyle(d).aspectRatio === '3 / 4'
      )
      if (cardDivs.length === 0) return false
      const fKey = Object.keys(cardDivs[0]).find((k) => k.startsWith('__reactFiber'))
      if (!fKey) return false
      let f = (cardDivs[0] as any)[fKey]
      for (let i = 0; i < 20 && f; i++) {
        if (f.type?.name === 'MemoryGrid') {
          const card = f.memoizedProps.state.gameCards.find((c: any) => c.id === targetId)
          return card?.matched === true
        }
        f = f.return
      }
      return false
    },
    cardId,
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

  // Wait for cards to render (either data attributes or aspect-ratio divs)
  await page.waitForFunction(() => {
    const dataCards = document.querySelectorAll('[data-component="matching-card"]')
    if (dataCards.length > 0) return true
    const gc = document.querySelector('[data-element="game-container"]')
    if (!gc) return false
    const divs = gc.querySelectorAll('div')
    return Array.from(divs).filter((d) => window.getComputedStyle(d).aspectRatio === '3 / 4').length > 0
  }, { timeout: 10000 })

  const { cards } = await readCardData(page)

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

  let mismatchCount = 0

  // --- 2 deliberate mismatches ---
  for (let i = 0; i < 2 && i + 1 < pairs.length; i++) {
    const [, pairA] = pairs[i]
    const [, pairB] = pairs[i + 1]

    await clickMatchingCard(page, pairA.abacus)
    await page.waitForTimeout(300)
    await clickMatchingCard(page, pairB.number) // Wrong pair!

    // Wait for mismatch to clear
    await waitForGameIdle(page)
    mismatchCount++
  }
  expect(mismatchCount).toBe(2)

  // --- Solve all pairs correctly ---
  for (const [, pair] of pairs) {
    // Check if already matched
    const isMatched = await page.evaluate(
      (targetId) => {
        const gc = document.querySelector('[data-element="game-container"]')
        if (!gc) return false
        const divs = gc.querySelectorAll('div')
        const cardDivs = Array.from(divs).filter(
          (d) => window.getComputedStyle(d).aspectRatio === '3 / 4'
        )
        if (cardDivs.length === 0) return false
        const fKey = Object.keys(cardDivs[0]).find((k) => k.startsWith('__reactFiber'))
        if (!fKey) return false
        let f = (cardDivs[0] as any)[fKey]
        for (let i = 0; i < 20 && f; i++) {
          if (f.type?.name === 'MemoryGrid') {
            return f.memoizedProps.state.gameCards.find((c: any) => c.id === targetId)?.matched === true
          }
          f = f.return
        }
        return false
      },
      pair.abacus
    )
    if (isMatched) continue

    await clickMatchingCard(page, pair.abacus)
    await page.waitForTimeout(300)
    await clickMatchingCard(page, pair.number)
    await waitForCardMatched(page, pair.abacus)
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

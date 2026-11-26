/**
 * End-to-end check of retry / do-over attribution in a real practice session.
 *
 * Each test seeds its own "⚡ Fast Responder" student (mid-L1, tutorials done,
 * mostly strong skills), generates a 1-minute plan (abacus + visualization,
 * 3 + 2 problems, game break between parts), and drives the session with the
 * keyboard. Every check reads both the screen and the plan the server holds.
 *
 * Run against an already-running server:
 *   BASE_URL=http://localhost:3021 npx playwright test retry-redo-attribution --workers=1
 */
import { type APIRequestContext, expect, type Page, test } from '@playwright/test'

const SHOTS = process.env.RF_SHOTS_DIR ?? '/tmp/rf-e2e'

interface Problem {
  terms: number[]
  answer: number
}
interface Slot {
  slotId: string
  problem: Problem
}
interface Result {
  slotId?: string
  partNumber: number
  slotIndex: number
  originalSlotIndex?: number
  epochNumber?: number
  isRetry?: boolean
  isManualRedo?: boolean
  isCorrect: boolean
  studentAnswer: number
  problem: Problem
}
interface Plan {
  id: string
  status: string
  flowState: string
  currentPartIndex: number
  currentSlotIndex: number
  parts: { type: string; slots: Slot[] }[]
  results: Result[]
  retryState: Record<
    string,
    {
      currentEpoch: number
      currentRetryIndex: number
      currentEpochItems: { originalSlotIndex: number }[]
      pendingRetries: { originalSlotIndex: number }[]
      redeemedSlots?: number[]
    }
  > | null
}

// ---------------------------------------------------------------------------
// Setup: seed a student and start a short two-part session
// ---------------------------------------------------------------------------

async function seedStudent(request: APIRequestContext): Promise<string> {
  const seed = await request.post('/api/debug/seed-students', {
    data: { profiles: ['⚡ Fast Responder'] },
  })
  expect(seed.ok(), await seed.text()).toBeTruthy()
  const { taskId } = await seed.json()
  let playerId = ''
  await expect
    .poll(
      async () => {
        const r = await request.get(`/api/admin/tasks?taskId=${taskId}`)
        const { task } = await r.json()
        for (const e of task.events) {
          if (e.eventType !== 'student_completed') continue
          const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload
          playerId = payload.playerId
        }
        return task.status
      },
      { timeout: 90_000 }
    )
    .toBe('completed')
  expect(playerId).not.toBe('')
  return playerId
}

async function startSession(request: APIRequestContext, playerId: string): Promise<Plan> {
  const gen = await request.post(`/api/curriculum/${playerId}/sessions/plans`, {
    data: {
      durationMinutes: 1,
      enabledParts: { abacus: true, visualization: true, linear: false },
      gameBreakSettings: {
        enabled: true,
        maxDurationMinutes: 1,
        selectionMode: 'auto-start',
        selectedGame: 'matching',
        skipSetupPhase: true,
        useAdaptiveSelection: false,
      },
    },
  })
  expect(gen.status(), await gen.text()).toBe(202)
  let planId = ''
  await expect
    .poll(
      async () => {
        const r = await request.get(`/api/curriculum/${playerId}/sessions/plans`)
        planId = (await r.json()).plan?.id ?? ''
        return planId
      },
      { timeout: 60_000 }
    )
    .not.toBe('')
  for (const action of ['approve', 'start']) {
    const r = await request.patch(`/api/curriculum/${playerId}/sessions/plans/${planId}`, {
      data: { action },
    })
    expect(r.ok(), `${action}: ${await r.text()}`).toBeTruthy()
  }
  const plan = await getPlan(request, playerId, planId)
  // The scenarios below rely on a part of at least 3 problems before a second part
  expect(plan.parts.length).toBeGreaterThanOrEqual(2)
  expect(plan.parts[0].slots.length).toBeGreaterThanOrEqual(3)
  return plan
}

async function getPlan(request: APIRequestContext, playerId: string, planId: string) {
  const r = await request.get(`/api/curriculum/${playerId}/sessions/plans/${planId}`)
  expect(r.ok()).toBeTruthy()
  return (await r.json()).plan as Plan
}

async function cleanupPlayer(request: APIRequestContext, playerId: string) {
  await request.delete(`/api/players/${playerId}`).catch(() => {})
}

// ---------------------------------------------------------------------------
// Page instrumentation: interaction phases and toasts, recorded as they happen
// ---------------------------------------------------------------------------

async function instrument(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __phases: (string | null)[]
      __toasts: string[]
      __lastPhase?: string | null
    }
    w.__phases = []
    w.__toasts = []
    const record = () => {
      const el = document.querySelector('[data-component="active-session"]')
      const phase = el?.getAttribute('data-phase') ?? null
      if (phase !== w.__lastPhase) {
        w.__lastPhase = phase
        w.__phases.push(phase)
      }
      for (const t of document.querySelectorAll('li[data-swipe-direction]')) {
        const text = (t as HTMLElement).innerText.trim()
        if (text && !w.__toasts.includes(text)) w.__toasts.push(text)
      }
    }
    new MutationObserver(record).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-phase'],
    })
  })
}

const toasts = (page: Page) =>
  page.evaluate(() => (window as unknown as { __toasts: string[] }).__toasts)

const phaseMark = (page: Page) =>
  page.evaluate(() => (window as unknown as { __phases: unknown[] }).__phases.length)

// ---------------------------------------------------------------------------
// Screen reading and input
// ---------------------------------------------------------------------------

const activeProblem = (page: Page) =>
  page.locator(
    '[data-element="problem-container"] [data-component="vertical-problem"][data-status="active"]'
  )

/**
 * Waits until the session accepts input and nothing covers the problem (the
 * "Let's practice those again!" countdown), then reads the problem on screen.
 */
async function shownProblem(page: Page): Promise<Problem> {
  await expect(page.locator('[data-component="retry-transition-screen"]')).toHaveCount(0, {
    timeout: 20_000,
  })
  await expect(page.locator('[data-component="active-session"]')).toHaveAttribute(
    'data-phase',
    'inputting',
    { timeout: 20_000 }
  )
  const problem = activeProblem(page)
  await expect(problem).toBeVisible()
  const answer = Number(await problem.getAttribute('data-correct-answer'))
  const terms = await problem.locator('[data-element="term-row"]').evaluateAll((rows) =>
    rows.map((row) => {
      const text = (row as HTMLElement).innerText
      const digits = Number(text.replace(/\D/g, ''))
      return /[−-]/.test(text) ? -digits : digits
    })
  )
  return { terms, answer }
}

const sameProblem = (a: Problem, b: Problem) =>
  a.answer === b.answer && a.terms.join(',') === b.terms.join(',')

/** Waits until the submit was taken (the phase left inputting). */
async function waitSubmitted(page: Page, mark: number) {
  await expect
    .poll(
      () =>
        page.evaluate(
          (m) =>
            (window as unknown as { __phases: string[] }).__phases
              .slice(m)
              .some((p) => p === 'submitting' || p === 'showingFeedback'),
          mark
        ),
      { timeout: 10_000 }
    )
    .toBe(true)
}

/**
 * Presses the first key until the problem shows it. The keyboard listener is
 * attached in an effect after the problem renders, so a key pressed in that
 * window is dropped (a real kid just presses again).
 */
async function pressFirstKey(page: Page, key: string) {
  const cells = activeProblem(page).locator('[data-element="answer-cell"]')
  await expect(async () => {
    if ((await cells.count()) === 0) await page.keyboard.press(key)
    await expect(cells).not.toHaveCount(0, { timeout: 1000 })
  }).toPass({ timeout: 10_000 })
}

async function typeCorrect(page: Page, p: Problem, opts: { doublePress?: boolean } = {}) {
  const mark = await phaseMark(page)
  const digits = String(p.answer)
  await pressFirstKey(page, digits[0])
  await page.keyboard.type(digits.slice(1))
  // A correct answer auto-submits; an extra Enter is the kid's double press
  if (opts.doublePress) await page.keyboard.press('Enter')
  await waitSubmitted(page, mark)
}

async function typeWrong(page: Page, p: Problem) {
  const mark = await phaseMark(page)
  // Three corrections switch the problem to manual submit, which accepts any digits
  await pressFirstKey(page, '0')
  await page.keyboard.press('Backspace')
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('0')
    await page.keyboard.press('Backspace')
  }
  await page.keyboard.type(String(p.answer + 1))
  await page.keyboard.press('Enter')
  await waitSubmitted(page, mark)
}

const isWrite =
  (action: string) => (r: { request(): { method(): string; postData(): string | null } }) => {
    if (r.request().method() !== 'PATCH') return false
    try {
      return JSON.parse(r.request().postData() ?? '{}').action === action
    } catch {
      return false
    }
  }

/** Answers the problem on screen and waits for the server's reply to that write. */
async function answer(
  page: Page,
  planId: string,
  correct: boolean,
  opts: { doublePress?: boolean } = {}
) {
  const p = await shownProblem(page)
  const reply = page.waitForResponse((r) => r.url().includes(planId) && isWrite('record')(r))
  if (correct) await typeCorrect(page, p, opts)
  else await typeWrong(page, p)
  const res = await reply
  return { shown: p, status: res.status() }
}

/** Taps a finished problem's dot in the current part to start a do-over. */
async function startDoOver(page: Page, slotIndex: number) {
  await shownProblem(page)
  const dot = page.locator(
    `[data-element="expanded-section"] button[data-slot-index="${slotIndex}"][data-clickable-for-redo]`
  )
  await dot.click()
  await expect(page.locator('[data-element="redo-mode-banner"]')).toBeVisible()
}

async function doOverCorrectly(page: Page, planId: string, slotIndex: number) {
  await startDoOver(page, slotIndex)
  const p = await shownProblem(page)
  const reply = page.waitForResponse((r) => r.url().includes(planId) && isWrite('record_redo')(r))
  await typeCorrect(page, p)
  const res = await reply
  expect(res.status()).toBe(200)
  return p
}

async function passBreak(page: Page) {
  await expect(page.locator('[data-component="part-transition-screen"]')).toBeVisible({
    timeout: 20_000,
  })
  await page.locator('[data-action="skip-transition"]').click()
  await expect(page.locator('[data-component="game-break-screen"]')).toBeVisible({
    timeout: 20_000,
  })
  await page.screenshot({ path: `${SHOTS}/game-break.png` })
  await page.locator('[data-action="skip-break"]').click()
}

const slotProblem = (plan: Plan, part: number, slot: number) => plan.parts[part].slots[slot].problem

async function openSession(page: Page, playerId: string) {
  console.log(`[${test.info().title.slice(0, 40)}] player ${playerId}`)
  await instrument(page)
  await page.goto(`/practice/${playerId}`)
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

test.describe('retry / do-over attribution', () => {
  test.setTimeout(240_000)

  let playerId = ''
  test.afterEach(async ({ request }) => {
    // RF_KEEP_PLAYERS=1 keeps the students so their plans can be read afterwards
    if (playerId && !process.env.RF_KEEP_PLAYERS) await cleanupPlayer(request, playerId)
    playerId = ''
  })

  test('do-over of the current retry shows the other unfixed problem, and its answer is attributed to it', async ({
    page,
    request,
  }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId)
    await openSession(page, playerId)

    // Two wrong, the rest right: a retry round of slots 0 and 1
    const first = await answer(page, plan.id, false)
    expect(sameProblem(first.shown, slotProblem(plan, 0, 0))).toBe(true)
    await answer(page, plan.id, false)
    for (let i = 2; i < plan.parts[0].slots.length; i++) await answer(page, plan.id, true)

    let server = await getPlan(request, playerId, plan.id)
    expect(server.retryState?.['0']?.currentEpoch).toBe(1)
    expect(sameProblem(await shownProblem(page), slotProblem(plan, 0, 0))).toBe(true)
    await page.screenshot({ path: `${SHOTS}/s1-retry-round.png` })

    // Do-over of slot 0 (the current retry item), correct
    await doOverCorrectly(page, plan.id, 0)
    server = await getPlan(request, playerId, plan.id)
    const redo = server.results.at(-1)!
    expect(redo).toMatchObject({ isManualRedo: true, slotIndex: 0, isCorrect: true })
    expect(server.retryState?.['0']?.redeemedSlots).toContain(0)

    // The screen moves on to slot 1, not back to the redeemed slot 0
    const next = await shownProblem(page)
    await page.screenshot({ path: `${SHOTS}/s1-after-doover.png` })
    expect(sameProblem(next, slotProblem(plan, 0, 1))).toBe(true)

    const r = await answer(page, plan.id, true)
    expect(r.status).toBe(200)
    server = await getPlan(request, playerId, plan.id)
    const last = server.results.at(-1)!
    expect(last).toMatchObject({
      slotId: plan.parts[0].slots[1].slotId,
      slotIndex: 1,
      originalSlotIndex: 1,
      epochNumber: 1,
      isCorrect: true,
    })
    expect(last.isManualRedo).toBeFalsy()
    expect(server.currentPartIndex).toBe(1)
    await expect(page.locator('[data-component="part-transition-screen"]')).toBeVisible({
      timeout: 20_000,
    })
    expect(await toasts(page)).toEqual([])
  })

  test('do-overs that redeem every retry move the session on', async ({ page, request }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId)
    await openSession(page, playerId)

    await answer(page, plan.id, false)
    await answer(page, plan.id, false)
    for (let i = 2; i < plan.parts[0].slots.length; i++) await answer(page, plan.id, true)

    await doOverCorrectly(page, plan.id, 0)
    expect(sameProblem(await shownProblem(page), slotProblem(plan, 0, 1))).toBe(true)
    await doOverCorrectly(page, plan.id, 1)

    await expect(page.locator('[data-component="part-transition-screen"]')).toBeVisible({
      timeout: 20_000,
    })
    await page.screenshot({ path: `${SHOTS}/s2-moved-on.png` })
    const server = await getPlan(request, playerId, plan.id)
    expect(server.currentPartIndex).toBe(1)
    expect(server.status).toBe('in_progress')
    expect(server.results.filter((r) => r.partNumber === 1 && r.isManualRedo)).toHaveLength(2)
    expect(await toasts(page)).toEqual([])
  })

  test('fast answers with double presses record one try per slot; a replayed write is a no-op', async ({
    page,
    request,
  }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId)
    await openSession(page, playerId)

    const bodies: string[] = []
    page.on('request', (req) => {
      if (req.method() === 'PATCH' && req.url().includes(plan.id)) bodies.push(req.postData() ?? '')
    })

    const n = plan.parts[0].slots.length
    for (let i = 0; i < n; i++) await answer(page, plan.id, true, { doublePress: true })
    await expect(page.locator('[data-component="part-transition-screen"]')).toBeVisible({
      timeout: 20_000,
    })

    const records = bodies.filter((b) => JSON.parse(b).action === 'record')
    expect(records).toHaveLength(n)

    // The same write sent again (a retried request) changes nothing
    const replay = await request.patch(`/api/curriculum/${playerId}/sessions/plans/${plan.id}`, {
      data: JSON.parse(records.at(-1)!),
    })
    const server = await getPlan(request, playerId, plan.id)
    const part1 = server.results.filter((r) => r.partNumber === 1)
    expect(replay.status(), await replay.text()).toBeLessThan(500)
    expect(part1.map((r) => r.slotIndex)).toEqual([...Array(n).keys()])
    expect(part1.map((r) => r.slotId)).toEqual(plan.parts[0].slots.map((s) => s.slotId))
    expect(server.currentPartIndex).toBe(1)
    expect(await toasts(page)).toEqual([])
  })

  test('full rhythm: part, game break, part, summary; summary counts match the results', async ({
    page,
    request,
  }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId)
    await openSession(page, playerId)

    // Part 1: first wrong, then a normal retry round
    await answer(page, plan.id, false)
    for (let i = 1; i < plan.parts[0].slots.length; i++) await answer(page, plan.id, true)
    const retry = await answer(page, plan.id, true)
    expect(sameProblem(retry.shown, slotProblem(plan, 0, 0))).toBe(true)

    for (let part = 1; part < plan.parts.length; part++) {
      await passBreak(page)
      for (let i = 0; i < plan.parts[part].slots.length; i++) await answer(page, plan.id, true)
    }

    await expect(page.locator('[data-component="practice-summary-page"]')).toBeVisible({
      timeout: 30_000,
    })
    await expect(page).toHaveURL(new RegExp(`/practice/${playerId}/summary`))
    await page.screenshot({ path: `${SHOTS}/s4-summary.png`, fullPage: true })
    const server = await getPlan(request, playerId, plan.id)
    expect(server.status).toBe('completed')
    const correct = server.results.filter((r) => r.isCorrect).length
    await expect(page.locator('[data-element="stat-problems"]').first()).toContainText(
      `${correct}/${server.results.length}`
    )
    const retryTry = server.results.find((r) => r.partNumber === 1 && r.epochNumber === 1)
    expect(retryTry).toMatchObject({ slotId: plan.parts[0].slots[0].slotId, originalSlotIndex: 0 })
    expect(await toasts(page)).toEqual([])
  })

  for (const failure of ['500', 'abort', 'lost-reply'] as const) {
    test(`a failed save (${failure}) mid-part resyncs to the server's problem and later answers attribute right`, async ({
      page,
      request,
    }) => {
      playerId = await seedStudent(request)
      const plan = await startSession(request, playerId)
      await openSession(page, playerId)

      // Fail exactly the second record write (slot 1)
      let recordCount = 0
      await page.route(`**/sessions/plans/${plan.id}`, async (route) => {
        const req = route.request()
        if (req.method() === 'PATCH' && JSON.parse(req.postData() ?? '{}').action === 'record') {
          recordCount++
          if (recordCount === 2) {
            if (failure === 'abort') return route.abort('failed')
            if (failure === 'lost-reply') await route.fetch() // reaches the server, reply lost
            return route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Injected failure' }),
            })
          }
        }
        return route.continue()
      })

      await answer(page, plan.id, true)
      const failedShown = await shownProblem(page)
      expect(sameProblem(failedShown, slotProblem(plan, 0, 1))).toBe(true)
      const failedReply = page.waitForRequest(
        (r) => r.method() === 'PATCH' && JSON.parse(r.postData() ?? '{}').action === 'record'
      )
      await typeCorrect(page, failedShown)
      await failedReply

      // The screen settles on the problem the server is on
      const expectedSlot = failure === 'lost-reply' ? 2 : 1
      await expect
        .poll(async () => (await getPlan(request, playerId, plan.id)).currentSlotIndex)
        .toBe(expectedSlot)
      await expect
        .poll(
          async () => sameProblem(await shownProblem(page), slotProblem(plan, 0, expectedSlot)),
          {
            timeout: 20_000,
          }
        )
        .toBe(true)
      await page.screenshot({ path: `${SHOTS}/s5-${failure}-after.png` })

      for (let i = expectedSlot; i < plan.parts[0].slots.length; i++) {
        const r = await answer(page, plan.id, true)
        expect(r.status).toBe(200)
      }
      await expect(page.locator('[data-component="part-transition-screen"]')).toBeVisible({
        timeout: 20_000,
      })
      const end = await getPlan(request, playerId, plan.id)
      const part1 = end.results.filter((r) => r.partNumber === 1)
      expect(part1.map((r) => r.slotId)).toEqual(plan.parts[0].slots.map((s) => s.slotId))
      expect(end.currentPartIndex).toBe(1)
      // What the kid sees for a real failed save is reported, not asserted
      console.log(`[s5 ${failure}] toasts: ${JSON.stringify(await toasts(page))}`)
    })
  }

  test('a stale tab answering an old problem resyncs quietly (409, no toast)', async ({
    page,
    context,
    request,
  }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId)
    await openSession(page, playerId)
    const stale = await context.newPage()
    await openSession(stale, playerId)
    const staleShown = await shownProblem(stale)
    expect(sameProblem(staleShown, slotProblem(plan, 0, 0))).toBe(true)

    // Tab A answers slot 0; tab B still has slot 0 up, unless it already synced
    await answer(page, plan.id, true)
    await expect
      .poll(async () => (await getPlan(request, playerId, plan.id)).currentSlotIndex)
      .toBe(1)

    const nowOnB = await shownProblem(stale)
    if (!sameProblem(nowOnB, slotProblem(plan, 0, 0))) {
      console.log('[stale tab] tab B synced before answering')
      expect(sameProblem(nowOnB, slotProblem(plan, 0, 1))).toBe(true)
      return
    }
    const reply = stale.waitForResponse((r) => r.url().includes(plan.id) && isWrite('record')(r))
    await typeWrong(stale, nowOnB)
    const status = (await reply).status()
    console.log(`[stale tab] reply to the old problem's answer: ${status}`)

    await expect
      .poll(async () => sameProblem(await shownProblem(stale), slotProblem(plan, 0, 1)), {
        timeout: 20_000,
      })
      .toBe(true)
    await stale.screenshot({ path: `${SHOTS}/s5-stale-tab-after.png` })
    expect(await toasts(stale)).toEqual([])
    const server = await getPlan(request, playerId, plan.id)
    if (status === 409) {
      expect(server.results.filter((r) => r.partNumber === 1)).toHaveLength(1)
    }
    await stale.close()
  })

  test('do-overs in an ordinary stretch: a wrong one is redeemed in place, a correct one keeps the position', async ({
    page,
    request,
  }) => {
    playerId = await seedStudent(request)
    const plan = await startSession(request, playerId)
    await openSession(page, playerId)

    await answer(page, plan.id, true)
    await answer(page, plan.id, false)

    // Slot 2 is up; do over slot 1 (wrong) correctly
    expect(sameProblem(await shownProblem(page), slotProblem(plan, 0, 2))).toBe(true)
    await doOverCorrectly(page, plan.id, 1)
    let server = await getPlan(request, playerId, plan.id)
    expect(server.results.at(-1)).toMatchObject({ isManualRedo: true, slotIndex: 1 })
    expect(server.retryState?.['0']?.pendingRetries ?? []).toHaveLength(0)
    expect(server.currentSlotIndex).toBe(2)
    expect(sameProblem(await shownProblem(page), slotProblem(plan, 0, 2))).toBe(true)

    // Do over slot 0 (correct): the position does not move
    const before = server.results.length
    await startDoOver(page, 0)
    await typeCorrect(page, await shownProblem(page))
    await expect
      .poll(async () => sameProblem(await shownProblem(page), slotProblem(plan, 0, 2)))
      .toBe(true)
    server = await getPlan(request, playerId, plan.id)
    expect(server.currentSlotIndex).toBe(2)
    console.log(`[s6] correct do-over recorded: ${server.results.length > before}`)

    // Slot 2 is attributed to slot 2, and no retry round follows
    await answer(page, plan.id, true)
    await expect(page.locator('[data-component="part-transition-screen"]')).toBeVisible({
      timeout: 20_000,
    })
    server = await getPlan(request, playerId, plan.id)
    const last = server.results.filter((r) => !r.isManualRedo).at(-1)!
    expect(last).toMatchObject({ slotId: plan.parts[0].slots[2].slotId, slotIndex: 2 })
    expect(server.currentPartIndex).toBe(1)
    expect(await toasts(page)).toEqual([])
  })
})
